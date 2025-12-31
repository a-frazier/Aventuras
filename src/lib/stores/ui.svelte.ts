import type { ActivePanel, SidebarTab, UIState } from '$lib/types';
import type { ActionChoice } from '$lib/services/ai/actionChoices';
import { database } from '$lib/services/database';

// Error state for retry functionality
export interface GenerationError {
  message: string;
  errorEntryId: string;
  userActionEntryId: string;
  timestamp: number;
}

// Persisted action choices structure
interface PersistedActionChoices {
  storyId: string;
  choices: ActionChoice[];
}

// UI State using Svelte 5 runes
class UIStore {
  activePanel = $state<ActivePanel>('story');
  sidebarTab = $state<SidebarTab>('characters');
  sidebarOpen = $state(true);
  settingsModalOpen = $state(false);
  isGenerating = $state(false);

  // Streaming state
  streamingContent = $state('');
  isStreaming = $state(false);

  // Error state for retry
  lastGenerationError = $state<GenerationError | null>(null);

  // RPG action choices (displayed after narration)
  actionChoices = $state<ActionChoice[]>([]);
  actionChoicesLoading = $state(false);
  pendingActionChoice = $state<string | null>(null);

  // Retry callback - set by ActionInput
  private retryCallback: (() => Promise<void>) | null = null;

  setActivePanel(panel: ActivePanel) {
    this.activePanel = panel;
  }

  setSidebarTab(tab: SidebarTab) {
    this.sidebarTab = tab;
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  openSettings() {
    this.settingsModalOpen = true;
  }

  closeSettings() {
    this.settingsModalOpen = false;
  }

  setGenerating(value: boolean) {
    this.isGenerating = value;
  }

  // Streaming methods
  startStreaming() {
    this.isStreaming = true;
    this.streamingContent = '';
  }

  appendStreamContent(content: string) {
    this.streamingContent += content;
  }

  endStreaming() {
    this.isStreaming = false;
    this.streamingContent = '';
  }

  getStreamingContent(): string {
    return this.streamingContent;
  }

  // Error handling methods
  setGenerationError(error: GenerationError) {
    this.lastGenerationError = error;
  }

  clearGenerationError() {
    this.lastGenerationError = null;
  }

  // Action choices methods
  setActionChoices(choices: ActionChoice[], storyId?: string) {
    this.actionChoices = choices;
    // Persist to database if we have a story ID
    if (storyId && choices.length > 0) {
      const data: PersistedActionChoices = { storyId, choices };
      database.setSetting('action_choices', JSON.stringify(data)).catch(err => {
        console.warn('[UI] Failed to persist action choices:', err);
      });
    }
  }

  setActionChoicesLoading(loading: boolean) {
    this.actionChoicesLoading = loading;
  }

  clearActionChoices() {
    this.actionChoices = [];
    // Clear persisted choices
    database.setSetting('action_choices', '').catch(err => {
      console.warn('[UI] Failed to clear persisted action choices:', err);
    });
  }

  /**
   * Load persisted action choices for a story.
   * Called when a story is loaded.
   */
  async loadActionChoices(storyId: string) {
    try {
      const data = await database.getSetting('action_choices');
      if (data) {
        const parsed: PersistedActionChoices = JSON.parse(data);
        // Only restore if it's for the same story
        if (parsed.storyId === storyId && parsed.choices.length > 0) {
          this.actionChoices = parsed.choices;
          console.log('[UI] Restored action choices for story:', storyId);
        }
      }
    } catch (err) {
      console.warn('[UI] Failed to load persisted action choices:', err);
    }
  }

  setPendingActionChoice(text: string) {
    this.pendingActionChoice = text;
    this.actionChoices = [];
    // Clear persisted choices when one is selected
    database.setSetting('action_choices', '').catch(err => {
      console.warn('[UI] Failed to clear persisted action choices:', err);
    });
  }

  clearPendingActionChoice() {
    this.pendingActionChoice = null;
  }

  // Retry callback management
  setRetryCallback(callback: (() => Promise<void>) | null) {
    this.retryCallback = callback;
  }

  async triggerRetry() {
    console.log('[UI] triggerRetry called', { hasCallback: !!this.retryCallback });
    if (this.retryCallback) {
      await this.retryCallback();
      console.log('[UI] retryCallback completed');
    } else {
      console.log('[UI] No retry callback registered!');
    }
  }
}

export const ui = new UIStore();
