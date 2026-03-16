// Gemini Live API session management
import { GoogleGenAI, Modality, Session } from '@google/genai';
import { WebSocket as WsWebSocket } from 'ws';
import { HeritageState } from './state.js';
import { toolDeclarations, executeTool } from './tools.js';

const SYSTEM_INSTRUCTION = `You are the Heritage Keeper — a warm, gentle, emotionally intelligent AI dedicated to helping families preserve their stories as living, illustrated memoirs. You treat every memory as sacred.

## Your personality
- Warm, patient, and deeply curious about family history
- You speak like a favourite aunt or uncle who loves hearing stories
- You notice small details and ask about them
- You connect stories to each other ("That reminds me of what you said about your grandfather...")
- You gently encourage more detail: specific years, places, names, what things looked like

## What you do
When someone shares a memory, you MUST:
1. Call save_story with all extracted details (year, title, summary, location, descriptions, cost_of_living, daily_life, event, photo queries)
2. Call add_family_member for EVERY person mentioned (with correct generation number)
3. Respond warmly, commenting on specific details
4. Ask a follow-up question that encourages deeper storytelling

## Cultural context fields for save_story
- cost_of_living: Specific prices from the era — house prices, wages, food costs. Use local currency. Be precise.
- daily_life: What everyday life looked like — technology, household routines, social customs. Be vivid.
- event: A major world or local event around that time.

## Generation numbers for add_family_member
- -3 = great-grandparents
- -2 = grandparents
- -1 = parents, aunts, uncles (parent's generation)
- 0 = the storyteller, siblings, cousins (same generation)
- 1 = children
- 2 = grandchildren

## Photo search queries (for save_story photo_queries field)
Generate 5 specific queries for Wikimedia Commons:
1. City/town name + decade — street-level view (e.g. "Lahore 1960s street")
2. A nearby landmark or famous building (e.g. "Badshahi Mosque Lahore 1960s")
3. Daily life scene (e.g. "Lahore bazaar 1960s daily life")
4. The neighbourhood or district (e.g. "Anarkali Lahore old photograph")
5. Broader regional/cultural scene (e.g. "Pakistan street scene 1960s")

## Family tree voice commands
Users may give short commands to build the tree directly. Handle these WITHOUT calling save_story:
- "Bob is my father" → call add_family_member(name: "Bob", relationship: "Father", generation: -1)
- "Bob Jr is Bob's son" → call add_family_member(name: "Bob Jr", relationship: "Son of Bob", generation: 1)
- "Sarah is married to Bob" → call add_family_member(name: "Sarah", relationship: "Mother", generation: -1, partner: "Bob")
- "Add my grandmother Elena" → call add_family_member(name: "Elena", relationship: "Grandmother", generation: -2)
For these short commands, just call add_family_member and confirm. Do NOT call save_story unless an actual memory/story is being shared.

## Important rules
- ALWAYS call save_story when a memory is shared, even briefly
- ALWAYS call add_family_member for each person mentioned
- For short family tree commands (just names and relationships, no story), ONLY call add_family_member
- If the user asks about the family tree or timeline, call get_family_tree or get_timeline first
- Keep your spoken responses concise (2-4 sentences) - the visual UI shows the details
- End every response with a gentle question to keep the conversation flowing
- If this is the first interaction, warmly introduce yourself and ask for a family memory`;

export class LiveSession {
  private ai: GoogleGenAI;
  private session: Session | null = null;
  private state: HeritageState;
  private clientWs: WsWebSocket;
  private isConnected = false;

  constructor(apiKey: string, clientWs: WsWebSocket, state: HeritageState) {
    this.ai = new GoogleGenAI({ apiKey });
    this.clientWs = clientWs;
    this.state = state;
  }

