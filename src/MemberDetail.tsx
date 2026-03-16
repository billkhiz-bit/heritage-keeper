import React from 'react';
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
  people: string[];
  photos: HistoricalPhoto[];
  [key: string]: any;
}

interface Props {
  member: FamilyMember;
  timeline: TimelineEntry[];
  onBack: () => void;
  onSetProfilePhoto?: (memberName: string, photoUrl: string) => void;
}

const MemberDetail: React.FC<Props> = ({ member, timeline, onBack, onSetProfilePhoto }) => {
  // Filter stories mentioning this member
  const memberStories = timeline.filter(
    (e) => e.people?.some((p) => {
      const key = p.toLowerCase();
      const name = member.name.toLowerCase();
      return key === name || key.includes(name) || name.includes(key);
    })
  );

  // Collect all photos from their stories
  const memberPhotos = memberStories.flatMap((e) => e.photos || []);

  return (
    <div style={{ maxWidth: 800 }}>
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', color: 'var(--primary)',
          fontWeight: 700, cursor: 'pointer', fontSize: 14, marginBottom: 16,
          fontFamily: 'var(--font)', padding: 0,
        }}
      >
        &larr; Back to timeline
      </button>

      {/* Member profile card */}
      <div className="sidebar-card" style={{ marginBottom: 24, display: 'flex', gap: 20, alignItems: 'center' }}>
        <div
          style={{
            width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: member.profilePhotoUrl ? 'transparent' : 'var(--primary)',
            color: 'white', fontWeight: 800, fontSize: 28,
          }}
        >
          {member.profilePhotoUrl ? (
            <img src={member.profilePhotoUrl} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            member.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
          )}
        </div>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-serif)', marginBottom: 4 }}>{member.name}</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>{member.relationship}</p>
          {member.partner && <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Partner: {member.partner}</p>}
          <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginTop: 8 }}>
            {memberStories.length} {memberStories.length === 1 ? 'memory' : 'memories'} &middot; {memberPhotos.length} photos
          </p>
        </div>
      </div>

      {/* Photos grid */}
      {memberPhotos.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--primary)', marginBottom: 12 }}>Photos</h3>
          <div className="photo-grid">
            {memberPhotos.map((photo, i) => (
              <button
                key={i}
                className="photo-grid-item"
                onClick={() => onSetProfilePhoto?.(member.name, photo.url)}
                aria-label={`Set ${photo.title} as profile photo for ${member.name}`}
                title="Click to set as profile photo"
              >
                <img src={photo.url} alt={photo.title} className="photo-grid-img"
                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                {photo.title && <span className="entry-photo-caption">{photo.title}</span>}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Click a photo to set it as {member.name}'s profile picture</p>
        </div>
      )}

      {/* Stories list */}
      {memberStories.length > 0 ? (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--primary)', marginBottom: 12 }}>Memories</h3>
          {memberStories.map((entry) => (
            <div key={entry.id} className="entry-inner" style={{ marginBottom: 16 }}>
              <div className="entry-content">
                <div className="entry-meta">
                  <span className="entry-year">{entry.year}</span>
                  {entry.location && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>&#x1f4cd; {entry.location}</span>}
                </div>
                <h3 className="entry-title">{entry.title}</h3>
                <p className="entry-summary">{entry.summary}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>No memories yet for {member.name}</h3>
          <p>Share stories about {member.name} and they'll appear here.</p>
        </div>
      )}
    </div>
  );
};

export default MemberDetail;
