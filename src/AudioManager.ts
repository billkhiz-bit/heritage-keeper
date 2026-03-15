// Browser audio capture (mic) and playback, connected via WebSocket

export type WSMessage = {
  type: string;
  [key: string]: any;
};

export type MessageHandler = (message: WSMessage) => void;

export class AudioManager {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private onMessage: MessageHandler;
  private isRecording = false;
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private apiKey: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(onMessage: MessageHandler) {
    this.onMessage = onMessage;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.apiKey) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 8000);

    this.onMessage({
      type: 'status',
      status: 'connecting',
      message: `Reconnecting (attempt ${this.reconnectAttempts})...`,
    });

    this.reconnectTimeout = setTimeout(() => {
      this.connect(this.apiKey);
    }, delay);
  }

  connect(apiKey: string): void {
    this.apiKey = apiKey;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      // Send init with API key
      this.send({ type: 'init', apiKey });
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'audio') {
          this.queueAudio(message.data);
        } else {
          this.onMessage(message);
        }
      } catch {
        // Binary audio data
      }
    };

    this.ws.onerror = () => {
      this.onMessage({ type: 'error', message: 'WebSocket connection failed.' });
    };

    this.ws.onclose = (event) => {
      if (event.code !== 1000 && this.apiKey) {
        // Unexpected close — try to reconnect
        this.attemptReconnect();
      } else {
        this.onMessage({ type: 'status', status: 'disconnected' });
      }
    };
  }

  send(message: Record<string, any>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendText(text: string): void {
    this.send({ type: 'text', text });
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Use AudioContext to get raw PCM data
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(stream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!this.isRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Convert float32 to int16 PCM
        const pcm = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.ws.send(pcm.buffer);
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      this.mediaRecorder = { stream, source, processor } as any;
      this.isRecording = true;
      this.onMessage({ type: 'recording', recording: true });
    } catch (err: any) {
      this.onMessage({
        type: 'error',
        message: `Microphone access denied: ${err.message}`,
      });
    }
  }

  stopRecording(): void {
    this.isRecording = false;
    if (this.mediaRecorder) {
      const { stream, source, processor } = this.mediaRecorder as any;
      try {
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      } catch {}
      this.mediaRecorder = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.onMessage({ type: 'recording', recording: false });
  }

  private queueAudio(base64Data: string): void {
    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      this.audioQueue.push(bytes.buffer);
      if (!this.isPlaying) {
        this.playNextAudio();
      }
    } catch (err) {
      console.warn('Failed to decode audio:', err);
    }
  }

  private async playNextAudio(): Promise<void> {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const buffer = this.audioQueue.shift()!;

    try {
      const ctx = new AudioContext({ sampleRate: 24000 });
      // Gemini Live returns PCM 16-bit at 24kHz
      const pcm = new Int16Array(buffer);
      const float32 = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) {
        float32[i] = pcm[i] / 32768;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        ctx.close().catch(() => {});
        this.playNextAudio();
      };
      source.start();
    } catch {
      this.playNextAudio();
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // prevent reconnect after manual disconnect

    this.stopRecording();
    if (this.ws) {
      this.send({ type: 'disconnect' });
      this.ws.close();
      this.ws = null;
    }
    this.audioQueue = [];
    this.isPlaying = false;
  }

  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  get recording(): boolean {
    return this.isRecording;
  }
}
