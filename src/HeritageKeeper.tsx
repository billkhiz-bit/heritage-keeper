import React, { useState, useEffect } from 'react';
import { FamilyMember } from './FamilyTree';

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
  linkedMembers?: string[];
  newPeople?: string[];
}

interface Props {
  timeline: TimelineEntry[];
  familyMembers: FamilyMember[];
  loosePhotos: HistoricalPhoto[];
  onViewTree: () => void;
  onViewMember?: (name: string) => void;
  onPromptClick?: (prompt: string) => void;
  onUpdatePhoto?: (photo: HistoricalPhoto) => void;
  onDeletePhoto?: (photo: HistoricalPhoto) => void;
  initialLightboxPhoto?: HistoricalPhoto | null;
  hasStartedConversation?: boolean;
}

const AVATAR_COLOURS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#8b5cf6', '#0891b2', '#65a30d', '#c026d3', '#ea580c',
];

function getAvatarColour(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length];
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const ONBOARDING_PROMPTS = [
  "Tell me about your grandparents - where they came from, what they did...",
  "What was your childhood home like? Describe the neighbourhood...",
  "What's a family recipe or tradition that's been passed down?",
];

const HeritageKeeper: React.FC<Props> = ({ timeline, familyMembers, loosePhotos, onViewTree, onViewMember, onPromptClick, onUpdatePhoto, onDeletePhoto, initialLightboxPhoto, hasStartedConversation }) => {
  const [lightboxPhoto, setLightboxPhoto] = useState<HistoricalPhoto | null>(null);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPeople, setEditPeople] = useState('');

  useEffect(() => {
    if (initialLightboxPhoto) setLightboxPhoto(initialLightboxPhoto);
  }, [initialLightboxPhoto]);

  useEffect(() => {
    if (lightboxPhoto) {
      setEditNotes(lightboxPhoto.notes || '');
      setEditDate(lightboxPhoto.dateTaken || '');
      setEditPeople(lightboxPhoto.peopleInPhoto?.join(', ') || '');
    }
  }, [lightboxPhoto]);

  // Show newest entries first (by creation time — id is Date.now())
  const allEntries = [...timeline].sort(
    (a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0)
  );

  // Filter by location if active
  const sortedEntries = locationFilter
    ? allEntries.filter((e) => e.location === locationFilter)
    : allEntries;

  const allLocations = [...new Set(timeline.map((e) => e.location).filter(Boolean))];

  // Count entries per location
  const locationCounts = new Map<string, number>();
  timeline.forEach((e) => { if (e.location) locationCounts.set(e.location, (locationCounts.get(e.location) || 0) + 1); });

  const latestEntry = allEntries.length > 0 ? allEntries[0] : null;

  // Auto-suggest family members when typing in the "Who is in this photo?" field
  const peopleSuggestions = editPeople.trim()
    ? familyMembers.filter(m => {
        const typed = editPeople.split(',').pop()?.trim().toLowerCase() || '';
        return typed.length >= 2 && m.name.toLowerCase().includes(typed) && !editPeople.toLowerCase().includes(m.name.toLowerCase());
      })
    : [];

  // Render a photo grid (clickable → lightbox)
  const renderPhotoGrid = (photos: HistoricalPhoto[]) => (
    <div>
      <div className="photo-grid">
        {photos.map((photo, i) => (
          <button
            key={i}
            className="photo-grid-item"
            onClick={() => setLightboxPhoto(photo)}
            aria-label={`View photo: ${photo.title}`}
          >
            <img
              src={photo.url}
              alt={photo.title}
              className="photo-grid-img"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
            />
            {photo.title && <span className="entry-photo-caption">{photo.title}</span>}
          </button>
        ))}
      </div>
      <p className="photo-credit">Historical photos - Wikimedia Commons. Click to enlarge.</p>
    </div>
  );

  return (
    <div className="two-col">
      {/* ─── Lightbox Modal ─── */}
      {lightboxPhoto && (
        <div className="lightbox-overlay" onClick={() => setLightboxPhoto(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightboxPhoto(null)} aria-label="Close photo">&times;</button>
            <img src={lightboxPhoto.url} alt={lightboxPhoto.title} className="lightbox-img" />
            <div className="lightbox-info">
              <h4>{lightboxPhoto.title}</h4>
              {lightboxPhoto.description && lightboxPhoto.description !== 'Family photo' && (
                <p>{lightboxPhoto.description}</p>
              )}
              {lightboxPhoto.source !== 'upload' && (
                <p className="lightbox-source">Source: Wikimedia Commons</p>
              )}
            </div>
            <div className="lightbox-notes-form">
              <textarea
                className="lightbox-field notes"
                placeholder="Add notes about this photo..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="lightbox-field"
                  type="text"
                  placeholder="When was this taken?"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  className="lightbox-field"
                  type="text"
                  placeholder="Who is in this photo? (comma separated)"
                  value={editPeople}
                  onChange={(e) => setEditPeople(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              {peopleSuggestions.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {peopleSuggestions.slice(0, 5).map((m, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const parts = editPeople.split(',').map(s => s.trim()).filter(Boolean);
                        parts.pop(); // remove partial match
                        parts.push(m.name);
                        setEditPeople(parts.join(', ') + ', ');
                      }}
                      style={{
                        padding: '3px 10px', borderRadius: 20, border: '1px solid var(--primary-mid)',
                        background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 12,
                        fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
                      }}
                      aria-label={`Add ${m.name} to photo`}
                    >
                      + {m.name} ({m.relationship})
                    </button>
                  ))}
                </div>
              )}
              <div className="lightbox-actions">
                <button
                  className="lightbox-delete-btn"
                  onClick={() => {
                    if (window.confirm('Remove this photo?')) {
                      onDeletePhoto?.(lightboxPhoto);
                      setLightboxPhoto(null);
                    }
                  }}
                >
                  Remove photo
                </button>
                <button
                  className="lightbox-save-btn"
                  onClick={() => {
                    onUpdatePhoto?.({
                      ...lightboxPhoto,
                      notes: editNotes.trim() || undefined,
                      dateTaken: editDate.trim() || undefined,
                      peopleInPhoto: editPeople.trim() ? editPeople.split(',').map(s => s.trim()).filter(Boolean) : undefined,
                    });
                    setLightboxPhoto(null);
                  }}
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Column: Timeline ─── */}
      <div>
        {/* Loose photos from search_photos tool */}
        {loosePhotos.length > 0 && (
          <div className="photos-strip fade-in">
            {renderPhotoGrid(loosePhotos)}
          </div>
        )}

        {/* Places bar — clickable filters */}
        {allLocations.length > 0 && (
          <div className="places-bar">
            <span className="places-label">Places:</span>
            {locationFilter && (
              <button
                className="place-tag place-tag-clear"
                onClick={() => setLocationFilter(null)}
              >
                All &times;
              </button>
            )}
            {allLocations.map((l, i) => (
              <button
                key={i}
                className={`place-tag ${locationFilter === l ? 'place-tag-active' : ''}`}
                onClick={() => setLocationFilter(locationFilter === l ? null : l)}
              >
                {l} ({locationCounts.get(l) || 0})
              </button>
            ))}
          </div>
        )}

        {/* Timeline */}
        {sortedEntries.length > 0 ? (
          <div>
            <div className="timeline-header">
              <span className="timeline-title">
                Family Timeline - {sortedEntries.length} {sortedEntries.length === 1 ? 'Memory' : 'Memories'}
              </span>
            </div>

            <div className="timeline-track">
              <div className="timeline-line" />

              {sortedEntries.map((entry) => (
                <div key={entry.id} className="entry-card fade-in">
                  <div className="entry-dot" />

                  <div className="entry-inner">
                    {/* Photos — grid layout */}
                    {entry.photos && entry.photos.length > 0 && renderPhotoGrid(entry.photos)}

                    {/* Linked members notification */}
                    {entry.linkedMembers && entry.linkedMembers.length > 0 && (
                      <div className="linked-members-bar">
                        <span className="linked-icon">&#x1f517;</span>
                        Linked to: {entry.linkedMembers.join(', ')}
                      </div>
                    )}

                    {/* Then vs Now */}
                    {(entry.thenDescription || entry.nowDescription) && (
                      <div className="then-now">
                        {entry.thenDescription && (
                          <div className="then-col">
                            <p className="then-now-label">Then - {entry.year}</p>
                            <p className="then-now-text">{entry.thenDescription}</p>
                          </div>
                        )}
                        {entry.nowDescription && (
                          <div className="now-col">
                            <p className="then-now-label">Now</p>
                            <p className="then-now-text">{entry.nowDescription}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Location */}
                    {entry.location && (
                      <div className="entry-location">
                        <span className="entry-location-name">&#x1f4cd; {entry.location}</span>
                        <a
                          href={`https://www.google.com/maps/search/${encodeURIComponent(entry.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="entry-location-link"
                        >
                          View on Map
                        </a>
                      </div>
                    )}

                    {/* Content */}
                    <div className="entry-content">
                      <div className="entry-meta">
                        <span className="entry-year">{entry.year}</span>
                        {entry.people && entry.people.length > 0 && (
                          <div className="entry-people">
                            {entry.people.map((p, i) => (
                              <span key={i} className="person-tag">
                                <span className="person-tag-dot" />
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <h3 className="entry-title">{entry.title}</h3>
                      <p className="entry-summary">{entry.summary}</p>

                      {/* Cultural context — Cost of Living, Daily Life, Events */}
                      {(entry.culturalContext?.costOfLiving || entry.culturalContext?.dailyLife || entry.culturalContext?.event) && (
                        <div className="cultural-row">
                          {entry.culturalContext.costOfLiving && (
                            <div className="cultural-pill cost">
                              <p className="cultural-pill-label">&#x1f4b7; Cost of Living</p>
                              <p className="cultural-pill-text">{entry.culturalContext.costOfLiving}</p>
                            </div>
                          )}
                          {entry.culturalContext.dailyLife && (
                            <div className="cultural-pill daily">
                              <p className="cultural-pill-label">&#x1f3e0; Daily Life</p>
                              <p className="cultural-pill-text">{entry.culturalContext.dailyLife}</p>
                            </div>
                          )}
                          {entry.culturalContext.event && (
                            <div className="cultural-pill event">
                              <p className="cultural-pill-label">&#x1f30d; Event</p>
                              <p className="cultural-pill-text">{entry.culturalContext.event}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Historical facts */}
                      {entry.historicalFacts && entry.historicalFacts.length > 0 && (
                        <div className="facts-section">
                          <p className="facts-label">Historical Context</p>
                          {entry.historicalFacts.map((fact, i) => (
                            <div key={i} className="fact-item">{fact}</div>
                          ))}
                        </div>
                      )}

                      {entry.groundingSources && entry.groundingSources.length > 0 && (
                        <div className="sources-section">
                          <p className="facts-label">Sources</p>
                          {entry.groundingSources.map((source, i) => {
                            const isUrl = source.startsWith('http://') || source.startsWith('https://');
                            let label = source;
                            try {
                              if (isUrl) label = new URL(source).hostname.replace('www.', '');
                            } catch {
                              // Not a valid URL
                            }
                            return isUrl ? (
                              <a key={i} href={source} target="_blank" rel="noopener noreferrer" className="source-link">{label}</a>
                            ) : (
                              <span key={i} className="source-link" style={{ cursor: 'default' }}>{label}</span>
                            );
                          })}
                        </div>
                      )}

                      <details className="story-details">
                        <summary>What you told me</summary>
                        <p>"{entry.storyText}"</p>
                      </details>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : timeline.length > 0 && sortedEntries.length === 0 ? (
          <div className="empty-state">
            <h3>No matching memories</h3>
            <p>
              No memories match your current search or filter.
              Try a different search term or clear the location filter.
            </p>
          </div>
        ) : (
          <div className="empty-state">
            {hasStartedConversation ? (
              <>
                <div className="empty-state-icon" style={{ fontSize: 48 }}>&#x1f4ac;</div>
                <h3>Heritage Keeper is listening...</h3>
                <p>Your story is being preserved. The timeline will appear shortly.</p>
              </>
            ) : (
              <>
                <div className="empty-state-icon">&#x1f4d6;</div>
                <h3>Your Family Story Starts Here</h3>
                <p>
                  Share a family memory by speaking or typing above.
                  The Heritage Keeper will find period photographs, build your family tree,
                  and create an illustrated timeline.
                </p>
                {onPromptClick && (
                  <div className="onboarding-prompts fade-in">
                    {ONBOARDING_PROMPTS.map((prompt, i) => (
                      <button
                        key={i}
                        className="onboarding-card"
                        onClick={() => onPromptClick(prompt)}
                        aria-label={`Try prompt: ${prompt}`}
                      >
                        <span className="onboarding-label">Try this</span>
                        <p className="onboarding-text">{prompt}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Sidebar ─── */}
      <aside className="sidebar">
        {/* Heritage Span card */}
        {allEntries.length >= 2 && (() => {
          const byYear = [...allEntries].sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
          const earliest = byYear[0];
          const latest = byYear[byYear.length - 1];
          const span = (parseInt(latest.year) || 0) - (parseInt(earliest.year) || 0);
          return (
            <div className="sidebar-card fade-in">
              <h4 className="sidebar-card-title purple">&#x23f3; Heritage Span</h4>
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>{span > 0 ? `${span} years` : '\u2014'}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>of family history preserved</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, padding: 12, background: '#fffbeb', borderRadius: 'var(--radius-sm)', border: '1px solid #fcd34d' }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: '#b45309', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>Earliest</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{earliest.year}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{earliest.title}</p>
                </div>
                <div style={{ flex: 1, padding: 12, background: '#eff6ff', borderRadius: 'var(--radius-sm)', border: '1px solid #93c5fd' }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 }}>Latest</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{latest.year}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{latest.title}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Historical Context card */}
        {latestEntry && (
          <div className="sidebar-card fade-in">
            <h4 className="sidebar-card-title purple">&#x1f4dc; Historical Context</h4>

            {latestEntry.historicalFacts && latestEntry.historicalFacts.length > 0 && (
              <div className="context-section">
                <p className="context-section-title">Key Facts - {latestEntry.year}</p>
                {latestEntry.historicalFacts.map((fact, i) => (
                  <p key={i} className="context-section-text" style={{ marginBottom: 6 }}>{fact}</p>
                ))}
              </div>
            )}

            {latestEntry.culturalContext?.costOfLiving && (
              <div className="context-section">
                <p className="context-section-title">&#x1f4b7; Cost of Living</p>
                <p className="context-section-text">{latestEntry.culturalContext.costOfLiving}</p>
              </div>
            )}

            {latestEntry.culturalContext?.dailyLife && (
              <div className="context-section">
                <p className="context-section-title">&#x1f3e0; Daily Life</p>
                <p className="context-section-text">{latestEntry.culturalContext.dailyLife}</p>
              </div>
            )}

            {latestEntry.culturalContext?.event && (
              <div className="context-section">
                <p className="context-section-title">&#x1f30d; Global Events</p>
                <p className="context-section-text">{latestEntry.culturalContext.event}</p>
              </div>
            )}

            {!latestEntry.historicalFacts?.length && !latestEntry.culturalContext?.costOfLiving && (
              <p className="context-section-text">
                Historical context will appear here as you share memories from different time periods.
              </p>
            )}
          </div>
        )}

        {/* Family Members card */}
        <div className="sidebar-card">
          <h4 className="sidebar-card-title amber">
            &#x1f468;&#x200d;&#x1f469;&#x200d;&#x1f467;&#x200d;&#x1f466; Family Members
          </h4>

          {familyMembers.length > 0 ? (
            <div>
              {familyMembers.slice(0, 8).map((member, i) => (
                <div key={i} className="member-list-item">
                  <div className="member-list-left">
                    <div className="member-avatar" style={{ background: member.profilePhotoUrl ? 'transparent' : getAvatarColour(member.name) }}>
                      {member.profilePhotoUrl ? (
                        <img src={member.profilePhotoUrl} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      ) : (
                        getInitials(member.name)
                      )}
                    </div>
                    <div>
                      <p className="member-list-name">{member.name}</p>
                      <p className="member-list-rel">{member.relationship}</p>
                    </div>
                  </div>
                  <button className="member-view-link" onClick={() => onViewMember?.(member.name)}>Stories</button>
                </div>
              ))}
              {familyMembers.length > 8 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                  + {familyMembers.length - 8} more members
                </p>
              )}
            </div>
          ) : (
            <p className="context-section-text">
              Family members will appear here as you mention them in your stories.
            </p>
          )}

          <button className="invite-btn" onClick={onViewTree}>View Full Family Tree</button>
        </div>

        {/* Locations card */}
        {allLocations.length > 0 && (
          <div className="sidebar-card">
            <h4 className="sidebar-card-title purple">&#x1f4cd; Locations</h4>
            {allLocations.map((loc, i) => (
              <button
                key={i}
                className={`location-list-item ${locationFilter === loc ? 'active' : ''}`}
                onClick={() => setLocationFilter(locationFilter === loc ? null : loc)}
              >
                <span className="location-list-name">{loc}</span>
                <span className="location-list-count">{locationCounts.get(loc) || 0} {(locationCounts.get(loc) || 0) === 1 ? 'memory' : 'memories'}</span>
              </button>
            ))}
            {locationFilter && (
              <button
                className="invite-btn"
                onClick={() => setLocationFilter(null)}
                style={{ marginTop: 8 }}
              >
                Show All Locations
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
};

export default HeritageKeeper;
