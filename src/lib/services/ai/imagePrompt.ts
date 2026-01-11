/**
 * Image Prompt Service
 *
 * Analyzes narrative text to identify visually striking moments for image generation.
 * Returns structured data including image prompts and source text for embedding.
 */

import { promptService } from '../prompts';
import type { OpenAIProvider } from './openrouter';
import type { Character } from '$lib/types';
import { buildExtraBody } from './requestOverrides';
import { settings } from '$lib/stores/settings.svelte';

/**
 * Represents a scene identified as suitable for image generation.
 */
export interface ImageableScene {
  /** The detailed prompt for image generation */
  prompt: string;
  /** Verbatim quote from narrative (for text matching) */
  sourceText: string;
  /** Type of scene */
  sceneType: 'action' | 'item' | 'character' | 'environment';
  /** Priority 1-10, higher = more important */
  priority: number;
}

/**
 * Context needed to analyze narrative for imageable scenes.
 */
export interface ImagePromptContext {
  /** The narrative text to analyze */
  narrativeResponse: string;
  /** The user action that triggered this narrative */
  userAction: string;
  /** Characters present in the scene with their visual descriptors */
  presentCharacters: Array<{
    name: string;
    visualDescriptors: string[];
  }>;
  /** Current location name */
  currentLocation?: string;
  /** The image style prompt to include */
  stylePrompt: string;
  /** Maximum number of images (0 = unlimited) */
  maxImages: number;
  /** Full chat history for comprehensive context */
  chatHistory?: string;
  /** Activated lorebook entries for world context */
  lorebookContext?: string;
}

/**
 * Service settings for image prompt generation.
 */
export interface ImagePromptSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  reasoningEffort?: 'off' | 'low' | 'medium' | 'high';
}

const DEFAULT_SETTINGS: ImagePromptSettings = {
  model: 'deepseek/deepseek-v3.2',
  temperature: 0.3,
  maxTokens: 2048,
  reasoningEffort: 'off',
};

/**
 * Service that identifies imageable scenes in narrative text.
 */
export class ImagePromptService {
  private provider: OpenAIProvider;
  private settings: ImagePromptSettings;
  private debug: boolean;

  constructor(
    provider: OpenAIProvider,
    settings: Partial<ImagePromptSettings> = {},
    debug = false
  ) {
    this.provider = provider;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.debug = debug;
  }

  /**
   * Analyze narrative text to identify visually striking moments.
   * @param context - The context for analysis
   * @returns Array of imageable scenes, sorted by priority (highest first)
   */
  async identifyScenes(context: ImagePromptContext): Promise<ImageableScene[]> {
    if (this.debug) {
      console.log('[ImagePrompt] Analyzing narrative for imageable scenes');
    }

    // Build character descriptors string
    const characterDescriptors = this.buildCharacterDescriptors(context.presentCharacters);

    const promptContext = {
      mode: 'adventure' as const,
      pov: 'second' as const,
      tense: 'present' as const,
      protagonistName: '',
    };

    // Build the system prompt with style and character info
    const systemPrompt = promptService.renderPrompt('image-prompt-analysis', promptContext, {
      imageStylePrompt: context.stylePrompt,
      characterDescriptors: characterDescriptors || 'No character visual descriptors available.',
      maxImages: context.maxImages === 0 ? '0 (unlimited)' : String(context.maxImages),
    });

    // Build the user prompt with full context
    const userPrompt = promptService.renderUserPrompt('image-prompt-analysis', promptContext, {
      narrativeResponse: context.narrativeResponse,
      userAction: context.userAction,
      chatHistory: context.chatHistory || '',
      lorebookContext: context.lorebookContext || '',
    });

    try {
      const imageSettings = settings.systemServicesSettings.imageGeneration;
      const extraBody = buildExtraBody({
        manualMode: settings.advancedRequestSettings.manualMode,
        manualBody: imageSettings.manualBody,
        reasoningEffort: this.settings.reasoningEffort ?? 'off',
        providerOnly: imageSettings.providerOnly,
      });

      const response = await this.provider.generateResponse({
        model: this.settings.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: this.settings.temperature,
        maxTokens: this.settings.maxTokens,
        extraBody,
      });

      const scenes = this.parseResponse(response.content);

      if (this.debug) {
        console.log(`[ImagePrompt] Found ${scenes.length} imageable scenes`);
      }

      // Sort by priority (highest first)
      return scenes.sort((a, b) => b.priority - a.priority);
    } catch (error) {
      console.error('[ImagePrompt] Failed to analyze narrative:', error);
      return [];
    }
  }

  /**
   * Build character descriptors string for the prompt.
   */
  private buildCharacterDescriptors(
    characters: Array<{ name: string; visualDescriptors: string[] }>
  ): string {
    if (!characters || characters.length === 0) {
      return '';
    }

    const descriptorLines = characters
      .filter(c => c.visualDescriptors && c.visualDescriptors.length > 0)
      .map(c => `- ${c.name}: ${c.visualDescriptors.join(', ')}`);

    if (descriptorLines.length === 0) {
      return '';
    }

    return descriptorLines.join('\n');
  }

  /**
   * Parse the AI response into structured imageable scenes.
   */
  private parseResponse(content: string): ImageableScene[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        if (this.debug) {
          console.log('[ImagePrompt] No JSON array found in response');
        }
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(parsed)) {
        return [];
      }

      // Validate and filter the parsed data
      return parsed
        .filter(item => this.isValidScene(item))
        .map(item => ({
          prompt: String(item.prompt),
          sourceText: String(item.sourceText),
          sceneType: this.normalizeSceneType(item.sceneType),
          priority: Math.min(10, Math.max(1, Number(item.priority) || 5)),
        }));
    } catch (error) {
      if (this.debug) {
        console.log('[ImagePrompt] Failed to parse response:', error);
      }
      return [];
    }
  }

  /**
   * Validate that a parsed item has required fields.
   */
  private isValidScene(item: unknown): item is Record<string, unknown> {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    const obj = item as Record<string, unknown>;
    return (
      typeof obj.prompt === 'string' &&
      obj.prompt.length > 0 &&
      typeof obj.sourceText === 'string' &&
      obj.sourceText.length >= 3 // At least 3 characters
    );
  }

  /**
   * Normalize scene type to valid enum value.
   */
  private normalizeSceneType(type: unknown): ImageableScene['sceneType'] {
    const normalized = String(type).toLowerCase();
    if (['action', 'item', 'character', 'environment'].includes(normalized)) {
      return normalized as ImageableScene['sceneType'];
    }
    return 'action'; // Default
  }
}

/**
 * Create an ImagePromptService instance.
 */
export function createImagePromptService(
  provider: OpenAIProvider,
  settings?: Partial<ImagePromptSettings>,
  debug?: boolean
): ImagePromptService {
  return new ImagePromptService(provider, settings, debug);
}
