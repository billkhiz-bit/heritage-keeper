# Building Heritage Keeper: A Gemini Live Agent for Family Story Preservation

*How I used the Gemini Live API with native audio, function calling, and Google Search grounding to build an AI agent that turns family conversations into illustrated timelines.*

*This article was created for the purposes of entering the Gemini Live Agent Challenge hackathon. #GeminiLiveAgentChallenge*

---

## The Problem

My grandmother came to London from Jamaica in the 1950s. She had stories about Brixton in the Windrush era, about what things cost, about neighbours and churches and dance halls. Most of those stories were never written down.

This is true for nearly every family. The stories exist in the memories of older generations - rich, vivid, emotional - but they're never preserved. Traditional approaches (family tree software, memoir-writing tools) feel like work. They require forms, dates, and data entry. Nobody wants to do that.

What if preserving family history was as easy as having a conversation?

## The Solution: Heritage Keeper

Heritage Keeper is a voice-first AI agent built on the Gemini Live API. You simply talk about your memories, and the agent:

1. **Listens** via real-time audio streaming
2. **Extracts** names, dates, places, and relationships
3. **Saves** each memory as a timeline entry
4. **Finds** historical photographs from Wikimedia Commons
5. **Builds** a family tree from the people you mention
6. **Grounds** historical facts using Google Search
7. **Adds context** - cost of living, daily life, world events

No forms. No data entry. Just talk.

## Architecture

The browser captures microphone audio as PCM 16-bit at 16kHz and streams it over a WebSocket to an Express server on Google Cloud Run. The server maintains a bidirectional session with the Gemini Live API using the Google GenAI SDK. Gemini responds with native audio (24kHz) and function calls.

The flow looks like this:

**Browser (React 19)** communicates via WebSocket with PCM audio and JSON messages to the **Express Server on Cloud Run**, which connects to the **Gemini Live API** (gemini-2.5-flash-native-audio). The agent has access to 5 function-calling tools, Google Search grounding, and the Wikimedia Commons API.

## The Five Tools

I designed five function-calling tools that the agent uses autonomously:

- **save_story** - Extracts year, title, summary, location, Then/Now descriptions, cost of living, daily life, events, and photo search queries
- **search_photos** - Queries Wikimedia Commons for historical photographs with bitmap-only filtering
- **add_family_member** - Adds a person to the family tree with generation number and relationship
- **get_family_tree** - Retrieves the current tree (so the agent knows who's already been mentioned)
- **get_timeline** - Retrieves saved stories (so the agent can reference previous memories)

The agent decides when to call each tool based on the conversation. When you say "my grandmother came to London in 1955", it calls save_story AND add_family_member AND search_photos - all autonomously.

## Google Search Grounding

One of the most impactful additions was enabling Google Search grounding alongside function calling. This means when the agent generates historical facts about 1950s Brixton, it can verify them against Google Search results. The grounding sources are stored per story and displayed as clickable links - so users can verify the facts themselves.

This transforms AI-generated context from "maybe true" to "verifiably true."

## Lessons Learned

### 1. Thought Parts Need Filtering
The gemini-2.5-flash-native-audio model includes internal reasoning ("thought" parts) in its responses. Without filtering, users see the model's chain-of-thought ("Interpreting 'Funny Bob'... I'm hesitant to categorise this..."). The fix was checking each response part and only forwarding actual responses, not internal reasoning. A small code change with massive UX impact.

### 2. The Message Format Varies
The SDK's onmessage callback can pass different message formats - a LiveServerMessage, a MessageEvent, or even a JSON string. My parser needed to handle all three cases, with a graceful fallback for raw audio binary data that would otherwise crash the JSON parser.

### 3. Cost of Living > Music Trivia
I initially included "popular music" and "film/TV" as cultural context. But for family heritage, knowing that "a house cost £2,500 and the weekly wage was £15" is far more powerful than knowing what song was number one. It grounds the story in lived reality.

### 4. Auto-Reconnect Is Essential for Live APIs
WebSocket connections to the Gemini Live API can drop (Cloud Run timeouts, network blips). Exponential backoff reconnection (1s, 2s, 4s) keeps the experience seamless.

### 5. Voice Commands for Family Trees
Users want to build family trees quickly by voice - "Bob is my father", "Elena is Bob's mother." The agent needed specific instructions to handle these short commands with just an add_family_member call, without trying to create a full story entry.

## What's Next

Heritage Keeper is a prototype built for the Gemini Live Agent Challenge. The natural evolution is:
- **User accounts** with Firestore persistence
- **Family collaboration** - multiple members contributing to the same timeline
- **Genealogy API integration** for data enrichment
- **Mobile app** for recording stories on the go

The core insight remains: the best tool for preserving family history is a good conversation partner.

---

*Heritage Keeper was built for the [Gemini Live Agent Challenge 2026](https://geminiliveagentchallenge.devpost.com/). Try it at [heritage-keeper-87502328327.us-central1.run.app](https://heritage-keeper-87502328327.us-central1.run.app). View the source on [GitHub](https://github.com/billkhiz-bit/heritage-keeper).*
