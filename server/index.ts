// Heritage Keeper — Express server with WebSocket for Gemini Live API
import express from 'express';
import { createServer } from 'http';
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

// Serve static frontend in production
app.use(express.static(join(__dirname, '..', 'dist')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'heritage-keeper' });
});

// WebSocket connection handler
wss.on('connection', (ws: WebSocket) => {
  console.log('[WS] Client connected');
  let liveSession: LiveSession | null = null;
  const state = new HeritageState();

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
            liveSession = new LiveSession(message.apiKey, ws, state);
            try {
              await liveSession.connect();
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
