// In-memory state for a single Heritage Keeper session

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

  addStory(entry: TimelineEntry): TimelineEntry {
    this.timeline.push(entry);
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
