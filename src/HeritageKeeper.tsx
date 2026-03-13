import React from 'react';
import { FamilyMember } from './FamilyTree';

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

interface Props {
  timeline: TimelineEntry[];
  familyMembers: FamilyMember[];
  loosePhotos: HistoricalPhoto[];
  onViewTree: () => void;
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

const HeritageKeeper: React.FC<Props> = ({ timeline, familyMembers, loosePhotos, onViewTree }) => {
  const sortedEntries = [...timeline].sort(
    (a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0)
  );

  const allLocations = [...new Set(timeline.map((e) => e.location).filter(Boolean))];

  // Build a context summary from the most recent entry (for the sidebar)
  const latestEntry = sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1] : null;

  return (
    <div className="two-col">
      {/* ─── Main Column: Timeline ─── */}
      <div>
        {/* Loose photos from search_photos tool */}
        {loosePhotos.length > 0 && (
          <div className="photos-strip fade-in">
            <div className="photos-strip-row">
              {loosePhotos.map((photo, i) => (
                <div key={i} className="entry-photo-wrap" style={{ minWidth: '33%', flexShrink: 0 }}>
                  <img
                    src={photo.url}
                    alt={photo.title}
                    className="entry-photo"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {photo.title && <span className="entry-photo-caption">{photo.title}</span>}
                </div>
              ))}
            </div>
            <p className="photo-credit">Historical photos — Wikimedia Commons</p>
          </div>
        )}

        {/* Places bar */}
        {allLocations.length > 0 && (
          <div className="places-bar">
            <span className="places-label">Places:</span>
            {allLocations.map((l, i) => (
              <span key={i} className="place-tag">{l}</span>
            ))}
          </div>
        )}

        {/* Timeline */}
        {sortedEntries.length > 0 ? (
          <div>
            <div className="timeline-header">
              <span className="timeline-title">
                Family Timeline — {sortedEntries.length} {sortedEntries.length === 1 ? 'Memory' : 'Memories'}
              </span>
            </div>

            <div className="timeline-track">
              <div className="timeline-line" />

              {sortedEntries.map((entry) => (
                <div key={entry.id} className="entry-card fade-in">
                  <div className="entry-dot" />

                  <div className="entry-inner">
                    {/* Photos */}
                    {entry.photos && entry.photos.length > 0 && (
                      <div>
                        <div className="entry-photos">
                          {entry.photos.map((photo, i) => (
                            <div
                              key={i}
                              className="entry-photo-wrap"
                              style={{
                                minWidth: entry.photos.length <= 2 ? '50%' : '33%',
                                flexShrink: 0,
                              }}
                            >
                              <img
                                src={photo.url}
                                alt={photo.title}
                                className="entry-photo"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              {photo.title && (
                                <span className="entry-photo-caption">{photo.title}</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="photo-credit">Historical photos — Wikimedia Commons</p>
                      </div>
                    )}

                    {/* Then vs Now */}
                    {(entry.thenDescription || entry.nowDescription) && (
                      <div className="then-now">
                        {entry.thenDescription && (
                          <div className="then-col">
                            <p className="then-now-label">Then — {entry.year}</p>
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
                        <span className="entry-location-name">
                          &#x1f4cd; {entry.location}
                        </span>
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

                      {/* Cultural context */}
                      {(entry.culturalContext?.music || entry.culturalContext?.film || entry.culturalContext?.event) && (
                        <div className="cultural-row">
                          {entry.culturalContext.music && (
                            <div className="cultural-pill music">
                              <p className="cultural-pill-label">&#x1f3b5; Music</p>
                              <p className="cultural-pill-text">{entry.culturalContext.music}</p>
                            </div>
                          )}
                          {entry.culturalContext.film && (
                            <div className="cultural-pill film">
                              <p className="cultural-pill-label">&#x1f3ac; Film</p>
                              <p className="cultural-pill-text">{entry.culturalContext.film}</p>
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
        ) : (
          <div className="empty-state">
            <h3>No memories yet</h3>
            <p>
              Share a family memory by speaking or typing above.
              The Heritage Keeper will find period photographs, build your family tree,
              and create an illustrated timeline.
            </p>
          </div>
        )}
      </div>

      {/* ─── Sidebar ─── */}
      <aside className="sidebar">
        {/* Historical Context card */}
        {latestEntry && (
          <div className="sidebar-card fade-in">
            <h4 className="sidebar-card-title purple">
              &#x1f4dc; Historical Context
            </h4>

            {latestEntry.historicalFacts && latestEntry.historicalFacts.length > 0 && (
              <div className="context-section">
                <p className="context-section-title">Key Facts — {latestEntry.year}</p>
                {latestEntry.historicalFacts.map((fact, i) => (
                  <p key={i} className="context-section-text" style={{ marginBottom: 6 }}>
                    {fact}
                  </p>
                ))}
              </div>
            )}

            {latestEntry.culturalContext?.music && (
              <div className="context-section">
                <p className="context-section-title">&#x1f3b5; Music</p>
                <p className="context-section-text">{latestEntry.culturalContext.music}</p>
              </div>
            )}

            {latestEntry.culturalContext?.film && (
              <div className="context-section">
                <p className="context-section-title">&#x1f3ac; Film &amp; TV</p>
                <p className="context-section-text">{latestEntry.culturalContext.film}</p>
              </div>
            )}

            {latestEntry.culturalContext?.event && (
              <div className="context-section">
                <p className="context-section-title">&#x1f30d; Global Events</p>
                <p className="context-section-text">{latestEntry.culturalContext.event}</p>
              </div>
            )}

            {!latestEntry.historicalFacts?.length && !latestEntry.culturalContext?.music && (
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
                    <div
                      className="member-avatar"
                      style={{ background: getAvatarColour(member.name) }}
                    >
                      {getInitials(member.name)}
                    </div>
                    <div>
                      <p className="member-list-name">{member.name}</p>
                      <p className="member-list-rel">{member.relationship}</p>
                    </div>
                  </div>
                  <button className="member-view-link" onClick={onViewTree}>
                    View Tree
                  </button>
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

          <button className="invite-btn" onClick={onViewTree}>
            View Full Family Tree
          </button>
        </div>
      </aside>
    </div>
  );
};

export default HeritageKeeper;
