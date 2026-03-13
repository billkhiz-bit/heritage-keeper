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
1. Call save_story with all extracted details (year, title, summary, location, descriptions, cultural context, photo queries)
2. Call add_family_member for EVERY person mentioned (with correct generation number)
3. Respond warmly, commenting on specific details
4. Ask a follow-up question that encourages deeper storytelling

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

## Important rules
- ALWAYS call save_story when a memory is shared, even briefly
- ALWAYS call add_family_member for each person mentioned
- If the user asks about the family tree or timeline, call get_family_tree or get_timeline first
- Keep your spoken responses concise (2-4 sentences) — the visual UI shows the details
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
        model: 'gemini-live-2.5-flash-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: toolDeclarations as any }],
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
            console.error('[Live] Error:', event);
            this.sendToClient({
              type: 'error',
              message: 'Connection error with Heritage Keeper.',
            });
          },
          onclose: () => {
            console.log('[Live] Disconnected from Gemini');
            this.isConnected = false;
            this.sendToClient({ type: 'status', status: 'disconnected' });
          },
        },
      });
    } catch (err: any) {
      console.error('[Live] Failed to connect:', err.message);
      this.sendToClient({
        type: 'error',
        message: `Failed to connect: ${err.message}`,
      });
      throw err;
    }
  }

  private async handleGeminiMessage(event: any): Promise<void> {
    const data = event.data;
    if (!data) return;

    // Handle server content (audio response)
    if (data.serverContent) {
      const parts = data.serverContent.modelTurn?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          // Audio data — forward to client
          this.sendToClient({
            type: 'audio',
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data,
          });
        }
        if (part.text) {
          // Text response
          this.sendToClient({
            type: 'text',
            text: part.text,
          });
        }
      }

      // Check if turn is complete
      if (data.serverContent.turnComplete) {
        this.sendToClient({ type: 'turn_complete' });
      }
    }

    // Handle tool calls
    if (data.toolCall) {
      const functionCalls = data.toolCall.functionCalls || [];
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

  sendAudio(audioData: Buffer | Uint8Array): void {
    if (!this.session || !this.isConnected) return;
    try {
      this.session.sendRealtimeInput({
        audio: new Blob([new Uint8Array(audioData)], { type: 'audio/pcm;rate=16000' }) as any,
      });
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
