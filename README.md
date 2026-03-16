# Heritage Keeper

AI Family Story Preservation Agent — built for the **Gemini Live Agent Challenge 2026**.

> Share your family memories through voice or text. Heritage Keeper listens, finds historical photographs, builds your family tree, and creates an illustrated timeline — all through natural conversation.

## Live Demo

**https://heritage-keeper-87502328327.us-central1.run.app**

You will need a [Gemini API key](https://aistudio.google.com/apikey) to use the app.

## Features

- **Voice-first storytelling** — speak naturally into your microphone; the agent captures PCM audio at 16 kHz and streams it to Gemini in real time
- **Text input** — type memories if you prefer; the agent processes them identically
- **Photo upload and analysis** — upload family photographs and receive AI-powered analysis (era estimation, people, setting) via Gemini Vision
- **Illustrated timeline** — each memory becomes a rich card with year, location, summary, "Then vs Now" descriptions, and a grid of historical photographs
- **Automatic family tree** — every person mentioned in conversation is added to a generation-based family tree with relationship labels and story count badges
- **Historical photographs** — Wikimedia Commons is searched automatically for period-appropriate images of the places and eras you describe
- **Cultural context** — cost of living, daily life, and major world events from the relevant era are generated and grounded via Google Search
- **Google Search grounding** — historical facts include clickable source links so users can verify claims independently
- **PDF export** — print-ready family timeline document generated in the browser
- **JSON export** — full data portability for backup or sharing with relatives
- **Session persistence** — Firestore stores sessions server-side; localStorage caches state client-side
- **Auto-reconnect** — exponential backoff (1 s, 2 s, 4 s) handles WebSocket drops gracefully
- **Conversation thread** — scrollable log of the back-and-forth between you and the Heritage Keeper agent

## Architecture

![Heritage Keeper System Architecture](architecture.svg)

```
Browser (React 19 + TypeScript)
  ↕ WebSocket (PCM audio + JSON control messages + UI events)
Express Server (Google Cloud Run)
  ↕ @google/genai SDK — bidirectional Live API session
Gemini Live API (gemini-2.5-flash-native-audio-preview-12-2025)
  → 5 function-calling tools (save_story, search_photos, add_family_member, get_family_tree, get_timeline)
  → Google Search grounding
  → Wikimedia Commons API (historical photo search)
  → Firestore (session persistence)
```

The browser captures microphone audio as 16-bit PCM at 16 kHz and streams it over a WebSocket to an Express server on Google Cloud Run. The server maintains a bidirectional session with the Gemini Live API using the `@google/genai` SDK. Gemini responds with native audio (24 kHz) and function calls. The server executes tools, updates state, and pushes UI events back to the browser over the same WebSocket.

The API key is entered in the browser but stored server-side only — it is never sent back to the client.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6 |
| Backend | Express 5, Node.js 20, WebSocket (`ws`) |
| AI — Live Audio | Gemini 2.5 Flash Native Audio (`gemini-2.5-flash-native-audio-preview-12-2025`) via `@google/genai` SDK |
| AI — Vision | Gemini 2.5 Flash (`gemini-2.5-flash-preview-05-20`) for photo analysis |
| Grounding | Google Search (enabled alongside function calling) |
| Photos | Wikimedia Commons API with bitmap-only filtering, MIME checks, and relevance regex |
| Persistence | Firestore (server-side sessions), localStorage (client-side cache) |
| Deployment | Google Cloud Run, multi-stage Docker build, Node 20 Alpine |

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- npm 9+
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Setup

```bash
git clone https://github.com/billkhiz-bit/heritage-keeper.git
cd heritage-keeper
npm install
```

### Run

```bash
npm run dev
```

This starts both the Vite frontend (port 5174) and Express backend (port 3001) concurrently. The Vite dev server proxies `/ws` and `/api` requests to the backend automatically.

Open **http://localhost:5174**, enter your Gemini API key, and start sharing memories.

### Environment Variables (Optional)

```bash
cp .env.example .env
```

| Variable | Purpose | Default |
|----------|---------|---------|
| `GEMINI_API_KEY` | Pre-fill the API key (users can also enter it in the browser) | — |
| `GCLOUD_PROJECT` | Firebase project ID for Firestore persistence | `gen-lang-client-0304161347` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON (local dev only) | — |

### Build for Production

```bash
npm run build
npm start
```

The build compiles the React frontend into `dist/` and the TypeScript server into `dist-server/`. The production server serves the static frontend and listens on port 3001 (or `PORT` env var).

## Cloud Deployment (Google Cloud Run)

### Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed and authenticated

### Deploy

```bash
# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com

# Create Firestore database (if not exists)
gcloud firestore databases create --location=us-central1

# Deploy to Cloud Run
gcloud run deploy heritage-keeper \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --timeout 300
```

Cloud Run automatically provides default credentials for Firebase Admin SDK, so no service account key is needed in production.

## Project Structure

```
heritage-keeper/
├── server/
│   ├── index.ts              # Express server, WebSocket handler, photo upload/analysis API
│   ├── live-session.ts       # Gemini Live API session management + tool dispatch
│   ├── tools.ts              # 5 function-calling tool declarations and execution logic
│   ├── state.ts              # In-memory session state with Firestore persistence
│   ├── firebase.ts           # Firebase Admin SDK initialisation
│   └── wikimedia.ts          # Wikimedia Commons photo search with relevance filtering
├── src/
│   ├── App.tsx               # Root component — state management, WebSocket orchestration
│   ├── HeritageKeeper.tsx    # Timeline view — memory cards, photo grids, lightbox
│   ├── FamilyTree.tsx        # Generation-based family tree with avatar badges
│   ├── MemberDetail.tsx      # Individual family member detail view
│   ├── ShareView.tsx         # Export (JSON, PDF, summary), stats, data management
│   ├── ConversationThread.tsx# Scrollable conversation log
│   ├── AudioManager.ts       # Browser audio capture, WebSocket transport, auto-reconnect
│   ├── index.css             # Full application styles
│   └── main.tsx              # React entry point
├── architecture.svg          # System architecture diagram
├── Dockerfile                # Multi-stage production build (Node 20 Alpine)
├── vite.config.ts            # Vite config with dev proxy for /ws and /api
├── tsconfig.json             # Frontend TypeScript config
├── tsconfig.server.json      # Server TypeScript config
└── package.json              # Dependencies and scripts
```

## How It Works

1. **Connect** — the user enters a Gemini API key in the browser. The client opens a WebSocket to the Express server, which creates a bidirectional Live API session with Gemini using that key.

2. **Share a memory** — the user speaks into the microphone (PCM audio streamed in real time) or types a message. The server forwards input to the Gemini Live API session.

3. **Agent processes** — Gemini's system instruction tells it to behave as a warm, emotionally intelligent family history agent. When it detects a memory, it autonomously calls function-calling tools.

4. **Tool execution** — the server executes the requested tools:
   - `save_story` — extracts year, title, summary, location, "Then" and "Now" descriptions, cost of living, daily life, events, and five Wikimedia search queries
   - `search_photos` — queries Wikimedia Commons with bitmap-only filtering, MIME type checks, dimension thresholds, and regex-based relevance filtering
   - `add_family_member` — adds a person to the family tree with generation number, relationship, and optional partner
   - `get_family_tree` / `get_timeline` — lets the agent reference existing data to connect stories

5. **UI updates** — tool results are pushed to the browser as UI events over the WebSocket. The timeline, family tree, and photo gallery update in real time without page refresh.

6. **Agent responds** — Gemini sends back native audio (24 kHz) and optional text, which the browser plays and displays in the conversation thread.

7. **Persistence** — state is saved to Firestore after every tool execution (fire-and-forget) and cached in localStorage on the client. Returning users see their previous sessions.

## Gemini API Integration

### Live API (Real-Time Audio)

Heritage Keeper uses `gemini-2.5-flash-native-audio-preview-12-2025` through the `@google/genai` SDK's `live.connect()` method. The session is configured with:

- **Audio modality** — responses arrive as native audio with the "Kore" voice
- **System instruction** — a detailed persona prompt that instructs the agent on when and how to call each tool
- **Function calling** — five structured tool declarations with JSON Schema parameters
- **Google Search grounding** — enabled alongside function calling to ground historical facts with verifiable sources

### Vision API (Photo Analysis)

Uploaded photographs are analysed using `gemini-2.5-flash-preview-05-20` through a REST endpoint. The model describes the photo, estimates the era, suggests questions to ask the family, and provides historical context.

### Thought Part Filtering

The native audio model includes internal reasoning ("thought" parts) in its responses. Heritage Keeper filters these out to prevent the model's chain-of-thought from being displayed to the user:

```typescript
if (part.text && !part.thought) {
  // Only forward actual responses, not internal reasoning
}
```

## Judging Criteria Alignment

### Innovation and Multimodal UX (40%)

- **Voice-first interaction** breaks the text-box paradigm — users speak naturally rather than filling forms
- **Three input modalities** (voice, text, photo upload) serve different storytelling moments
- **Historical photographs appear automatically** from Wikimedia Commons, creating an illustrated experience
- **"Cost of Living" and "Daily Life" cards** provide emotionally resonant context beyond generic trivia
- **Distinct agent persona** — Heritage Keeper speaks like a favourite aunt who loves hearing stories

### Technical Implementation (30%)

- **Gemini Live API** with bidirectional audio streaming and concurrent function calling
- **Five custom tools** with structured schemas executed server-side
- **Google Search grounding** with source URLs stored per story
- **Thought part filtering** prevents internal reasoning from leaking to users
- **WebSocket proxy architecture** keeps the API key server-side
- **Fuzzy name matching** links stories to existing family tree members
- **Multi-layer photo filtering** (MIME type, dimensions, title regex) ensures relevant results
- **Firestore persistence** with fire-and-forget writes for session continuity
- **Auto-reconnect** with exponential backoff handles connection drops

### Demo and Presentation (30%)

- **Live deployment** on Google Cloud Run with HTTPS
- **Architecture diagram** (SVG) documenting the full system
- **PDF export** produces a print-ready family timeline document
- **JSON export** enables full data portability
- **Real-time UI updates** — timeline, family tree, and photos populate as the agent processes

## Licence

MIT
