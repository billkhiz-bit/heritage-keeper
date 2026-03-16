// Heritage Keeper — Express server with WebSocket for Gemini Live API
import express from 'express';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { LiveSession } from './live-session.js';
import { HeritageState } from './state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 * 1024 });

const PORT = parseInt(process.env.PORT || '3001', 10);

// Store uploaded images in memory (base64)
const uploadedImages = new Map<string, string>();

// Store API keys by session ID (server-side only — never sent back to client)
const sessionApiKeys = new Map<string, string>();

// Parse JSON bodies (must come before static middleware)
app.use(express.json({ limit: '5mb' }));

// Serve static frontend in production
app.use(express.static(join(__dirname, '..', 'dist')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'heritage-keeper' });
});

// Photo upload endpoint
app.post('/api/upload-photo', (req, res) => {
  try {
    const { image, title } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Image data required' });
    }
    // Validate MIME type
    const mimeMatch = image.match(/^data:(.+);base64,/);
    if (!mimeMatch || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeMatch[1])) {
      return res.status(400).json({ error: 'Only JPEG, PNG, WebP, and GIF images are supported' });
    }
    const id = randomUUID();
    uploadedImages.set(id, image);
    // Clean up after 1 hour
    setTimeout(() => uploadedImages.delete(id), 3600000);
    res.json({ id, url: `/api/photos/${id}` });
  } catch {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Photo analysis endpoint — Gemini Vision (uses server-stored API key)
app.post('/api/analyse-photo', async (req, res) => {
  try {
    const { image, sessionId } = req.body;
    if (!image || !sessionId) {
      return res.status(400).json({ error: 'Image and session ID required' });
    }

    const apiKey = sessionApiKeys.get(sessionId);
    if (!apiKey) {
      return res.status(401).json({ error: 'Session not found. Please reconnect.' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // Extract base64 data from data URL
    const base64Match = image.match(/^data:(.+);base64,(.+)$/);
    if (!base64Match) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(base64Match[1])) {
      return res.status(400).json({ error: 'Only JPEG, PNG, WebP, and GIF images are supported' });
    }

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: base64Match[1],
              data: base64Match[2],
            },
          },
          {
            text: `You are Heritage Keeper, a family history preservation AI. Analyse this family photograph and provide:

1. **Description**: What you see — people, their approximate ages, clothing, setting, activities
2. **Estimated Era**: Based on clothing, photo quality, surroundings — estimate the decade
3. **Details to Ask About**: 2-3 questions the family could answer about this photo (e.g., "Who is the person on the left?", "Where was this taken?")
4. **Historical Context**: If you can identify the era, mention what life was like then

Be warm and curious. This is someone's family — treat the photo with respect.
Keep it concise — 4-5 sentences for the description, 1 sentence for era, 2-3 bullet questions.`,
          },
        ],
      }],
    });

    const text = result.text || '';
    res.json({ analysis: text });
  } catch (err: any) {
    console.error('[Vision] Analysis failed:', err.message);
    res.status(500).json({ error: 'Photo analysis failed' });
  }
});

