import React, { useState } from 'react';
import { FamilyMember } from './FamilyTree';

interface TimelineEntry {
  id: string;
  year: string;
  title: string;
  summary: string;
  location: string;
  people: string[];
  [key: string]: any;
}

interface Props {
  timeline: TimelineEntry[];
  familyMembers: FamilyMember[];
}

const ShareView: React.FC<Props> = ({ timeline, familyMembers }) => {
  const [copied, setCopied] = useState(false);

  const exportData = {
    exportedAt: new Date().toISOString(),
    heritageKeeper: true,
    version: '1.0',
    timeline,
    familyMembers,
    stats: {
      memories: timeline.length,
      familyMembers: familyMembers.length,
      locations: [...new Set(timeline.map((e) => e.location).filter(Boolean))].length,
    },
  };

  const handleExport = () => {
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heritage-keeper-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLink = () => {
    const encoded = btoa(JSON.stringify(exportData));
    const shortPreview = `Heritage Keeper: ${timeline.length} memories, ${familyMembers.length} family members`;
    navigator.clipboard.writeText(shortPreview).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const hasData = timeline.length > 0 || familyMembers.length > 0;

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        Share &amp; Collaborate
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.6 }}>
        Preserve your findings. Export your family history, or share a snapshot with relatives.
      </p>

      {/* Data Portability */}
      <div className="sidebar-card" style={{ marginBottom: 20 }}>
        <h4 className="sidebar-card-title purple">&#x1f4e6; Data Portability</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Export */}
          <div style={{
            padding: 20,
            background: 'var(--bg)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>Export Timeline</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              Download your complete family history as a portable JSON file.
              Perfect for backup or sharing.
            </p>
            <button
              className="btn-post"
              onClick={handleExport}
              disabled={!hasData}
              style={{ width: '100%' }}
            >
              &#x2B07; Download JSON
            </button>
          </div>

          {/* Copy Summary */}
          <div style={{
            padding: 20,
            background: 'var(--bg)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}>
            <p style={{ fontWeight: 700, marginBottom: 6 }}>Share Summary</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              Copy a summary of your family history to share with relatives
              via email or messaging.
            </p>
            <button
              className="btn-post"
              onClick={handleCopyLink}
              disabled={!hasData}
              style={{
                width: '100%',
                background: copied ? 'var(--success)' : undefined,
              }}
            >
              {copied ? '&#x2714; Copied!' : '&#x1f4cb; Copy Summary'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {hasData && (
        <div className="sidebar-card" style={{ marginBottom: 20 }}>
          <h4 className="sidebar-card-title amber">&#x1f4ca; Your Heritage</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, textAlign: 'center' }}>
            <div>
              <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>{timeline.length}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Memories</p>
            </div>
            <div>
              <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>{familyMembers.length}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Family Members</p>
            </div>
            <div>
              <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)' }}>
                {[...new Set(timeline.map((e) => e.location).filter(Boolean))].length}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Locations</p>
            </div>
          </div>
        </div>
      )}

      {/* How to Collaborate */}
      <div className="sidebar-card">
        <h4 className="sidebar-card-title purple">&#x1f91d; How to Collaborate</h4>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { step: '1', title: 'Record Memories', desc: 'Share stories by speaking or typing with the Heritage Keeper agent.' },
            { step: '2', title: 'Export & Share', desc: 'Use the JSON export to create a file, or copy the summary to share.' },
            { step: '3', title: 'Merge History', desc: 'Family members can record their own memories and combine timelines.' },
          ].map((item) => (
            <div key={item.step} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: 'var(--primary)',
                color: 'white', fontWeight: 800, fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
              }}>
                {item.step}
              </div>
              <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{item.title}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShareView;
