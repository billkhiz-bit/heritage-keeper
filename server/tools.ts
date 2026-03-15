// Agent tool declarations and implementations
import { Type } from '@google/genai';
import { HeritageState, TimelineEntry } from './state.js';
import { searchMultipleQueries, WikiPhoto } from './wikimedia.js';

// ─── Function declarations for Gemini ──────────────────────────────────

export const toolDeclarations = [
  {
    name: 'save_story',
    description:
      'Save a family memory/story to the heritage timeline. Call this EVERY TIME the user shares a memory, even a brief one. Extract as much detail as possible.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        year: {
          type: Type.STRING,
          description: "Estimated year or decade (e.g. '1960s', '1985', 'early 1970s')",
        },
        title: {
          type: Type.STRING,
          description: 'Evocative title, max 6 words',
        },
        summary: {
          type: Type.STRING,
          description: 'One sentence capturing the heart of this memory',
        },
        location: {
          type: Type.STRING,
          description: "Place mentioned or implied (e.g. 'Lahore, Pakistan', 'Tooting, South London')",
        },
        then_description: {
          type: Type.STRING,
          description: '2 vivid sentences painting what the scene looked like AT THE TIME',
        },
        now_description: {
          type: Type.STRING,
          description: '2 sentences describing how the SAME place looks TODAY',
        },
        people: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Names or relations mentioned in the story',
        },
        historical_facts: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '3 fascinating facts about the place or era giving context',
        },
        cost_of_living: {
          type: Type.STRING,
          description: 'Specific prices from that era and place — e.g. "Average house: £2,500. Weekly wage: £15. Pint of milk: 4d". Use the local currency.',
        },
        daily_life: {
          type: Type.STRING,
          description: 'What everyday life looked like — e.g. "No central heating, coal fires, outside toilets, families shared one telephone". Be vivid and specific.',
        },
        event: {
          type: Type.STRING,
          description: 'A major world or local event happening around that time',
        },
        photo_queries: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            'Five Wikimedia Commons search queries for historical photographs: 1) city + decade street view, 2) nearby landmark, 3) daily life scene, 4) neighbourhood/district, 5) broader regional scene',
        },
        grounding_sources: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            'URLs or source references that ground the historical facts (from Google Search results if available)',
        },
        story_text: {
          type: Type.STRING,
          description: 'The original text the user shared (verbatim or close paraphrase)',
        },
      },
      required: ['year', 'title', 'summary', 'story_text'],
    },
  },
  {
    name: 'search_photos',
    description:
      'Search Wikimedia Commons for historical photographs of a specific place and time period. Use this when you want to find more images for a story.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        queries: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            'Search queries for Wikimedia Commons (e.g. ["Lahore 1960s street", "Badshahi Mosque historical"])',
        },
      },
      required: ['queries'],
    },
  },
  {
    name: 'add_family_member',
    description:
      'Add a family member to the heritage family tree. Call this for every person mentioned in stories.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Person's name or title (e.g. 'Grandfather Khizar', 'Ammi', 'Uncle Rashid')",
        },
        relationship: {
          type: Type.STRING,
          description: "Relationship to the storyteller (e.g. 'paternal grandfather', 'mother')",
        },
        generation: {
          type: Type.NUMBER,
          description:
            'Generation number: -3=great-grandparents, -2=grandparents, -1=parents/aunts/uncles, 0=self/siblings/cousins, 1=children, 2=grandchildren',
        },
        partner: {
          type: Type.STRING,
          description: 'Spouse/partner name if known',
        },
      },
      required: ['name', 'relationship', 'generation'],
    },
  },
  {
    name: 'get_family_tree',
    description:
      'Retrieve the current family tree to see which members have been identified so far.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_timeline',
    description:
      'Retrieve the current timeline of saved stories to see what has been shared so far.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];

// ─── Tool execution ─────────────────────────────────────────────────────

export type ToolResult = {
  result: any;
  uiEvent?: {
    type: 'story_saved' | 'photos_found' | 'member_added' | 'tree_updated' | 'timeline_updated';
    data: any;
  };
};

export async function executeTool(
  name: string,
  args: Record<string, any>,
  state: HeritageState
): Promise<ToolResult> {
  switch (name) {
    case 'save_story': {
      const entry: TimelineEntry = {
        id: Date.now().toString(),
        year: args.year || 'Unknown',
        title: args.title || 'A Memory',
        summary: args.summary || '',
        location: args.location || '',
        thenDescription: args.then_description || '',
        nowDescription: args.now_description || '',
        people: args.people || [],
        historicalFacts: args.historical_facts || [],
        culturalContext: {
          costOfLiving: args.cost_of_living || '',
          dailyLife: args.daily_life || '',
          event: args.event || '',
        },
        photos: [],
        storyText: args.story_text || '',
        groundingSources: args.grounding_sources || [],
      };

      state.addStory(entry);

      // Search for photos asynchronously
      const photoQueries: string[] = args.photo_queries || [];
      let photos: WikiPhoto[] = [];
      if (photoQueries.length > 0) {
        photos = await searchMultipleQueries(photoQueries, 2);
        state.addPhotosToEntry(entry.id, photos.slice(0, 8));
        entry.photos = photos.slice(0, 8);
      }

      // Check which people match existing family members
      const linkedMembers: string[] = [];
      const newPeople: string[] = [];
      for (const person of entry.people) {
        const key = person.toLowerCase();
        const match = [...state.familyMembers.values()].find(
          (m) => m.name.toLowerCase() === key || m.name.toLowerCase().includes(key) || key.includes(m.name.toLowerCase())
        );
        if (match) {
          linkedMembers.push(`${match.name} (${match.relationship})`);
        } else {
          newPeople.push(person);
        }
      }

      return {
        result: {
          status: 'saved',
          id: entry.id,
          photoCount: photos.length,
          linkedMembers,
          newPeople,
          message: `Story "${entry.title}" saved. ${linkedMembers.length > 0 ? `Linked to: ${linkedMembers.join(', ')}.` : ''} ${photos.length} photographs found.`,
        },
        uiEvent: {
          type: 'story_saved',
          data: { ...entry, photos: photos.slice(0, 8), linkedMembers, newPeople },
        },
      };
    }

    case 'search_photos': {
      const queries: string[] = args.queries || [];
      const photos = await searchMultipleQueries(queries, 3);
      return {
        result: {
          photoCount: photos.length,
          photos: photos.slice(0, 8).map((p) => ({ title: p.title, url: p.url })),
          message: `Found ${photos.length} historical photographs.`,
        },
        uiEvent: {
          type: 'photos_found',
          data: photos.slice(0, 8),
        },
      };
    }

    case 'add_family_member': {
      const member = state.addFamilyMember(
        args.name,
        args.relationship,
        args.generation,
        args.partner
      );
      return {
        result: {
          status: 'added',
          member,
          treeSize: state.familyMembers.size,
          message: `${member.name} (${member.relationship}) added to the family tree. Tree now has ${state.familyMembers.size} members.`,
        },
        uiEvent: {
          type: 'member_added',
          data: member,
        },
      };
    }

    case 'get_family_tree': {
      const tree = state.getFamilyTree();
      return {
        result: {
          members: tree,
          count: tree.length,
          message:
            tree.length === 0
              ? 'The family tree is empty. Ask the storyteller about their family members.'
              : `Family tree has ${tree.length} members: ${tree.map((m) => m.name).join(', ')}.`,
        },
        uiEvent: {
          type: 'tree_updated',
          data: tree,
        },
      };
    }

    case 'get_timeline': {
      const timeline = state.getTimeline();
      return {
        result: {
          entries: timeline.map((e) => ({
            year: e.year,
            title: e.title,
            summary: e.summary,
            location: e.location,
          })),
          count: timeline.length,
          message:
            timeline.length === 0
              ? 'No stories saved yet.'
              : `Timeline has ${timeline.length} stories spanning from ${timeline[0].year} to ${timeline[timeline.length - 1].year}.`,
        },
        uiEvent: {
          type: 'timeline_updated',
          data: timeline,
        },
      };
    }

    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}
