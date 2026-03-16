import React, { useState } from 'react';

export interface FamilyMember {
  name: string;
  relationship: string;
  generation: number;
  partner?: string;
  storyCount: number;
  profilePhotoUrl?: string;
}

interface Props {
  members: FamilyMember[];
  onMemberClick?: (name: string) => void;
  onAddMember?: (member: FamilyMember) => void;
  onStoryStarter?: (prompt: string) => void;
}

const GENERATION_LABELS: Record<number, string> = {
  [-3]: 'Great-Grandparents',
  [-2]: 'Grandparents',
  [-1]: 'Parents',
  [0]: 'You & Siblings',
  [1]: 'Children',
  [2]: 'Grandchildren',
};

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

const STORY_STARTERS = [
  "Tell me about Grandma's first house...",
  "What was the funniest thing Uncle ever did?",
  "What recipe did Grandpa always make?",
  "Where did the family come from originally?",
  "What was school like for Mum/Dad?",
];

const FamilyTree: React.FC<Props> = ({ members, onMemberClick, onAddMember, onStoryStarter }) => {
  const [name, setName] = useState('');
  const [generation, setGeneration] = useState('-1');
  const [relationship, setRelationship] = useState('');

  const generations = new Map<number, FamilyMember[]>();
  members.forEach((m) => {
    const gen = m.generation;
    if (!generations.has(gen)) generations.set(gen, []);
    generations.get(gen)!.push(m);
  });
  const sortedGens = [...generations.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="tree-layout">
      {/* ─── Left Sidebar: Add Member + Story Starters ─── */}
      <div className="tree-sidebar">
        <div className="tree-form-title">
          <span>&#x2795;</span> Add Member
        </div>

        <div className="tree-field">
          <label htmlFor="tree-name">Full Name</label>
          <input
            id="tree-name"
            className="tree-input"
            type="text"
            placeholder="e.g. Martha Stewart"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="tree-field">
          <label htmlFor="tree-gen">Generation</label>
          <select
            id="tree-gen"
            className="tree-select"
            value={generation}
            onChange={(e) => setGeneration(e.target.value)}
          >
            <option value="-3">Great-Grandparents</option>
            <option value="-2">Grandparents</option>
            <option value="-1">Parents</option>
            <option value="0">You &amp; Siblings</option>
            <option value="1">Children</option>
            <option value="2">Grandchildren</option>
          </select>
        </div>

        <div className="tree-field">
          <label htmlFor="tree-rel">Relationship</label>
          <input
            id="tree-rel"
            className="tree-input"
            type="text"
            placeholder="Mother, Father, etc."
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            maxLength={50}
          />
        </div>

        <button
          className="tree-save-btn"
          disabled={!name.trim() || !relationship.trim() || name.trim().length > 100 || relationship.trim().length > 50}
          onClick={() => {
            if (onAddMember) {
              onAddMember({
                name: name.trim(),
                relationship: relationship.trim(),
                generation: parseInt(generation),
                storyCount: 0,
              });
            }
            setName('');
            setRelationship('');
          }}
        >
          &#x1f4be; Save to Tree
        </button>

        {/* Story starters */}
        <div className="story-starters">
          <div className="story-starters-title">
            <span>&#x1f4ac;</span> Story Starters
          </div>
          {STORY_STARTERS.map((prompt, i) => (
            <button
              key={i}
              className="story-starter-item"
              onClick={() => onStoryStarter?.(prompt)}
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main: Tree Visualisation ─── */}
      <div className="tree-main">
        {members.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🌳</div>
            <h3>Your Family Tree Starts Here</h3>
            <p>
              Share memories mentioning family members and the tree will build itself,
              or add members manually using the form on the left.
            </p>
            {onStoryStarter && (
              <button
                className="btn-post"
                onClick={() => onStoryStarter("My grandmother's name was...")}
                style={{ marginTop: 16 }}
              >
                Share a memory to get started
              </button>
            )}
          </div>
        ) : (
          <div>
            {sortedGens.map(([gen, genMembers], idx) => (
              <React.Fragment key={gen}>
                {idx > 0 && <div className="tree-connector" />}
                <div className="generation-section">
                  <p className="generation-label">
                    {GENERATION_LABELS[gen] || `Generation ${gen}`}
                  </p>
                  <div className="generation-members">
                    {genMembers.map((member, i) => (
                      <button
                        key={i}
                        className="tree-member-card"
                        onClick={() => onMemberClick?.(member.name)}
                        aria-label={`${member.name}, ${member.relationship}${member.storyCount > 0 ? `, ${member.storyCount} stories` : ''}`}
                      >
                        {member.storyCount > 0 && (
                          <span className="tree-member-stories">{member.storyCount}</span>
                        )}

                        <div
                          className="tree-member-avatar"
                          style={{ background: member.profilePhotoUrl ? 'transparent' : getAvatarColour(member.name) }}
                        >
                          {member.profilePhotoUrl ? (
                            <img src={member.profilePhotoUrl} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                          ) : (
                            getInitials(member.name)
                          )}
                        </div>

                        <p className="tree-member-name">{member.name}</p>
                        <p className="tree-member-rel">{member.relationship}</p>

                        {member.partner && (
                          <p className="tree-member-partner">
                            &amp; {member.partner}
                          </p>
                        )}

                        {member.storyCount > 0 && (
                          <p className="tree-member-stories-label">
                            {member.storyCount} {member.storyCount === 1 ? 'story' : 'stories'}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FamilyTree;
