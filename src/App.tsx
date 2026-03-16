import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AudioManager, WSMessage } from './AudioManager';
import HeritageKeeper from './HeritageKeeper';
import FamilyTree, { FamilyMember } from './FamilyTree';
import ShareView from './ShareView';
import MemberDetail from './MemberDetail';
import ConversationThread from './ConversationThread';

interface HistoricalPhoto {
  url: string;
  title: string;
  description: string;
  notes?: string;
  dateTaken?: string;
  peopleInPhoto?: string[];
  source?: 'wikimedia' | 'upload';
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
  culturalContext: { costOfLiving: string; dailyLife: string; event: string };
  photos: HistoricalPhoto[];
  storyText: string;
  groundingSources?: string[];
}

type AgentStatus = 'disconnected' | 'connecting' | 'connected' | 'listening' | 'thinking';
type View = 'timeline' | 'tree' | 'share';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isReady, setIsReady] = useState(false);

  // Load persisted state from localStorage
  const loadStored = <T,>(key: string, fallback: T): T => {
    try {
      const stored = localStorage.getItem(`hk_${key}`);
      return stored ? JSON.parse(stored) : fallback;
    } catch { return fallback; }
  };

  // Shared state
  const [status, setStatus] = useState<AgentStatus>('disconnected');
  const [timeline, setTimeline] = useState<TimelineEntry[]>(() => loadStored('timeline', []));
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => loadStored('family', []));
  const [activeView, setActiveView] = useState<View>('timeline');
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [agentText, setAgentText] = useState('');
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loosePhotos, setLoosePhotos] = useState<HistoricalPhoto[]>([]);
  const [initialLightboxPhoto, setInitialLightboxPhoto] = useState<HistoricalPhoto | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingMember, setViewingMember] = useState<string | null>(null);
  const [conversation, setConversation] = useState<{role: 'user' | 'agent', text: string, timestamp: number}[]>([]);
  const [photoAnalysis, setPhotoAnalysis] = useState<string | null>(null);
  const audioRef = useRef<AudioManager | null>(null);

  const handleUIEvent = useCallback((event: string, data: any) => {
    switch (event) {
      case 'story_saved':
        setTimeline((prev) => {
          // Match people in story against existing family tree (frontend-side)
          const people: string[] = data.people || [];
          const linked: string[] = [];
          const unlinked: string[] = [];
          setFamilyMembers((members) => {
            for (const person of people) {
              const key = person.toLowerCase();
              const match = members.find(
                (m) => m.name.toLowerCase() === key || m.name.toLowerCase().includes(key) || key.includes(m.name.toLowerCase())
              );
              if (match) linked.push(`${match.name} (${match.relationship})`);
              else unlinked.push(person);
            }
            return members; // no mutation, just reading
          });
          const enriched = { ...data, linkedMembers: linked, newPeople: unlinked };
          const exists = prev.some((e) => e.id === data.id);
          if (exists) return prev.map((e) => (e.id === data.id ? enriched : e));
          return [enriched, ...prev]; // newest first
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
        } else if (message.status === 'connecting') {
          setStatus('connecting');
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
        setAgentText((currentAgentText) => {
          if (currentAgentText) {
            setConversation(prev => [...prev, {role: 'agent', text: currentAgentText, timestamp: Date.now()}]);
          }
          return currentAgentText;
        });
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
      case 'session':
        if (message.sessionId) {
          localStorage.setItem('hk_sessionId', message.sessionId);
        }
        break;
      case 'full_state':
        if (message.timeline) setTimeline(message.timeline);
        if (message.familyTree) setFamilyMembers(message.familyTree);
        break;
    }
  }, [handleUIEvent]);

  // Persist timeline and family to localStorage
  useEffect(() => {
    if (timeline.length > 0) localStorage.setItem('hk_timeline', JSON.stringify(timeline));
  }, [timeline]);

  useEffect(() => {
    if (familyMembers.length > 0) localStorage.setItem('hk_family', JSON.stringify(familyMembers));
  }, [familyMembers]);

  // Scroll to newest entry when timeline grows
  const prevTimelineLength = useRef(timeline.length);
  useEffect(() => {
    if (timeline.length > prevTimelineLength.current) {
      setTimeout(() => {
        document.querySelector('.entry-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    prevTimelineLength.current = timeline.length;
  }, [timeline.length]);

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
    setConversation(prev => [...prev, {role: 'user', text: msg, timestamp: Date.now()}]);
    audioRef.current.sendText(msg);
    setTextInput('');
    setStatus('thinking');
  };

  const handleUpdatePhoto = (updated: HistoricalPhoto) => {
    setLoosePhotos(prev => prev.map(p => p.url === updated.url ? updated : p));
    setTimeline(prev => prev.map(entry => ({
      ...entry,
      photos: entry.photos.map(p => p.url === updated.url ? updated : p),
    })));
  };

  const handleSetProfilePhoto = (memberName: string, photoUrl: string) => {
    setFamilyMembers(prev => prev.map(m =>
      m.name.toLowerCase() === memberName.toLowerCase()
        ? { ...m, profilePhotoUrl: photoUrl }
        : m
    ));
  };

  const handleDeletePhoto = (photo: HistoricalPhoto) => {
    setLoosePhotos(prev => prev.filter(p => p.url !== photo.url));
    setTimeline(prev => prev.map(entry => ({
      ...entry,
      photos: entry.photos.filter(p => p.url !== photo.url),
    })));
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
          and build your family tree - all through natural conversation.
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

  // ─── Filter timeline + family by search ───
  const q = searchQuery.trim().toLowerCase();
  const filteredTimeline = q
    ? timeline.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          e.year.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q) ||
          e.storyText?.toLowerCase().includes(q) ||
          e.people?.some((p) => p.toLowerCase().includes(q)) ||
          e.historicalFacts?.some((f) => f.toLowerCase().includes(q)) ||
          e.culturalContext?.costOfLiving?.toLowerCase().includes(q) ||
          e.culturalContext?.dailyLife?.toLowerCase().includes(q) ||
          e.culturalContext?.event?.toLowerCase().includes(q)
      )
    : timeline;

  const filteredMembers = q
    ? familyMembers.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.relationship.toLowerCase().includes(q) ||
          m.partner?.toLowerCase().includes(q)
      )
    : familyMembers;

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
              placeholder="Search memories, people, places..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search memories, people, and places"
            />
            {searchQuery && (
              <button
                className="search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                &times;
              </button>
            )}
          </div>
          <div className="nav-avatar">
            <span>&#x1f464;</span>
          </div>
        </div>
      </nav>

      {/* ─── Main Content ─── */}
      <div className="app-layout">

        {/* Search results banner */}
        {q && (
          <div className="search-results-bar fade-in">
            <span>
              Found {filteredTimeline.length} {filteredTimeline.length === 1 ? 'memory' : 'memories'}
              {filteredMembers.length !== familyMembers.length && `, ${filteredMembers.length} family members`}
              {' '}matching "{searchQuery}"
            </span>
            <button className="search-clear-link" onClick={() => setSearchQuery('')}>Clear search</button>
          </div>
        )}

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
              <label className="btn-icon" title="Upload a family photo" aria-label="Upload a family photo" style={{ cursor: 'pointer' }}>
                &#x1f4f7;
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async () => {
                      const dataUrl = reader.result as string;
                      try {
                        const resp = await fetch('/api/upload-photo', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ image: dataUrl, title: file.name }),
                        });
                        const { url } = await resp.json();
                        const newPhoto: HistoricalPhoto = { url, title: file.name.replace(/[<>"'&]/g, '').replace(/\.[^.]+$/, ''), description: 'Family photo', source: 'upload' };
                        setLoosePhotos(prev => [...prev, newPhoto]);
                        setInitialLightboxPhoto(newPhoto);

                        // Analyse the photo with Gemini Vision (server-stored API key)
                        const sid = localStorage.getItem('hk_sessionId');
                        if (sid) fetch('/api/analyse-photo', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ image: dataUrl, sessionId: sid }),
                        }).then(r => r.json()).then(data => {
                          if (data.analysis) setPhotoAnalysis(data.analysis);
                        }).catch(() => {}); // Silent fail — analysis is optional
                      } catch {
                        setError('Failed to upload photo');
                      }
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
                {loosePhotos.length > 0 && (
                  <span className="photo-count-badge">{loosePhotos.length}</span>
                )}
              </label>
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
          {isRecording && (
            <div className="recording-indicator fade-in">
              <div className="waveform-bars">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.05}s` }} />
                ))}
              </div>
              <span className="recording-label">Listening... tap the mic button when finished</span>
            </div>
          )}
        </div>

        {/* Photo analysis */}
        {photoAnalysis && (
          <div className="photo-analysis fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--primary)' }}>&#x1f4f7; Photo Analysis</p>
              <button onClick={() => setPhotoAnalysis(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }} aria-label="Dismiss photo analysis">&times;</button>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{photoAnalysis}</p>
          </div>
        )}

        {/* Agent interaction area */}
        {(agentText || conversation.length > 0) && (
          <div style={{ marginBottom: 20 }}>
            {agentText && (
              <div className="agent-response fade-in">
                <p>{agentText}</p>
              </div>
            )}
            <ConversationThread messages={conversation} />
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
        {viewingMember && (() => {
          const member = familyMembers.find(m => m.name.toLowerCase() === viewingMember.toLowerCase());
          if (!member) return null;
          return (
            <MemberDetail
              member={member}
              timeline={timeline}
              onBack={() => setViewingMember(null)}
              onSetProfilePhoto={handleSetProfilePhoto}
            />
          );
        })()}

        {!viewingMember && activeView === 'timeline' && (
          <HeritageKeeper
            timeline={filteredTimeline}
            familyMembers={filteredMembers}
            loosePhotos={loosePhotos}
            onViewTree={() => setActiveView('tree')}
            onViewMember={(name) => setViewingMember(name)}
            onPromptClick={(prompt) => sendText(prompt)}
            onUpdatePhoto={handleUpdatePhoto}
            onDeletePhoto={handleDeletePhoto}
            initialLightboxPhoto={initialLightboxPhoto}
          />
        )}

        {!viewingMember && activeView === 'tree' && (
          <FamilyTree
            members={filteredMembers}
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

        {!viewingMember && activeView === 'share' && (
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
