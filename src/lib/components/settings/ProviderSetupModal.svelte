<script lang="ts">
  import { settings, type ProviderPreset } from '$lib/stores/settings.svelte';
  import { Check, ExternalLink } from 'lucide-svelte';

  interface Props {
    isOpen: boolean;
    onComplete: () => void;
  }

  let {
    isOpen,
    onComplete,
  }: Props = $props();

  // Form state
  let selectedProvider = $state<ProviderPreset>('openrouter');
  let apiKey = $state('');
  let showApiKey = $state(false);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);

  // Provider info
  const providers = [
    {
      id: 'openrouter' as ProviderPreset,
      name: 'OpenRouter',
      description: 'Access multiple AI models through a single API.',
      url: 'https://openrouter.ai',
      signupUrl: 'https://openrouter.ai/keys',
      keyPrefix: 'sk-or-',
      requiresKey: true,
    },
    {
      id: 'nanogpt' as ProviderPreset,
      name: 'NanoGPT',
      description: 'Affordable AI API with access to models like Deepseek and GLM.',
      url: 'https://nano-gpt.com',
      signupUrl: 'https://nano-gpt.com/api',
      keyPrefix: 'sk-nano-',
      requiresKey: true,
      note: 'For thinking models, append :thinking to the model name (e.g., deepseek/deepseek-v3.2:thinking)',
    },
    {
      id: 'custom' as ProviderPreset,
      name: 'Custom / Self-Hosted',
      description: 'Configure your own OpenAI-compatible API endpoint in settings.',
      url: '',
      signupUrl: '',
      keyPrefix: '',
      requiresKey: false,
      note: 'You can configure your API endpoint and key later in the Settings → API tab.',
    },
  ];

  $effect(() => {
    if (isOpen) {
      // Reset state when modal opens
      selectedProvider = 'openrouter';
      apiKey = '';
      showApiKey = false;
      isSubmitting = false;
      error = null;
    }
  });

  function requiresApiKey(): boolean {
    return getSelectedProvider()?.requiresKey ?? true;
  }

  async function handleSubmit() {
    if (requiresApiKey() && !apiKey.trim()) {
      error = 'Please enter your API key';
      return;
    }

    isSubmitting = true;
    error = null;

    try {
      await settings.initializeWithProvider(selectedProvider, apiKey.trim());
      onComplete();
    } catch (e) {
      console.error('Failed to initialize with provider:', e);
      error = e instanceof Error ? e.message : 'Failed to initialize. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && apiKey.trim()) {
      handleSubmit();
    }
  }

  function getSelectedProvider() {
    return providers.find(p => p.id === selectedProvider);
  }
</script>

{#if isOpen}
  <div class="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <h1>Welcome to Aventura</h1>
        <p class="subtitle">Choose your AI provider to get started</p>
      </div>

      <div class="modal-body">
        <!-- Provider Selection -->
        <div class="providers">
          {#each providers as provider}
            <button
              type="button"
              class="provider-card"
              class:selected={selectedProvider === provider.id}
              onclick={() => selectedProvider = provider.id}
            >
              <div class="provider-header">
                <span class="provider-name">{provider.name}</span>
                {#if selectedProvider === provider.id}
                  <Check size={16} class="check-icon" />
                {/if}
              </div>
              <p class="provider-description">{provider.description}</p>
              {#if provider.note}
                <p class="provider-note">{provider.note}</p>
              {/if}
            </button>
          {/each}
        </div>

        <!-- API Key Input (only for providers that require it) -->
        {#if requiresApiKey()}
          <div class="form-group">
            <label for="api-key">
              {getSelectedProvider()?.name} API Key
              {#if getSelectedProvider()?.signupUrl}
                <a
                  href={getSelectedProvider()?.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="get-key-link"
                >
                  Get a key <ExternalLink size={12} />
                </a>
              {/if}
            </label>
            <div class="api-key-container">
              <input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                class="input"
                placeholder={getSelectedProvider()?.keyPrefix ? `${getSelectedProvider()?.keyPrefix}...` : 'Enter your API key'}
                bind:value={apiKey}
                onkeydown={handleKeyDown}
              />
              <button
                type="button"
                class="toggle-key-btn"
                onclick={() => showApiKey = !showApiKey}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        {/if}

        {#if error}
          <div class="error-message">{error}</div>
        {/if}
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="btn btn-primary"
          onclick={handleSubmit}
          disabled={(requiresApiKey() && !apiKey.trim()) || isSubmitting}
        >
          {#if isSubmitting}
            <span class="spinner"></span>
            Setting up...
          {:else}
            <Check size={16} />
            Get Started
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    backdrop-filter: blur(8px);
  }

  .modal {
    background: rgb(25, 25, 30);
    border: 1px solid rgb(50, 50, 60);
    border-radius: 0.75rem;
    width: 100%;
    max-width: 480px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  .modal-header {
    padding: 1.5rem 1.5rem 0.75rem;
    text-align: center;
  }

  .modal-header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem;
  }

  .subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .modal-body {
    padding: 1rem 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .providers {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .provider-card {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 1rem;
    background: var(--surface-2);
    border: 2px solid var(--border);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    min-height: 44px; /* Touch-friendly */
  }

  .provider-card:hover {
    background: var(--surface-3);
    border-color: var(--text-secondary);
  }

  .provider-card.selected {
    background: rgba(59, 130, 246, 0.1);
    border-color: var(--accent);
  }

  .provider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .provider-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  :global(.check-icon) {
    color: var(--accent);
  }

  .provider-description {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.4;
  }

  .provider-note {
    font-size: 0.75rem;
    color: var(--accent);
    margin: 0.25rem 0 0;
    font-style: italic;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .get-key-link {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--accent);
    text-decoration: none;
    font-weight: 400;
  }

  .get-key-link:hover {
    text-decoration: underline;
  }

  .api-key-container {
    display: flex;
    gap: 0.5rem;
  }

  .input {
    flex: 1;
    padding: 0.625rem 0.875rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    color: var(--text-primary);
    font-size: 0.875rem;
    min-height: 44px; /* Touch-friendly */
  }

  .input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .toggle-key-btn {
    padding: 0.5rem 0.75rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    color: var(--text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    min-height: 44px; /* Touch-friendly */
  }

  .toggle-key-btn:hover {
    background: var(--surface-3);
    color: var(--text-primary);
  }

  .error-message {
    padding: 0.625rem 0.875rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.375rem;
    color: #ef4444;
    font-size: 0.8125rem;
  }

  .modal-footer {
    padding: 1rem 1.5rem 1.5rem;
    display: flex;
    justify-content: center;
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 2rem;
    border-radius: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 48px; /* Touch-friendly */
  }

  .btn-primary {
    background: var(--accent);
    border: none;
    color: var(--text-on-accent);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .modal-header h1 {
      font-size: 1.25rem;
    }

    .modal-body {
      padding: 1rem;
    }

    .provider-card {
      padding: 0.875rem;
    }

    .modal-footer {
      padding: 1rem;
    }
  }
</style>