// Heritage summary endpoint — Gemini generates a narrative of the entire family history
app.post('/api/heritage-summary', async (req, res) => {
  try {
    const { sessionId, timeline, familyMembers } = req.body;
    if (!sessionId || !timeline) {
      return res.status(400).json({ error: 'Session ID and timeline required' });
    }

    const apiKey = sessionApiKeys.get(sessionId);
    if (!apiKey) {
      return res.status(401).json({ error: 'Session not found. Please reconnect.' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const storySummaries = timeline.map((e: any) =>
      `${e.year}: "${e.title}" - ${e.summary} (Location: ${e.location || 'unknown'}. People: ${(e.people || []).join(', ') || 'none'})`
    ).join('\n');

    const memberList = (familyMembers || []).map((m: any) =>
      `${m.name} (${m.relationship}, generation ${m.generation})`
    ).join(', ');

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      contents: [{
        role: 'user',
        parts: [{
          text: `You are Heritage Keeper, a warm and eloquent family historian. Based on the following family memories and family tree, write a beautiful 2-3 paragraph narrative summary of this family's heritage. Write in a warm, storytelling tone — as if you're introducing this family to someone who wants to understand where they come from.

## Family Members
${memberList || 'No members recorded yet.'}

## Memories (chronological)
${storySummaries || 'No memories recorded yet.'}

## Instructions
- Weave the stories together into a cohesive narrative
- Mention specific people, places, and time periods
- Highlight themes (migration, resilience, family bonds, traditions)
- End with something hopeful about preserving these stories for future generations
- Keep it to 2-3 paragraphs, roughly 150-200 words
- Use British English`,
        }],
      }],
    });

    res.json({ summary: result.text || '' });
  } catch (err: any) {
    console.error('[Summary] Generation failed:', err.message);
    res.status(500).json({ error: 'Summary generation failed' });
  }
});

// Serve uploaded photos
app.get('/api/photos/:id', (req, res) => {
  const image = uploadedImages.get(req.params.id);
  if (!image) return res.status(404).json({ error: 'Not found' });
  // image is a data URL like "data:image/jpeg;base64,..."
  const matches = image.match(/^data:(.+);base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: 'Invalid format' });
  const buffer = Buffer.from(matches[2], 'base64');
  res.setHeader('Content-Type', matches[1]);
  res.send(buffer);
});

// WebSocket connection handler
wss.on('connection', (ws: WebSocket) => {
  console.log('[WS] Client connected');
  let liveSession: LiveSession | null = null;
  let state = new HeritageState();

  ws.on('message', async (raw: Buffer) => {
    try {
      // Try to parse as JSON first (control messages)
      const text = raw.toString('utf-8');

      // Check if it looks like JSON
      if (text.startsWith('{')) {
        const message = JSON.parse(text);

        switch (message.type) {
          case 'init': {
            // Initialise Gemini Live session with API key
            if (!message.apiKey) {
              ws.send(
                JSON.stringify({ type: 'error', message: 'API key required.' })
              );
              return;
            }
            if (liveSession) {
              liveSession.disconnect();
            }

            // Create state with optional session ID for persistence
            state = new HeritageState(message.sessionId || undefined);
            await state.load();

            // Store API key server-side for REST endpoints (Vision analysis)
            sessionApiKeys.set(state.getSessionId(), message.apiKey);

            // Send session ID back so client can reconnect to same session
            ws.send(
              JSON.stringify({
                type: 'session',
                sessionId: state.getSessionId(),
              })
            );

            liveSession = new LiveSession(message.apiKey, ws, state);
            try {
              await liveSession.connect();

              // Send loaded state to client after connecting
              ws.send(
                JSON.stringify({
                  type: 'full_state',
                  timeline: state.getTimeline(),
                  familyTree: state.getFamilyTree(),
                })
              );
            } catch (err: any) {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  message: `Connection failed: ${err.message}`,
                })
              );
              liveSession = null;
            }
            break;
          }

          case 'text': {
            // Text message from user
            if (!liveSession) {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  message: 'Not connected. Send init first.',
                })
              );
              return;
            }
            liveSession.sendText(message.text);
            break;
          }

          case 'get_state': {
            // Client requesting current state
            ws.send(
              JSON.stringify({
                type: 'full_state',
                timeline: state.getTimeline(),
                familyTree: state.getFamilyTree(),
              })
            );
            break;
          }

          case 'disconnect': {
            if (liveSession) {
              liveSession.disconnect();
              liveSession = null;
            }
            break;
          }

          default:
            console.log('[WS] Unknown message type:', message.type);
        }
      } else {
        // Binary data — treat as audio
        if (liveSession) {
          liveSession.sendAudio(raw);
        }
      }
    } catch {
      // Not JSON — treat as binary audio data
      if (liveSession) {
        liveSession.sendAudio(raw);
      }
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    if (liveSession) {
      liveSession.disconnect();
      liveSession = null;
    }
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
  });
});

// SPA fallback — serve index.html for all non-API routes
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`\n  Heritage Keeper server running on http://localhost:${PORT}\n`);
});
