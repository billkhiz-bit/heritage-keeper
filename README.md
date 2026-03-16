# Heritage Keeper

AI Family Story Preservation Agent — built for the **Gemini Live Agent Challenge 2026**.

> Share your family memories through voice or text. Heritage Keeper listens, finds historical photographs, builds your family tree, and creates an illustrated timeline — all through natural conversation.

## Live Demo

**https://heritage-keeper-87502328327.us-central1.run.app**

You will need a [Gemini API key](https://aistudio.google.com/apikey) to use the app.

## Features

### Input Modalities
- **Voice-first storytelling** — speak naturally into your microphone; PCM audio captured at 16 kHz, 16-bit mono via `ScriptProcessorNode`, streamed as raw `Int16Array` buffers over WebSocket to Gemini Live API
- **Text input** — messages sent as `clientContent` turns to the Live API session; processed identically to audio
- **Photo upload + Gemini Vision analysis** — images uploaded as base64 data URLs to `/api/upload-photo`, stored in server memory with UUID keys, then analysed via `gemini-2.5-flash-preview-05-20` `generateContent()` with inline image data. Returns era estimation, people description, and suggested questions

### Timeline
- **Illustrated memory cards** — each story rendered as a card with year badge, location link (Google Maps), "Then vs Now" split panel, cultural context pills (Cost of Living, Daily Life, Events), historical facts with grounding source links
- **Scrapbook aesthetic** — Polaroid-style photo grid with CSS `transform: rotate()` via `nth-child` selectors, `Caveat` handwritten font for captions/notes, `Playfair Display` serif for titles, warm cream backgrounds (`#fdf6ee`)
- **Photo lightbox with editable annotations** — click any photo to open a modal with notes textarea, "when was this taken" input, "who is in this photo" input with auto-suggest from family tree (fuzzy substring matching). Save writes back to `loosePhotos` and `TimelineEntry.photos[]` state
- **Auto-link photos to family tree** — when saving `peopleInPhoto`, `handleUpdatePhoto()` fuzzy-matches names against `familyMembers` state and auto-sets `profilePhotoUrl` on matching members without an existing photo
- **Family notes** — inline expandable textarea on each entry for family corrections/additions. Stored in `TimelineEntry.comments: string[]`. Rendered in `Caveat` handwritten font. Deletable with x button
- **Newest-first sort** — entries sorted by `parseInt(entry.id)` descending (ID is `Date.now().toString()`)

### Family Tree
- **Auto-build from conversation** — Gemini agent autonomously calls `add_family_member` tool with name, relationship, generation (-3 to +2), and optional partner
- **SVG connector lines** — `TreeConnectors` component renders horizontal spans and vertical drops between generation sections using `<svg>` with `<line>` elements
- **Guided 3-step onboarding** — empty tree shows numbered wizard: "1. Start with yourself → 2. Add your parents → 3. Share memories"
- **Profile photos** — click a photo in `MemberDetail` view to set as `profilePhotoUrl`. Auto-linked when photos are tagged via lightbox. Rendered in tree cards and sidebar with `border-radius: 50%` fallback to colour-coded initials
- **Inline rename** — double-click any member name in tree → editable `<input>` with Enter/Escape. `handleRenameMember()` updates `familyMembers` state AND all `TimelineEntry.people[]` references
- **Manual add form** — left sidebar with name, generation `<select>`, relationship fields. `maxLength` validation. Calls `onAddMember` directly to state (no agent needed)
- **Story starters** — 5 pre-written prompts ("Tell me about Grandma's first house...") that call `sendText()` via `onStoryStarter` callback

### Member Detail View
- **Per-member profile page** — `MemberDetail.tsx` filters timeline by fuzzy name match against `entry.people[]`. Shows profile card (avatar/photo, name, relationship, partner, story count), photo grid (clickable to set profile photo), and filtered memory cards
- **Accessed via** — "Profile" button in sidebar member list → sets `viewingMember` state → renders `MemberDetail` instead of timeline/tree/share

### Heritage Map
- **Interactive Leaflet map** — loaded via CDN (`leaflet@1.9.4`), rendered in `MapView.tsx` with `L.map()` and OpenStreetMap tiles
- **Nominatim geocoding** — location names converted to `[lat, lon]` via `https://nominatim.openstreetmap.org/search`. In-memory `Map<string, [number, number]>` cache prevents repeated API calls
- **Purple pin markers** — custom `L.divIcon` with `#7c3aed` background, white border, drop shadow. Popups show location name, memory count, and up to 3 entry previews
- **Auto-fit bounds** — `map.fitBounds()` with 40px padding when 2+ locations. Single location sets zoom to 6
- **Conditional rendering** — only appears when `locationData.length >= 2`

### Search & Filtering
- **10-field search** — filters `timeline` against `title`, `summary`, `year`, `location`, `storyText`, `people[]`, `historicalFacts[]`, `culturalContext.costOfLiving`, `culturalContext.dailyLife`, `culturalContext.event`. Case-insensitive `includes()` matching
- **Family member search** — simultaneously filters `familyMembers` against `name`, `relationship`, `partner`
- **Location filter** — clickable place tags with entry counts. `locationFilter` state filters `allEntries`. Active tag styled with `background: #059669; color: white`
- **Member filter** — "Filter" button in sidebar toggles `memberFilter` state. Filters entries by fuzzy `people[]` match. Indicator bar shows "Showing stories about **[name]**" with clear button
- **Results banner** — purple bar showing "Found N memories, M family members matching '[query]'" with "Clear search" button

### Share & Export
- **AI Heritage Summary** — POST to `/api/heritage-summary` with `sessionId`, `timeline`, `familyMembers`. Server uses stored API key to call `gemini-2.5-flash-preview-05-20` with a narrative prompt. Returns 2-3 paragraph family history. Displayed in Share view, included in PDF export
- **PDF export** — `window.open()` with formatted HTML document (Georgia serif, purple accents, heritage summary block, timeline entries, family member tags). Triggers `window.print()` for save-as-PDF
- **JSON export** — `JSON.stringify()` with `exportedAt` timestamp, full timeline, family members, stats. Downloaded as `.json` blob via `URL.createObjectURL()`
- **Copy summary** — clipboard API write with memory/member count text
- **Stats dashboard** — grid showing memory count, family member count, location count
- **Clear all data** — `window.confirm()` then `localStorage.removeItem()` for `hk_timeline`, `hk_family` + `window.location.reload()`
- **Heritage Span card** — sidebar card comparing earliest and latest memory years with labelled comparison boxes

### Agent Architecture
- **Custom voice** — `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName: 'Kore'` configured in Live API `connect()` config
- **Thought filtering** — `if (part.text && !part.thought)` prevents model's chain-of-thought reasoning from leaking to users
- **Robust message parser** — handles three SDK message formats: `LiveServerMessage` (direct), `MessageEvent` (wrapped in `.data`), JSON string (needs `JSON.parse()`). Try-catch with graceful fallback for binary audio data
- **Google Search grounding** — `{ googleSearch: {} }` added to tools array alongside function declarations. Grounding sources stored in `TimelineEntry.groundingSources: string[]` and rendered as clickable links with URL validation (`startsWith('http')`)
- **Frontend name matching** — `story_saved` UI event handler fuzzy-matches `entry.people[]` against current `familyMembers` state using three-way substring check. Populates `linkedMembers[]` and `newPeople[]` on the enriched entry. Displayed as green "Linked to: Martha (Grandmother)" bar
- **Auto-reconnect** — `AudioManager` tracks `reconnectAttempts` (max 3) with exponential backoff delay `Math.min(1000 * Math.pow(2, attempts - 1), 8000)`. Triggers on `ws.onclose` when `event.code !== 1000`. Resets on successful `ws.onopen`
- **Session persistence** — `HeritageState.persist()` fires `db.collection('sessions').doc(sessionId).set({...}, { merge: true })` after every mutation (addStory, addFamilyMember, addPhotosToEntry). `HeritageState.load()` called on init with client-provided `sessionId` from localStorage

### Infrastructure
- **WebSocket proxy** — Vite dev server proxies `/ws` to `ws://localhost:3001` and `/api` to `http://localhost:3001` via `vite.config.ts`
- **Multi-stage Docker build** — Stage 1: `node:20-alpine` installs all deps, runs `vite build` + `tsc -p tsconfig.server.json`. Stage 2: `node:20-alpine` with production deps only, copies `dist/` and `dist-server/`, runs `node dist-server/index.js`
- **Cloud Run config** — 512Mi memory, 300s timeout, port 8080, `--allow-unauthenticated`
- **Security** — API key stored server-side in `sessionApiKeys` Map (keyed by session ID, never sent back to client). MIME validation on upload and Vision endpoints. Filename sanitisation (`replace(/[<>"'&]/g, '')`). `maxPayload: 1MB` on WebSocket. Sanitised error messages to client (no stack traces)

## Architecture

![Heritage Keeper System Architecture](architecture.svg)

```
Browser (React 19 + TypeScript)
  ↕ WebSocket (PCM 16-bit audio + JSON control messages + UI events)
Express 5 Server (Google Cloud Run, Node.js 20)
  ↕ @google/genai SDK — bidirectional Live API session
Gemini 2.5 Flash Native Audio (gemini-2.5-flash-native-audio-preview-12-2025)
  → 5 function-calling tools
  → Google Search grounding
  → Wikimedia Commons REST API (photo search with bitmap/MIME/regex filtering)
  → Firestore (session persistence via firebase-admin SDK)
  → Gemini Vision (gemini-2.5-flash-preview-05-20 for photo analysis + heritage summary)
```

### Data Flow

1. Browser captures mic audio via `AudioContext` + `ScriptProcessorNode` → float32 to int16 PCM conversion → sent as raw `ArrayBuffer` over WebSocket
2. Server receives binary data → wraps in `Blob({ type: 'audio/pcm;rate=16000' })` → forwards via `session.sendRealtimeInput()`
3. Gemini processes audio → returns native audio (base64 PCM 24kHz) + text + tool calls via `onmessage` callback
4. Server parses response → filters thought parts → forwards audio/text to client → executes tool calls → sends UI events to client → persists state to Firestore
5. Client receives UI events → updates React state → renders timeline cards, family tree nodes, map pins in real time

### API Key Security

The API key follows a secure lifecycle:
1. User enters key in browser (password field)
2. Sent to server once in WebSocket `init` message
3. Server stores in `sessionApiKeys` Map keyed by `sessionId`
4. REST endpoints (`/api/analyse-photo`, `/api/heritage-summary`) accept `sessionId`, look up key server-side
5. Key is **never returned to client**, never logged, never included in error messages

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| Frontend | React 19, TypeScript 5.6, Vite 6 | Scrapbook UI with Caveat (handwritten), Playfair Display (serif), Inter (UI) fonts via Google Fonts |
| Backend | Express 5, Node.js 20, `ws` 8 | WebSocket server with 1MB maxPayload, JSON body parser with 5MB limit |
| AI — Live Audio | `@google/genai` SDK | `ai.live.connect()` with `Modality.AUDIO`, Kore voice, 5 function declarations, Google Search grounding |
| AI — Vision | `@google/genai` SDK | `ai.models.generateContent()` with inline image data for photo analysis and heritage summary generation |
| Grounding | Google Search | Enabled in Live API tools config. Sources stored per entry, rendered as clickable links |
| Photos | Wikimedia Commons API | `generator=search` with `filetype:bitmap`, namespace 6, `imageinfo` props. Multi-layer filtering: MIME (JPEG/PNG), dimensions (200x150 min), title regex (excludes flags/logos/maps) |
| Map | Leaflet 1.9.4 (CDN) | OpenStreetMap tiles, Nominatim geocoding with in-memory cache, custom purple `divIcon` markers |
| Persistence | Firebase Admin SDK 13.7, Firestore | `sessions/{sessionId}` documents with `{ timeline, familyMembers, updatedAt }`. Fire-and-forget writes via `.set({ merge: true })` |
| Client Cache | localStorage | `hk_timeline`, `hk_family`, `hk_sessionId` keys. Lazy-loaded in `useState()` initialisers |
| Deployment | Google Cloud Run | Multi-stage Docker (node:20-alpine), Cloud Build, Artifact Registry. 512Mi / 300s timeout / port 8080 |

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

| Variable | Purpose | Default |
|----------|---------|---------|
| `GCLOUD_PROJECT` | Firebase project ID for Firestore persistence | `gen-lang-client-0304161347` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON (local dev only) | — |
| `PORT` | Server port | `3001` (dev), `8080` (Docker) |

### Build for Production

```bash
npm run build    # Compiles frontend (Vite → dist/) and server (tsc → dist-server/)
npm start        # Runs compiled server: node dist-server/index.js
```

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

# Create Firestore database (skip if already exists)
gcloud firestore databases create --location=us-central1

# Deploy to Cloud Run (builds remotely via Cloud Build)
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
│   ├── index.ts              # Express server, WebSocket handler, REST endpoints
│   │                         # (health, upload-photo, analyse-photo, heritage-summary, photos/:id)
│   ├── live-session.ts       # Gemini Live API session — connect(), handleGeminiMessage(),
│   │                         # sendAudio(), sendText(), thought filtering, tool dispatch
│   ├── tools.ts              # 5 function-calling tool declarations (Type.OBJECT schemas)
│   │                         # + executeTool() switch with Wikimedia photo search integration
│   ├── state.ts              # HeritageState class — in-memory Map/Array + Firestore
│   │                         # persist()/load(). Interfaces: TimelineEntry, FamilyMemberData,
│   │                         # HistoricalPhoto
│   ├── firebase.ts           # Firebase Admin SDK lazy singleton initialisation
│   └── wikimedia.ts          # searchPhotos() + searchMultipleQueries() with
│                             # IRRELEVANT_PATTERNS regex, MIME check, dimension filter
├── src/
│   ├── App.tsx               # Root component — all state, WebSocket lifecycle, handleUIEvent,
│   │                         # handleMessage, sendText, photo handlers, routing
│   ├── HeritageKeeper.tsx    # Timeline view — entry cards, photo grid, lightbox with editable
│   │                         # notes, location/member filtering, map integration, onboarding
│   ├── FamilyTree.tsx        # Generation tree — SVG connectors, guided wizard, add form,
│   │                         # inline rename, profile photos, story starters
│   ├── MemberDetail.tsx      # Per-member view — filtered stories, photo grid, profile photo set
│   ├── MapView.tsx           # Leaflet map — Nominatim geocoding, purple pins, popups
│   ├── ShareView.tsx         # Heritage Summary, PDF/JSON export, stats, clear data
│   ├── ConversationThread.tsx# Scrollable chat log — user/agent messages with auto-scroll
│   ├── AudioManager.ts       # Mic capture (ScriptProcessorNode), audio playback (AudioContext),
│   │                         # WebSocket transport, auto-reconnect with exponential backoff
│   ├── index.css             # Full design system — CSS custom properties, Polaroid grid,
│   │                         # lightbox, responsive breakpoints (640px, 480px, 768px, 900px)
│   └── main.tsx              # React entry point
├── architecture.svg          # System architecture diagram (SVG)
├── Dockerfile                # Multi-stage: build frontend + compile server → production alpine
├── vite.config.ts            # Dev proxy: /ws → ws://localhost:3001, /api → http://localhost:3001
├── tsconfig.json             # Frontend: ES2020, React JSX, DOM libs
├── tsconfig.server.json      # Server: ES2022, ESNext modules, outDir: dist-server, sourceMap
└── package.json              # Scripts: dev, build:frontend, build:server, build, start
```

## Function-Calling Tools

| Tool | Parameters | What It Does |
|------|-----------|-------------|
| `save_story` | year, title, summary, location, then_description, now_description, people[], historical_facts[], cost_of_living, daily_life, event, photo_queries[], grounding_sources[], story_text | Creates a `TimelineEntry`, searches Wikimedia for photos, fuzzy-matches people against family tree, persists to Firestore |
| `search_photos` | queries[] | Searches Wikimedia Commons with bitmap filtering, returns up to 8 deduplicated photos |
| `add_family_member` | name, relationship, generation (-3 to +2), partner? | Adds to family tree Map (deduplicates by lowercase name), increments storyCount on existing members |
| `get_family_tree` | (none) | Returns current family tree array — lets agent reference known members |
| `get_timeline` | (none) | Returns simplified timeline entries — lets agent reference previous stories |

Each tool returns a `ToolResult` with `result` (sent back to Gemini) and `uiEvent` (sent to browser for real-time UI update).

## System Instruction (Agent Persona)

The Gemini Live API session is configured with a detailed system instruction that defines Heritage Keeper's personality and behaviour:

- Warm, patient, deeply curious about family history
- Speaks like a favourite aunt or uncle who loves hearing stories
- Notices small details and asks about them
- Connects stories to each other across time periods
- **Must** call `save_story` for every memory shared
- **Must** call `add_family_member` for every person mentioned
- Generates 5 specific Wikimedia search queries per story (street view, landmark, daily life, neighbourhood, regional)
- Uses cost_of_living and daily_life fields with specific local currency prices and vivid descriptions
- Keeps spoken responses concise (2-4 sentences) since the visual UI shows the details

## Judging Criteria Alignment

### Innovation and Multimodal UX (40%)

- **Voice-first interaction** breaks the text-box paradigm — users speak naturally rather than filling forms
- **Three input modalities** (voice, text, photo upload) serve different storytelling moments
- **Gemini Vision** analyses uploaded family photos — describing people, estimating eras, suggesting questions
- **Historical photographs appear automatically** from Wikimedia Commons as Polaroid-style scrapbook cards
- **Cost of Living and Daily Life** context provides emotionally resonant era-specific details
- **Heritage Map** with geocoded pins visualises the family's geographic journey
- **Distinct agent persona** — Heritage Keeper speaks like a favourite aunt who loves hearing stories, using the Kore voice
- **Scrapbook aesthetic** — handwritten fonts, Polaroid rotation, warm backgrounds create an intimate feel

### Technical Implementation (30%)

- **Gemini Live API** with bidirectional native audio streaming and concurrent function calling
- **Five custom tools** with structured JSON Schema declarations executed server-side
- **Google Search grounding** with source URLs stored per story and rendered as clickable links
- **Gemini Vision** for photo analysis via separate `generateContent()` endpoint
- **AI Heritage Summary** generation weaving all stories into a cohesive narrative
- **Thought part filtering** prevents internal reasoning from leaking to users
- **Robust message parser** handles three SDK message formats with graceful binary fallback
- **WebSocket proxy architecture** keeps the API key server-side with session-based lookup
- **Fuzzy name matching** (three-way substring) links stories to existing family tree members
- **Multi-layer photo filtering** (MIME type, dimensions, title regex) ensures relevant results
- **Firestore persistence** with fire-and-forget writes for session continuity
- **Auto-reconnect** with exponential backoff handles connection drops
- **SVG family tree connectors** render visual relationships between generations
- **Nominatim geocoding** with in-memory cache for map pin placement

### Demo and Presentation (30%)

- **Live deployment** on Google Cloud Run (21 revisions deployed) with HTTPS
- **Architecture diagram** (SVG) documenting the full system
- **PDF export** produces a print-ready family timeline with Heritage Summary
- **JSON export** enables full data portability
- **Real-time UI updates** — timeline, family tree, map, and photos populate as the agent processes
- **README** with complete spin-up instructions for judges to reproduce locally
- **Session persistence** — data survives page refresh (localStorage) and server restart (Firestore)

## Licence

MIT
