import type { OpenRouterProvider } from './openrouter';
import type { StoryEntry, Character, Location, Item, StoryBeat } from '$lib/types';
import { settings } from '$lib/stores/settings.svelte';

const DEBUG = true;

function log(...args: any[]) {
  if (DEBUG) {
    console.log('[ActionChoices]', ...args);
  }
}

export interface ActionChoice {
  text: string;           // The action text (what the player would do)
  type: 'action' | 'dialogue' | 'examine' | 'move';
  icon?: string;          // Optional icon hint for UI
}

export interface ActionChoicesResult {
  choices: ActionChoice[];
}

interface WorldStateContext {
  characters: Character[];
  locations: Location[];
  items: Item[];
  storyBeats: StoryBeat[];
  currentLocation?: Location;
}

export class ActionChoicesService {
  private provider: OpenRouterProvider;

  constructor(provider: OpenRouterProvider) {
    this.provider = provider;
  }

  private get model(): string {
    // Use the same model as suggestions by default
    return settings.systemServicesSettings.suggestions.model;
  }

  private get temperature(): number {
    return 0.8; // Slightly higher for variety in choices
  }

  private get maxTokens(): number {
    return 500;
  }

  /**
   * Generate RPG-style action choices based on the current narrative moment.
   * These are presented as multiple choice options like in classic RPGs.
   */
  async generateChoices(
    recentEntries: StoryEntry[],
    worldState: WorldStateContext,
    narrativeResponse: string,
    pov?: 'first' | 'second' | 'third'
  ): Promise<ActionChoicesResult> {
    log('generateChoices called', {
      recentEntriesCount: recentEntries.length,
      narrativeLength: narrativeResponse.length,
      currentLocation: worldState.currentLocation?.name,
      presentCharacters: worldState.characters.filter(c => c.status === 'active').length,
    });

    // Build context from world state
    const currentLoc = worldState.currentLocation;
    const activeCharacters = worldState.characters.filter(c => c.status === 'active' && c.relationship !== 'self');
    const inventoryItems = worldState.items.filter(i => i.location === 'inventory');
    const activeQuests = worldState.storyBeats.filter(b => b.status === 'active' || b.status === 'pending');

    // Get last few entries for immediate context
    const lastEntries = recentEntries.slice(-3);
    const recentContext = lastEntries.map(e => {
      const prefix = e.type === 'user_action' ? '[ACTION]' : '[NARRATIVE]';
      return `${prefix} ${e.content.substring(0, 300)}${e.content.length > 300 ? '...' : ''}`;
    }).join('\n');

    // Determine POV instruction for action phrasing
    let povInstruction: string;
    if (pov === 'first') {
      povInstruction = 'Write actions in first person (e.g., "I examine the door", "I ask the merchant about...")';
    } else if (pov === 'third') {
      povInstruction = 'Write actions as commands/intentions (e.g., "Examine the door", "Ask the merchant about...")';
    } else {
      povInstruction = 'Write actions in second person imperative or first person (e.g., "Examine the door", "I ask the merchant about...")';
    }

    const prompt = `Based on the current story moment, generate 3-4 RPG-style action choices for the player.

## Current Narrative
"""
${narrativeResponse.substring(0, 800)}${narrativeResponse.length > 800 ? '...' : ''}
"""

## Recent Context
${recentContext}

## Current Scene
Location: ${currentLoc?.name || 'Unknown'}${currentLoc?.description ? ` - ${currentLoc.description}` : ''}
Characters Present: ${activeCharacters.length > 0 ? activeCharacters.map(c => c.name).join(', ') : 'None mentioned'}
Inventory: ${inventoryItems.length > 0 ? inventoryItems.map(i => i.name).join(', ') : 'Empty'}
Active Quests: ${activeQuests.length > 0 ? activeQuests.map(q => q.title).join(', ') : 'None'}

## Your Task
Generate 3-4 distinct action choices that make sense given the current moment. Think like an RPG:
- Include at least one physical action (examine, take, use, attack, etc.)
- If NPCs are present, include a dialogue option
- If there's an obvious next step or quest objective, include it
- Include an exploratory or cautious option

${povInstruction}

Keep each choice SHORT (under 10 words ideally, max 15). They should be clear, specific actions.

## Response Format (JSON only)
{
  "choices": [
    {"text": "Action text here", "type": "action|dialogue|examine|move"},
    {"text": "Action text here", "type": "action|dialogue|examine|move"},
    {"text": "Action text here", "type": "action|dialogue|examine|move"}
  ]
}

Types:
- action: Physical actions (fight, take, use, give, etc.)
- dialogue: Speaking to someone
- examine: Looking at or investigating something
- move: Going somewhere or leaving`;

    try {
      const response = await this.provider.generateResponse({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an RPG game master generating action choices for a player. Generate clear, concise action options that fit the current narrative moment. Always respond with valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      });

      const result = this.parseChoices(response.content);
      log('Choices generated:', result.choices.length);
      return result;
    } catch (error) {
      log('Choices generation failed:', error);
      return { choices: [] };
    }
  }

  private parseChoices(content: string): ActionChoicesResult {
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
      jsonStr = jsonStr.trim();

      const parsed = JSON.parse(jsonStr);
      const choices: ActionChoice[] = [];

      if (Array.isArray(parsed.choices)) {
        for (const c of parsed.choices.slice(0, 4)) {
          if (c.text) {
            choices.push({
              text: c.text,
              type: ['action', 'dialogue', 'examine', 'move'].includes(c.type)
                ? c.type
                : 'action',
            });
          }
        }
      }

      return { choices };
    } catch (e) {
      log('Failed to parse choices:', e);
      return { choices: [] };
    }
  }
}
