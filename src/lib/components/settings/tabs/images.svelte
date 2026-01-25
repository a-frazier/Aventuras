<script lang="ts">
  import { settings } from "$lib/stores/settings.svelte";
  import { Switch } from "$lib/components/ui/switch";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { RotateCcw } from "lucide-svelte";

  const imageProviders = [
    { value: "nanogpt", label: "NanoGPT" },
    { value: "chutes", label: "Chutes" },
  ] as const;

  const imageStyles = [
    { value: "image-style-soft-anime", label: "Soft Anime" },
    { value: "image-style-semi-realistic", label: "Semi-realistic Anime" },
    { value: "image-style-photorealistic", label: "Photorealistic" },
  ] as const;

  const imageSizes = [
    { value: "512x512", label: "512x512 (Faster)" },
    { value: "1024x1024", label: "1024x1024 (Higher Quality)" },
  ] as const;
</script>

<div class="space-y-4">
  <!-- Enable Image Generation Toggle -->
  <div class="border-b border-border pb-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-medium text-foreground">
          Automatic Image Generation
        </h3>
        <p class="text-xs text-muted-foreground">
          Generate images for visually striking moments in the narrative.
        </p>
      </div>
      <Switch
        checked={settings.systemServicesSettings.imageGeneration.enabled}
        onCheckedChange={(v) => {
          settings.systemServicesSettings.imageGeneration.enabled = v;
          settings.saveSystemServicesSettings();
        }}
      />
    </div>
  </div>

  {#if settings.systemServicesSettings.imageGeneration.enabled}
    <!-- Image Provider Selection -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-foreground">Image Provider</label>
      <p class="text-xs text-muted-foreground">
        Select the image generation service to use.
      </p>
      <select
        class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        value={settings.systemServicesSettings.imageGeneration.imageProvider ??
          "nanogpt"}
        onchange={(e) => {
          const provider = e.currentTarget.value as "nanogpt" | "chutes";
          settings.systemServicesSettings.imageGeneration.imageProvider = provider;
          if (provider === "chutes") {
            settings.systemServicesSettings.imageGeneration.referenceModel =
              "qwen-image-edit-2511";
          } else {
            settings.systemServicesSettings.imageGeneration.referenceModel =
              "qwen-image";
          }
          settings.saveSystemServicesSettings();
        }}
      >
        {#each imageProviders as provider}
          <option value={provider.value}>{provider.label}</option>
        {/each}
      </select>
    </div>

    <!-- NanoGPT API Key -->
    {#if (settings.systemServicesSettings.imageGeneration.imageProvider ?? "nanogpt") === "nanogpt"}
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">NanoGPT API Key</label>
        <p class="text-xs text-muted-foreground">
          API key for NanoGPT image generation.
        </p>
        <div class="flex gap-2">
          <Input
            type="password"
            class="flex-1"
            value={settings.systemServicesSettings.imageGeneration.nanoGptApiKey}
            oninput={(e) => {
              settings.systemServicesSettings.imageGeneration.nanoGptApiKey =
                e.currentTarget.value;
              settings.saveSystemServicesSettings();
            }}
            placeholder="Enter your NanoGPT API key"
          />
          {#if settings.apiSettings.profiles.some((p) =>
            p.baseUrl?.includes("nano-gpt.com") && p.apiKey)}
            <Button
              variant="outline"
              size="sm"
              class="whitespace-nowrap"
              onclick={() => {
                const nanoProfile = settings.apiSettings.profiles.find(
                  (p) =>
                    p.baseUrl?.includes("nano-gpt.com") &&
                    p.apiKey,
                );
                if (nanoProfile?.apiKey) {
                  settings.systemServicesSettings.imageGeneration.nanoGptApiKey =
                    nanoProfile.apiKey;
                  settings.saveSystemServicesSettings();
                }
              }}
            >
              Autofill from Profile
            </Button>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Chutes API Key -->
    {#if settings.systemServicesSettings.imageGeneration.imageProvider === "chutes"}
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">Chutes API Key</label>
        <p class="text-xs text-muted-foreground">
          API key for Chutes image generation.
        </p>
        <Input
          type="password"
          class="w-full"
          value={settings.systemServicesSettings.imageGeneration.chutesApiKey}
          oninput={(e) => {
            settings.systemServicesSettings.imageGeneration.chutesApiKey =
              e.currentTarget.value;
            settings.saveSystemServicesSettings();
          }}
          placeholder="Enter your Chutes API key"
        />
      </div>
    {/if}

    <!-- Image Model -->
    {#if !settings.systemServicesSettings.imageGeneration.portraitMode}
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">Image Model</label>
        <p class="text-xs text-muted-foreground">
          The image model to use for generation.
        </p>
        <Input
          type="text"
          class="w-full"
          value={settings.systemServicesSettings.imageGeneration.model}
          oninput={(e) => {
            settings.systemServicesSettings.imageGeneration.model =
              e.currentTarget.value;
            settings.saveSystemServicesSettings();
          }}
          placeholder="z-image-turbo"
        />
      </div>
    {/if}

    <!-- Image Style -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-foreground">Image Style</label>
      <p class="text-xs text-muted-foreground">
        Visual style for generated images. Edit styles in the Prompts tab.
      </p>
      <select
        class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        value={settings.systemServicesSettings.imageGeneration.styleId}
        onchange={(e) => {
          settings.systemServicesSettings.imageGeneration.styleId =
            e.currentTarget.value;
          settings.saveSystemServicesSettings();
        }}
      >
        {#each imageStyles as style}
          <option value={style.value}>{style.label}</option>
        {/each}
      </select>
    </div>

    <!-- Image Size -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-foreground">Image Size</label>
      <select
        class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        value={settings.systemServicesSettings.imageGeneration.size}
        onchange={(e) => {
          settings.systemServicesSettings.imageGeneration.size =
            e.currentTarget.value as "512x512" | "1024x1024";
          settings.saveSystemServicesSettings();
        }}
      >
        {#each imageSizes as size}
          <option value={size.value}>{size.label}</option>
        {/each}
      </select>
    </div>

    <!-- Max Images Per Message -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-foreground">
        Max Images Per Message:
        {settings.systemServicesSettings.imageGeneration
          .maxImagesPerMessage === 0
          ? "Unlimited"
          : settings.systemServicesSettings.imageGeneration
            .maxImagesPerMessage}
      </label>
      <p class="text-xs text-muted-foreground">
        Maximum images per narrative (0 = unlimited).
      </p>
      <input
        type="range"
        min="0"
        max="5"
        step="1"
        class="w-full"
        value={settings.systemServicesSettings.imageGeneration.maxImagesPerMessage}
        oninput={(e) => {
          settings.systemServicesSettings.imageGeneration.maxImagesPerMessage =
            parseInt(e.currentTarget.value);
          settings.saveSystemServicesSettings();
        }}
      />
    </div>

    <!-- Auto Generate Toggle -->
    <div class="border-t border-border pt-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-foreground">Auto-Generate</h3>
          <p class="text-xs text-muted-foreground">
            Automatically generate images after each narration.
          </p>
        </div>
        <Switch
          checked={settings.systemServicesSettings.imageGeneration.autoGenerate}
          onCheckedChange={(v) => {
            settings.systemServicesSettings.imageGeneration.autoGenerate = v;
            settings.saveSystemServicesSettings();
          }}
        />
      </div>
    </div>

    <!-- Portrait Reference Mode -->
    <div class="border-t border-border pt-4 mt-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-foreground">
            Portrait Reference Mode
          </h3>
          <p class="text-xs text-muted-foreground">
            Use character portraits as reference images when generating story
            images.
          </p>
        </div>
        <Switch
          checked={settings.systemServicesSettings.imageGeneration.portraitMode}
          onCheckedChange={(v) => {
            settings.systemServicesSettings.imageGeneration.portraitMode = v;
            settings.saveSystemServicesSettings();
          }}
        />
      </div>
    </div>

    {#if settings.systemServicesSettings.imageGeneration.portraitMode}
      <!-- Portrait Generation Model -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">
          Portrait Generation Model
        </label>
        <p class="text-xs text-muted-foreground">
          Model used when generating character portraits from visual descriptors.
        </p>
        <Input
          type="text"
          class="w-full"
          value={settings.systemServicesSettings.imageGeneration.portraitModel}
          oninput={(e) => {
            settings.systemServicesSettings.imageGeneration.portraitModel =
              e.currentTarget.value;
            settings.saveSystemServicesSettings();
          }}
          placeholder="z-image-turbo"
        />
      </div>

      <!-- Reference Image Model -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground">
          Reference Image Model
        </label>
        <p class="text-xs text-muted-foreground">
          Model used for story images when a character portrait is attached as
          reference.
        </p>
        <Input
          type="text"
          class="w-full"
          value={settings.systemServicesSettings.imageGeneration.referenceModel}
          oninput={(e) => {
            settings.systemServicesSettings.imageGeneration.referenceModel =
              e.currentTarget.value;
            settings.saveSystemServicesSettings();
          }}
          placeholder="qwen-image"
        />
      </div>
    {/if}

    <!-- Reset Button -->
    <div class="border-t border-border pt-4 mt-4">
      <Button
        variant="outline"
        size="sm"
        onclick={() => settings.resetImageGenerationSettings()}
      >
        <RotateCcw class="h-3 w-3 mr-1" />
        Reset to Defaults
      </Button>
    </div>
  {/if}
</div>
