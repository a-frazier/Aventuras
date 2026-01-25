<script lang="ts">
  import { settings } from "$lib/stores/settings.svelte";
  import type { APIProfile } from "$lib/types";
  import type { ProviderInfo } from "$lib/services/ai/types";
  import { fetch } from "@tauri-apps/plugin-http";
  import {
    Plus,
    Edit2,
    Trash2,
    ChevronRight,
    RefreshCw,
    Eye,
    EyeOff,
    Check,
    X,
    Globe,
    Key as KeyIcon,
    Box,
    AlertCircle,
    Star,
  } from "lucide-svelte";

  import { Button } from "$lib/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  import * as Collapsible from "$lib/components/ui/collapsible";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Switch } from "$lib/components/ui/switch";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Alert, AlertDescription } from "$lib/components/ui/alert";

  interface Props {
    providerOptions: ProviderInfo[];
  }

  let { providerOptions }: Props = $props();

  let editingProfileId = $state<string | null>(null);
  let isNewProfile = $state(false);

  // Form state
  let formName = $state("");
  let formBaseUrl = $state("");
  let formApiKey = $state("");
  let formCustomModels = $state<string[]>([]);
  let formFetchedModels = $state<string[]>([]);
  let formSetAsDefault = $state(false);
  let formNewModelInput = $state("");
  let formShowApiKey = $state(false);

  // UI state
  let isFetchingModels = $state(false);
  let fetchError = $state<string | null>(null);

  const urlPresets = [
    { name: "OpenRouter", url: "https://openrouter.ai/api/v1" },
    { name: "NanoGPT", url: "https://nano-gpt.com/api/v1" },
  ];

  function startEdit(profile: APIProfile) {
    editingProfileId = profile.id;
    isNewProfile = false;
    formName = profile.name;
    formBaseUrl = profile.baseUrl;
    formApiKey = profile.apiKey;
    formCustomModels = [...profile.customModels];
    formFetchedModels = [...profile.fetchedModels];
    formSetAsDefault = profile.id === settings.getDefaultProfileIdForProvider();
    formShowApiKey = false;
    fetchError = null;
  }

  function startNewProfile() {
    editingProfileId = crypto.randomUUID();
    isNewProfile = true;
    formName = "";
    formBaseUrl = settings.apiSettings.openaiApiURL;
    formApiKey = "";
    formCustomModels = [];
    formFetchedModels = [];
    formSetAsDefault = false;
    formShowApiKey = false;
    fetchError = null;
  }

  function cancelEdit() {
    editingProfileId = null;
    isNewProfile = false;
    fetchError = null;
  }

  async function handleSave() {
    if (!formName.trim() || !formBaseUrl.trim()) return;

    const profile: APIProfile = {
      id: editingProfileId!,
      name: formName.trim(),
      baseUrl: formBaseUrl.trim().replace(/\/$/, ""),
      apiKey: formApiKey,
      customModels: formCustomModels,
      fetchedModels: formFetchedModels,
      createdAt: isNewProfile
        ? Date.now()
        : settings.apiSettings.profiles.find((p) => p.id === editingProfileId)
            ?.createdAt || Date.now(),
    };

    if (isNewProfile) {
      await settings.addProfile(profile);
    } else {
      await settings.updateProfile(profile.id, profile);
    }

    if (formSetAsDefault) {
      settings.setDefaultProfile(profile.id);
    } else if (settings.apiSettings.defaultProfileId === profile.id) {
      settings.setDefaultProfile(undefined);
    }

    cancelEdit();
  }

  async function handleDelete(profileId: string) {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    await settings.deleteProfile(profileId);
    if (editingProfileId === profileId) cancelEdit();
  }

  async function handleFetchModels() {
    if (!formBaseUrl) {
      fetchError = "Please enter a base URL first";
      return;
    }

    isFetchingModels = true;
    fetchError = null;
    formFetchedModels = [];

    try {
      const modelsUrl = formBaseUrl.replace(/\/$/, "") + "/models";
      const response = await fetch(modelsUrl, {
        headers: formApiKey ? { Authorization: `Bearer ${formApiKey}` } : {},
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch models: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        formFetchedModels = data.data.map((m: { id: string }) => m.id);
      } else if (Array.isArray(data)) {
        formFetchedModels = data
          .map((m: { id?: string; name?: string }) => m.id || m.name || "")
          .filter(Boolean);
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (err) {
      fetchError =
        err instanceof Error ? err.message : "Failed to fetch models";
    } finally {
      isFetchingModels = false;
    }
  }

  function handleAddCustomModel() {
    const model = formNewModelInput.trim();
    if (model && !formCustomModels.includes(model)) {
      formCustomModels = [...formCustomModels, model];
      formNewModelInput = "";
    }
  }

  function handleRemoveCustomModel(model: string) {
    formCustomModels = formCustomModels.filter((m) => m !== model);
  }

  function handleRemoveFetchedModel(model: string) {
    formFetchedModels = formFetchedModels.filter((m) => m !== model);
  }

  function handleSetDefault(profileId: string) {
    const currentDefault = settings.getDefaultProfileIdForProvider();
    if (currentDefault === profileId) {
      settings.setDefaultProfile(undefined);
    } else {
      settings.setDefaultProfile(profileId);
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div>
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">API Profiles</h3>
        <p class="text-sm text-muted-foreground">
          Manage your API endpoint configurations
        </p>
      </div>
      <Button onclick={startNewProfile}>
        <Plus class="h-4 w-4" />
        Add Profile
      </Button>
    </div>
  </div>

  <!-- New Profile Form -->
  {#if isNewProfile && editingProfileId}
    <Card class="border-primary/50 bg-primary/5">
      <CardContent class="pt-4">
        <div class="space-y-4">
          <div class="flex items-center gap-2">
            <Star class="h-4 w-4 text-primary" />
            <span class="text-sm font-medium text-primary">New Profile</span>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="new-name">Profile Name</Label>
              <Input
                id="new-name"
                placeholder="e.g., OpenRouter, Local LLM"
                bind:value={formName}
              />
            </div>
            <div class="space-y-2">
              <Label>Default Profile</Label>
              <div class="flex items-center space-x-2 pt-2">
                <Switch bind:checked={formSetAsDefault} />
                <Label class="text-sm cursor-pointer"
                  >Set as system default</Label
                >
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="new-url">Base URL</Label>
            <div class="flex flex-wrap gap-2 mb-2">
              {#each urlPresets as preset}
                <Badge
                  variant={formBaseUrl === preset.url ? "default" : "outline"}
                  class="cursor-pointer"
                  onclick={() => {
                    if (!formName) formName = preset.name;
                    formBaseUrl = preset.url;
                    formFetchedModels = [];
                    fetchError = null;
                  }}
                >
                  {preset.name}
                </Badge>
              {/each}
            </div>
            <Input
              id="new-url"
              placeholder="https://api.example.com/v1"
              bind:value={formBaseUrl}
              class="font-mono text-xs"
            />
          </div>

          <div class="space-y-2">
            <Label for="new-key">API Key</Label>
            <div class="relative">
              <Input
                id="new-key"
                type={formShowApiKey ? "text" : "password"}
                placeholder="sk-..."
                bind:value={formApiKey}
                class="pr-16 font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                class="absolute right-0 top-0 h-full px-3"
                onclick={() => (formShowApiKey = !formShowApiKey)}
              >
                {#if formShowApiKey}
                  <EyeOff class="h-4 w-4" />
                {:else}
                  <Eye class="h-4 w-4" />
                {/if}
              </Button>
            </div>
          </div>

          <Separator />

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <Label class="flex items-center gap-2">
                <Box class="h-4 w-4" />
                Models
              </Label>
              <Button
                variant="outline"
                size="sm"
                onclick={handleFetchModels}
                disabled={isFetchingModels || !formBaseUrl}
              >
                {#if isFetchingModels}
                  <RefreshCw class=" h-3 w-3 animate-spin" />
                  Fetching...
                {:else}
                  <RefreshCw class=" h-3 w-3" />
                  Fetch Models
                {/if}
              </Button>
            </div>

            {#if fetchError}
              <Alert variant="destructive">
                <AlertCircle class="h-4 w-4" />
                <AlertDescription class="text-xs">{fetchError}</AlertDescription
                >
              </Alert>
            {/if}

            {#if formFetchedModels.length > 0}
              <div class="space-y-2">
                <p class="text-xs font-medium text-muted-foreground">
                  Fetched Models ({formFetchedModels.length})
                </p>
                <ScrollArea class="h-32 w-full rounded-md border">
                  <div class="flex flex-wrap gap-1 p-2">
                    {#each formFetchedModels as model}
                      <Badge variant="secondary" class="gap-1 pr-1">
                        <span class="max-w-[150px] truncate">{model}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="h-4 w-4 p-0 hover:text-destructive"
                          onclick={() => handleRemoveFetchedModel(model)}
                        >
                          <X class="h-3 w-3" />
                        </Button>
                      </Badge>
                    {/each}
                  </div>
                </ScrollArea>
              </div>
            {/if}

            <div class="space-y-2">
              <p class="text-xs font-medium text-muted-foreground">
                Custom Models
              </p>
              <div class="flex gap-2">
                <Input
                  placeholder="model-name or provider/model"
                  bind:value={formNewModelInput}
                  class="flex-1"
                  onkeydown={(e) => e.key === "Enter" && handleAddCustomModel()}
                />
                <Button
                  size="icon"
                  onclick={handleAddCustomModel}
                  disabled={!formNewModelInput.trim()}
                >
                  <Plus class="h-4 w-4" />
                </Button>
              </div>
              {#if formCustomModels.length > 0}
                <ScrollArea class="h-24 w-full rounded-md border">
                  <div class="flex flex-wrap gap-1 p-2">
                    {#each formCustomModels as model}
                      <Badge variant="outline" class="gap-1 pr-1">
                        <span class="max-w-[150px] truncate">{model}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="h-4 w-4 p-0 hover:text-destructive"
                          onclick={() => handleRemoveCustomModel(model)}
                        >
                          <X class="h-3 w-3" />
                        </Button>
                      </Badge>
                    {/each}
                  </div>
                </ScrollArea>
              {/if}
            </div>
          </div>

          <div class="flex gap-2 pt-2">
            <Button variant="outline" onclick={cancelEdit} class="flex-1"
              >Cancel</Button
            >
            <Button
              onclick={handleSave}
              disabled={!formName.trim() || !formBaseUrl.trim()}
              class="flex-1"
            >
              <Check class="h-4 w-4" />
              Create Profile
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  {/if}

  <!-- Profiles List -->
  <div class="space-y-3">
    {#each settings.apiSettings.profiles as profile (profile.id)}
      <div
        class="rounded-lg border bg-card text-card-foreground shadow-sm group"
      >
        <Collapsible.Root>
          <div class="flex items-center p-3 pl-4 gap-3">
            <Collapsible.Trigger
              class="flex items-center gap-2 flex-1 text-left group/trigger"
            >
              <div
                class="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50 transition-colors group-hover/trigger:bg-muted"
              >
                <ChevronRight
                  class="h-4 w-4 transition-transform duration-200 group-data-[state=open]/trigger:rotate-90"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm truncate"
                    >{profile.name}</span
                  >
                  {#if profile.id === settings.getDefaultProfileIdForProvider()}
                    <Badge variant="default" class="shrink-0">
                      <Star class="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  {/if}
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs text-muted-foreground font-mono truncate"
                    >{profile.baseUrl}</span
                  >
                  {#if profile.apiKey}
                    <Badge variant="secondary" class="text-xs">Key set</Badge>
                  {:else}
                    <Badge
                      variant="outline"
                      class="text-xs text-muted-foreground">No key</Badge
                    >
                  {/if}
                  <Badge
                    variant="outline"
                    class="text-xs text-muted-foreground"
                  >
                    {profile.customModels.length + profile.fetchedModels.length}
                    models
                  </Badge>
                </div>
              </div>
            </Collapsible.Trigger>
            <div class="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                onclick={() => handleSetDefault(profile.id)}
                title={profile.id === settings.getDefaultProfileIdForProvider()
                  ? "Remove default"
                  : "Set as default"}
              >
                <Star
                  class={`h-4 w-4 ${profile.id === settings.getDefaultProfileIdForProvider() ? "fill-primary text-primary" : ""}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                onclick={() => startEdit(profile)}
                title="Edit profile"
              >
                <Edit2 class="h-4 w-4" />
              </Button>
              {#if settings.canDeleteProfile(profile.id)}
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onclick={() => handleDelete(profile.id)}
                  title="Delete profile"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              {/if}
            </div>
          </div>

          <Collapsible.Content>
            <div class="px-4 pb-4 pt-0 space-y-4 border-t bg-muted/10 mt-2 p-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <Label>Profile Name</Label>
                  <Input bind:value={formName} placeholder="Profile name" />
                </div>
                <div class="space-y-2">
                  <Label>Default Profile</Label>
                  <div class="flex items-center space-x-2 pt-2">
                    <Switch bind:checked={formSetAsDefault} />
                    <Label class="text-sm cursor-pointer"
                      >Set as system default</Label
                    >
                  </div>
                </div>
              </div>

              <div class="space-y-2">
                <Label>Base URL</Label>
                <div class="flex flex-wrap gap-2 mb-2">
                  {#each urlPresets as preset}
                    <Badge
                      variant={formBaseUrl === preset.url
                        ? "default"
                        : "outline"}
                      class="cursor-pointer"
                      onclick={() => {
                        formBaseUrl = preset.url;
                        formFetchedModels = [];
                        fetchError = null;
                      }}
                    >
                      {preset.name}
                    </Badge>
                  {/each}
                </div>
                <Input
                  bind:value={formBaseUrl}
                  placeholder="https://api.example.com/v1"
                  class="font-mono text-xs"
                />
              </div>

              <div class="space-y-2">
                <Label>API Key</Label>
                <div class="relative">
                  <Input
                    type={formShowApiKey ? "text" : "password"}
                    placeholder="sk-..."
                    bind:value={formApiKey}
                    class="pr-16 font-mono text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    class="absolute right-0 top-0 h-full px-3"
                    onclick={() => (formShowApiKey = !formShowApiKey)}
                  >
                    {#if formShowApiKey}
                      <EyeOff class="h-4 w-4" />
                    {:else}
                      <Eye class="h-4 w-4" />
                    {/if}
                  </Button>
                </div>
              </div>

              <div class="space-y-3 pt-2">
                <div class="flex items-center justify-between">
                  <Label class="flex items-center gap-2">
                    <Box class="h-4 w-4" />
                    Models
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={handleFetchModels}
                    disabled={isFetchingModels || !formBaseUrl}
                  >
                    {#if isFetchingModels}
                      <RefreshCw class=" h-3 w-3 animate-spin" />
                      Fetching...
                    {:else}
                      <RefreshCw class=" h-3 w-3" />
                      Fetch Models
                    {/if}
                  </Button>
                </div>

                {#if fetchError}
                  <Alert variant="destructive">
                    <AlertCircle class="h-4 w-4" />
                    <AlertDescription class="text-xs"
                      >{fetchError}</AlertDescription
                    >
                  </Alert>
                {/if}

                {#if formFetchedModels.length > 0}
                  <div class="space-y-2">
                    <p class="text-xs font-medium text-muted-foreground">
                      Fetched Models ({formFetchedModels.length})
                    </p>
                    <ScrollArea class="h-32 w-full rounded-md border">
                      <div class="flex flex-wrap gap-1 p-2">
                        {#each formFetchedModels as model}
                          <Badge variant="secondary" class="gap-1 pr-1">
                            <span class="max-w-[150px] truncate">{model}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              class="h-4 w-4 p-0 hover:text-destructive"
                              onclick={() => handleRemoveFetchedModel(model)}
                            >
                              <X class="h-3 w-3" />
                            </Button>
                          </Badge>
                        {/each}
                      </div>
                    </ScrollArea>
                  </div>
                {/if}

                <div class="space-y-2">
                  <p class="text-xs font-medium text-muted-foreground">
                    Custom Models
                  </p>
                  <div class="flex gap-2">
                    <Input
                      placeholder="model-name or provider/model"
                      bind:value={formNewModelInput}
                      class="flex-1"
                      onkeydown={(e) =>
                        e.key === "Enter" && handleAddCustomModel()}
                    />
                    <Button
                      size="icon"
                      onclick={handleAddCustomModel}
                      disabled={!formNewModelInput.trim()}
                    >
                      <Plus class="h-4 w-4" />
                    </Button>
                  </div>
                  {#if formCustomModels.length > 0}
                    <ScrollArea class="h-24 w-full rounded-md border">
                      <div class="flex flex-wrap gap-1 p-2">
                        {#each formCustomModels as model}
                          <Badge variant="outline" class="gap-1 pr-1">
                            <span class="max-w-[150px] truncate">{model}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              class="h-4 w-4 p-0 hover:text-destructive"
                              onclick={() => handleRemoveCustomModel(model)}
                            >
                              <X class="h-3 w-3" />
                            </Button>
                          </Badge>
                        {/each}
                      </div>
                    </ScrollArea>
                  {/if}
                </div>
              </div>

              <div class="flex gap-2 pt-2">
                <Button variant="outline" onclick={cancelEdit} class="flex-1"
                  >Cancel</Button
                >
                <Button
                  onclick={handleSave}
                  disabled={!formName.trim() || !formBaseUrl.trim()}
                  class="flex-1"
                >
                  <Check class=" h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      </div>
    {/each}

    {#if settings.apiSettings.profiles.length === 0}
      <Card class="border-dashed">
        <CardContent class="p-8 text-center">
          <div
            class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted"
          >
            <KeyIcon class="h-6 w-6 text-muted-foreground" />
          </div>
          <h4 class="mb-2 font-medium">No API profiles yet</h4>
          <p class="mb-4 text-sm text-muted-foreground">
            Add an API profile to connect to your LLM provider
          </p>
          <Button onclick={startNewProfile}>
            <Plus class=" h-4 w-4" />
            Add Your First Profile
          </Button>
        </CardContent>
      </Card>
    {/if}
  </div>

  <!-- Footer Links -->
  <Card class="bg-muted/30">
    <CardContent class="p-4">
      <p class="text-sm text-muted-foreground">
        Get an API key from{" "}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary hover:underline"
        >
          openrouter.ai
        </a>
        {" or "}
        <a
          href="https://nano-gpt.com/subscription"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary hover:underline"
        >
          nano-gpt.com
        </a>
      </p>
    </CardContent>
  </Card>
</div>
