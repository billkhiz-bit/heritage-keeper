import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AudioManager, WSMessage } from './AudioManager';
import HeritageKeeper from './HeritageKeeper';
import FamilyTree, { FamilyMember } from './FamilyTree';
import ShareView from './ShareView';

interface HistoricalPhoto {
  url: string;
  title: string;
  description: string;
}

interface TimelineEntry {
  id: string;
  year: string;
  title: string;
  summary: string;
  location: string;
  thenDescription: string;
  nowDescription: string;
  people: string[];
  historicalFacts: string[];
  culturalContext: { music: string; film: string; event: string };
  photos: HistoricalPhoto[];
  storyText: string;
}

type AgentStatus = 'disconnected' | 'connecting' | 'connected' | 'listening' | 'thinking';
type View = 'timeline' | 'tree' | 'share';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isReady, setIsReady] = useState(false);

  // Shared state
  const [status, setStatus] = useState<AgentStatus>('disconnected');
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [activeView, setActiveView] = useState<View>('timeline');
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [agentText, setAgentText] = useState('');
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loosePhotos, setLoosePhotos] = useState<HistoricalPhoto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const audioRef = useRef<AudioManager | null>(null);

  const handleUIEvent = useCallback((event: string, data: any) => {
    switch (event) {
      case 'story_saved':
        setTimeline((prev) => {
          const exists = prev.some((e) => e.id === data.id);
          if (exists) return prev.map((e) => (e.id === data.id ? data : e));
          return [...prev, data];
        });
        break;
      case 'photos_found':
        setLoosePhotos(data || []);
        break;
      case 'member_added':
        setFamilyMembers((prev) => {
          const key = data.name.toLowerCase();
          const exists = prev.some((m) => m.name.toLowerCase() === key);
          if (exists) {
            return prev.map((m) =>
              m.name.toLowerCase() === key
                ? { ...m, storyCount: m.storyCount + 1, partner: data.partner || m.partner }
                : m
            );
          }
          return [...prev, data];
        });
        break;
      case 'tree_updated':
        setFamilyMembers(data || []);
        break;
      case 'timeline_updated':
        setTimeline(data || []);
        break;
    }
  }, []);

  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'status':
        if (message.status === 'connected') {
          setStatus('connected');
          setError(null);
        } else if (message.status === 'disconnected') {
          setStatus('disconnected');
        }
        break;
      case 'text':
        setAgentText((prev) => prev + (message.text || ''));
        break;
      case 'turn_complete':
        setStatus('connected');
        setToolActivity(null);
        break;
      case 'tool_call': {
        setStatus('thinking');
        const toolLabels: Record<string, string> = {
          save_story: 'Preserving your memory...',
          search_photos: 'Searching for historical photographs...',
          add_family_member: `Adding ${message.args?.name || 'family member'} to the tree...`,
          get_family_tree: 'Reviewing the family tree...',
          get_timeline: 'Looking through saved memories...',
        };
        setToolActivity(toolLabels[message.tool] || `Using ${message.tool}...`);
        break;
      }
      case 'ui_event':
        handleUIEvent(message.event, message.data);
        break;
      case 'recording':
        setIsRecording(message.recording);
        if (message.recording) {
          setStatus('listening');
          setAgentText('');
        }
        break;
      case 'error':
        setError(message.message);
        setStatus('disconnected');
        break;
      case 'full_state':
        if (message.timeline) setTimeline(message.timeline);
        if (message.familyTree) setFamilyMembers(message.familyTree);
        break;
    }
  }, [handleUIEvent]);

  useEffect(() => {
    if (!isReady) return;
    const audio = new AudioManager(handleMessage);
    audioRef.current = audio;
    setStatus('connecting');
    audio.connect(apiKey);
    return () => { audio.disconnect(); };
  }, [apiKey, isReady, handleMessage]);

  const toggleRecording = () => {
    if (!audioRef.current) return;
    if (isRecording) {
      audioRef.current.stopRecording();
    } else {
      setAgentText('');
      audioRef.current.startRecording();
    }
  };

  const sendText = (text?: string) => {
    const msg = text || textInput.trim();
    if (!msg || !audioRef.current) return;
    setAgentText('');
    audioRef.current.sendText(msg);
    setTextInput('');
    setStatus('thinking');
  };

  const handleStart = () => {
    if (apiKey.trim()) setIsReady(true);
  };

  const statusColour: Record<AgentStatus, string> = {
    disconnected: '#9ca3af',
    connecting: '#a16207',
    connected: '#16a34a',
    listening: '#dc2626',
    thinking: '#7c3aed',
  };

  const statusLabel: Record<AgentStatus, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Ready',
    listening: 'Listening...',
    thinking: 'Thinking...',
  };

  // ─── Landing Page ───
  if (!isReady) {
    return (
      <div className="landing">
        <div className="landing-logo">&#x1f3db;</div>
        <div style={{ textAlign: 'center' }}>
          <h1>Heritage Keeper</h1>
          <p className="subtitle">AI Family Story Preservation Agent</p>
        </div>
        <p className="desc">
          Share your family memories through voice or text. The Heritage Keeper will
          preserve them as an illustrated timeline, find historical photographs,
          and build your family tree — all through natural conversation.
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Gemini API Key"
          onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          aria-label="Gemini API Key"
          className="landing-input"
        />
        <button
          onClick={handleStart}
          disabled={!apiKey.trim()}
          className="landing-btn"
        >
          Start Conversation
        </button>
        <p className="footnote">
          Your API key is sent to the server to connect to Gemini's Live API. It is not stored or logged.
        </p>
      </div>
    );
  }

  // ─── Filter timeline by search ───
  const filteredTimeline = searchQuery.trim()
    ? timeline.filter(
        (e) =>
          e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.people?.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : timeline;

  return (
    <div>
      {/* ─── Navigation ─── */}
      <nav className="nav">
        <div className="nav-logo">
          <div className="nav-logo-icon">&#x1f3db;</div>
          Heritage Keeper
        </div>

        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeView === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveView('timeline')}
          >
            Timeline
          </button>
          <button
            className={`nav-tab ${activeView === 'tree' ? 'active' : ''}`}
            onClick={() => setActiveView('tree')}
          >
            Family Tree
          </button>
          <button
            className={`nav-tab ${activeView === 'share' ? 'active' : ''}`}
            onClick={() => setActiveView('share')}
          >
            Share
          </button>
        </div>

        <div className="nav-right">
          <div className="nav-search">
            <span>&#x1f50d;</span>
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search memories"
            />
          </div>
          <div className="nav-avatar">
            <span>&#x1f464;</span>
          </div>
        </div>
      </nav>

      {/* ─── Main Content ─── */}
      <div className="app-layout">

        {/* Status bar */}
        <div className="status-bar" role="status" aria-live="polite" aria-label={`Connection status: ${statusLabel[status]}`}>
          <div
            className={`status-dot ${status}`}
            style={{ background: statusColour[status] }}
            aria-hidden="true"
          />
          <span className="status-label" style={{ color: statusColour[status] }}>
            {statusLabel[status]}
          </span>
          {toolActivity && (
            <span className="tool-activity fade-in">{toolActivity}</span>
          )}
        </div>

        {/* Memory Input — shared across views */}
        <div className="memory-input-section">
          <p className="memory-input-label">Add to the Legacy</p>
          <div className="memory-input-row">
            <textarea
              className="memory-textarea"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Tell a story or describe a memory..."
              disabled={status === 'disconnected' || status === 'connecting'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && textInput.trim()) {
                  e.preventDefault();
                  sendText();
                }
              }}
              rows={1}
            />
            <div className="input-actions">
              <button
                className={`btn-icon ${isRecording ? 'recording' : ''}`}
                onClick={toggleRecording}
                disabled={status === 'disconnected' || status === 'connecting'}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                title={isRecording ? 'Tap to stop' : 'Speak a memory'}
              >
                {isRecording ? '\u{23F9}' : '\u{1F399}'}
              </button>
              <button
                className="btn-post"
                onClick={() => sendText()}
                disabled={!textInput.trim() || status === 'disconnected'}
              >
                Post Memory
              </button>
            </div>
          </div>
        </div>

        {/* Agent response */}
        {agentText && (
          <div className="agent-response fade-in">
            <p>{agentText}</p>
          </div>
        )}

        {/* Error — dismissible */}
        {error && (
          <div className="error-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 700, fontSize: 16, padding: '0 4px' }}
            >
              &times;
            </button>
          </div>
        )}

        {/* View content */}
        {activeView === 'timeline' && (
          <HeritageKeeper
            timeline={filteredTimeline}
            familyMembers={familyMembers}
            loosePhotos={loosePhotos}
            onViewTree={() => setActiveView('tree')}
          />
        )}

        {activeView === 'tree' && (
          <FamilyTree
            members={familyMembers}
            onMemberClick={() => setActiveView('timeline')}
            onAddMember={(member) => {
              setFamilyMembers((prev) => {
                const key = member.name.toLowerCase();
                const exists = prev.some((m) => m.name.toLowerCase() === key);
                if (exists) return prev;
                return [...prev, member];
              });
            }}
            onStoryStarter={(prompt) => {
              setTextInput(prompt);
              setActiveView('timeline');
            }}
          />
        )}

        {activeView === 'share' && (
          <ShareView timeline={timeline} familyMembers={familyMembers} />
        )}
      </div>

      {/* Footer */}
      <footer className="app-footer">
        Heritage Keeper &copy; {new Date().getFullYear()}
        <br />
        <span>Privacy Policy</span>
        <span>Family Settings</span>
        <span>Archive Export</span>
      </footer>
    </div>
  );
};

export default App;