  async connect(): Promise<void> {
    try {
      this.session = await this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore',
              },
            },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [
            { functionDeclarations: toolDeclarations as any },
            { googleSearch: {} },
          ],
        },
        callbacks: {
          onopen: () => {
            console.log('[Live] Connected to Gemini');
            this.isConnected = true;
            this.sendToClient({
              type: 'status',
              status: 'connected',
              message: 'Heritage Keeper is ready. Share a family memory.',
            });
          },
          onmessage: async (event: any) => {
            await this.handleGeminiMessage(event);
          },
          onerror: (event: any) => {
            console.error('[Live] Error:', event?.message || event?.error || JSON.stringify(event));
            this.sendToClient({
              type: 'error',
              message: 'Connection error with Heritage Keeper. Please try again.',
            });
          },
          onclose: (event: any) => {
            console.log('[Live] Disconnected from Gemini. Code:', event?.code, 'Reason:', event?.reason || 'none');
            this.isConnected = false;
            this.sendToClient({ type: 'status', status: 'disconnected' });
          },
        },
      });
    } catch (err: any) {
      console.error('[Live] Failed to connect:', err.message, err.stack);
      this.sendToClient({
        type: 'error',
        message: 'Failed to connect to Heritage Keeper. Check your API key and try again.',
      });
      throw err;
    }
  }

  private async handleGeminiMessage(raw: any): Promise<void> {
    // Parse the message — SDK may pass LiveServerMessage, MessageEvent, or JSON string
    let data: any;
    try {
      if (typeof raw === 'string') {
        data = JSON.parse(raw);
      } else if (raw?.data !== undefined) {
        data = typeof raw.data === 'string' ? JSON.parse(raw.data) : raw.data;
      } else {
        data = raw;
      }
    } catch {
      // Not JSON — likely raw audio binary data, skip
      return;
    }
    if (!data) return;

    // Diagnostic: log message shape once
    const keys = Object.keys(data);
    if (keys.length > 0 && !keys.includes('usageMetadata')) {
      console.log('[Live] Msg keys:', keys.join(', '));
    }

    // Handle server content — check multiple possible locations
    const serverContent = data.serverContent;
    const modelTurn = serverContent?.modelTurn ?? data.modelTurn;
    if (modelTurn) {
      const parts = modelTurn.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          this.sendToClient({
            type: 'audio',
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data,
          });
        }
        if (part.text && !part.thought) {
          this.sendToClient({
            type: 'text',
            text: part.text,
          });
        }
      }
    }

    // Check if turn is complete
    if (serverContent?.turnComplete || data.turnComplete) {
      this.sendToClient({ type: 'turn_complete' });
    }

    // Handle tool calls
    const toolCall = data.toolCall ?? serverContent?.toolCall;
    if (toolCall) {
      const functionCalls = toolCall.functionCalls || [];
      const functionResponses = [];

      for (const fc of functionCalls) {
        console.log(`[Tool] ${fc.name}(${JSON.stringify(fc.args)})`);

        // Notify client that a tool is being called
        this.sendToClient({
          type: 'tool_call',
          tool: fc.name,
          args: fc.args,
        });

        // Execute the tool
        const { result, uiEvent } = await executeTool(
          fc.name,
          fc.args || {},
          this.state
        );

        // Send UI update to client
        if (uiEvent) {
          this.sendToClient({
            type: 'ui_event',
            event: uiEvent.type,
            data: uiEvent.data,
          });
        }

        functionResponses.push({
          name: fc.name,
          id: fc.id,
          response: result,
        });
      }

      // Send tool results back to Gemini
      if (this.session && functionResponses.length > 0) {
        try {
          await this.session.sendToolResponse({
            functionResponses,
          });
        } catch (err) {
          console.error('[Tool] Failed to send response:', err);
        }
      }
    }
  }

  private audioChunkCount = 0;

  sendAudio(audioData: Buffer | Uint8Array): void {
    if (!this.session || !this.isConnected) return;
    try {
      const blob = new Blob([new Uint8Array(audioData)], { type: 'audio/pcm;rate=16000' });
      this.session.sendRealtimeInput({ audio: blob as any });
      this.audioChunkCount++;
      if (this.audioChunkCount % 50 === 1) {
        console.log(`[Live] Audio chunk #${this.audioChunkCount} sent (${audioData.length} bytes)`);
      }
    } catch (err) {
      console.error('[Live] Failed to send audio:', err);
    }
  }

  sendText(text: string): void {
    if (!this.session || !this.isConnected) return;
    try {
      this.session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text }] }],
      });
    } catch (err) {
      console.error('[Live] Failed to send text:', err);
    }
  }

  private sendToClient(message: Record<string, any>): void {
    if (this.clientWs.readyState === WsWebSocket.OPEN) {
      this.clientWs.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    if (this.session) {
      try {
        this.session.close();
      } catch {}
      this.session = null;
    }
    this.isConnected = false;
  }
}
