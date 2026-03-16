// In-memory state for a single Heritage Keeper session, with Firestore persistence
import { getDb } from './firebase.js';

export interface FamilyMemberData {
  name: string;
  relationship: string;
  generation: number; // -3 great-grandparents ... 0 self ... +2 grandchildren
  partner?: string;
  storyCount: number;
}

export interface HistoricalPhoto {
  url: string;
  title: string;
  description: string;
  notes?: string;
  dateTaken?: string;
  peopleInPhoto?: string[];
  source?: 'wikimedia' | 'upload';
}

export interface TimelineEntry {
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
  groundingSources: string[];
}

export class HeritageState {
  timeline: TimelineEntry[] = [];
  familyMembers: Map<string, FamilyMemberData> = new Map();
  private sessionId: string;

  constructor(sessionId?: string) {
    this.sessionId =
      sessionId ||
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  getSessionId(): string {
    return this.sessionId;
  }

  /** Persist current state to Firestore (fire-and-forget). */
  private persist(): void {
    try {
      const db = getDb();
      db.collection('sessions')
        .doc(this.sessionId)
        .set(
          {
            timeline: this.timeline,
            familyMembers: this.getFamilyTree(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        )
        .catch((err: Error) => {
          console.error('[DB] Failed to persist:', err.message);
        });
    } catch (err) {
      console.error('[DB] Failed to persist:', (err as Error).message);
    }
  }

  /** Load existing session data from Firestore. */
  async load(): Promise<void> {
    try {
      const db = getDb();
      const doc = await db.collection('sessions').doc(this.sessionId).get();
      if (doc.exists) {
        const data = doc.data()!;
        this.timeline = data.timeline || [];
        this.familyMembers = new Map();
        for (const member of data.familyMembers || []) {
          this.familyMembers.set(member.name.toLowerCase(), member);
        }
        console.log(
          `[DB] Loaded session ${this.sessionId}: ${this.timeline.length} stories, ${this.familyMembers.size} members`
        );
      }
    } catch (err) {
      console.error('[DB] Failed to load:', (err as Error).message);
    }
  }

  addStory(entry: TimelineEntry): TimelineEntry {
    this.timeline.push(entry);
    this.persist();
    return entry;
  }

  addFamilyMember(
    name: string,
    relationship: string,
    generation: number,
    partner?: string
  ): FamilyMemberData {
    const key = name.toLowerCase();
    if (this.familyMembers.has(key)) {
      const existing = this.familyMembers.get(key)!;
      existing.storyCount++;
      if (partner && !existing.partner) existing.partner = partner;
      this.persist();
      return existing;
    }
    const member: FamilyMemberData = {
      name,
      relationship,
      generation,
      partner,
      storyCount: 1,
    };
    this.familyMembers.set(key, member);
    this.persist();
    return member;
  }

  getFamilyTree(): FamilyMemberData[] {
    return [...this.familyMembers.values()];
  }

  getTimeline(): TimelineEntry[] {
    return [...this.timeline].sort(
      (a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0)
    );
  }

  addPhotosToEntry(entryId: string, photos: HistoricalPhoto[]): void {
    const entry = this.timeline.find((e) => e.id === entryId);
    if (entry) {
      const existingUrls = new Set(entry.photos.map((p) => p.url));
      const newPhotos = photos.filter((p) => !existingUrls.has(p.url));
      entry.photos.push(...newPhotos);
      this.persist();
    }
  }

  exportJSON(): string {
    return JSON.stringify(
      {
        timeline: this.timeline,
        familyMembers: this.getFamilyTree(),
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }
}
