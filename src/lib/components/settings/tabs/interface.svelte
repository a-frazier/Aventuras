<script lang="ts">
  import { settings } from "$lib/stores/settings.svelte";
  import type { ThemeId } from "$lib/types";
  import { Switch } from "$lib/components/ui/switch";
  import { Button } from "$lib/components/ui/button";
  import { getSupportedLanguages } from "$lib/services/ai/translation";
  import {
    Download,
    RefreshCw,
    Loader2,
    Languages,
  } from "lucide-svelte";

  const themes: Array<{ value: ThemeId; label: string; description: string }> = [
    { value: "dark", label: "Dark", description: "Modern dark theme" },
    {
      value: "light",
      label: "Light (Paper)",
      description: "Clean paper-like warm tones with amber accents",
    },
    {
      value: "light-solarized",
      label: "Light (Solarized)",
      description: "Classic Solarized color scheme with cream backgrounds",
    },
    {
      value: "retro-console",
      label: "Retro Console",
      description: "CRT aesthetic inspired by PS2-era games and Serial Experiments Lain",
    },
    {
      value: "fallen-down",
      label: "Fallen Down",
      description: "* The shadows deepen. Your adventure continues.",
    },
  ];

  const fontSizes = [
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" },
  ] as const;
</script>

<div class="space-y-4">
  <!-- Theme Selection -->
  <div>
    <label class="mb-2 block text-sm font-medium text-foreground">Theme</label>
    <select
      class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      value={settings.uiSettings.theme}
      onchange={(e) =>
        settings.setTheme(e.currentTarget.value as ThemeId)}
    >
      {#each themes as theme}
        <option value={theme.value}>{theme.label}</option>
      {/each}
    </select>
    <p class="mt-1 text-xs text-muted-foreground">
      {themes.find((t) => t.value === settings.uiSettings.theme)?.description ?? ""}
    </p>
  </div>

  <!-- Font Size -->
  <div>
    <label class="mb-2 block text-sm font-medium text-foreground">Font Size</label>
    <select
      class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      value={settings.uiSettings.fontSize}
      onchange={(e) =>
        settings.setFontSize(e.currentTarget.value as "small" | "medium" | "large")}
    >
      {#each fontSizes as size}
        <option value={size.value}>{size.label}</option>
      {/each}
    </select>
  </div>

  <!-- Word Count Toggle -->
  <div class="flex items-center justify-between">
    <label class="text-sm font-medium text-foreground">Show Word Count</label>
    <input
      type="checkbox"
      checked={settings.uiSettings.showWordCount}
      onchange={() => {
        settings.uiSettings.showWordCount = !settings.uiSettings.showWordCount;
      }}
      class="h-5 w-5 rounded border-input bg-background"
    />
  </div>

  <!-- Spellcheck Toggle -->
  <div class="flex items-center justify-between">
    <div>
      <label class="text-sm font-medium text-foreground">Spellcheck</label>
      <p class="text-xs text-muted-foreground">
        Grammar and spelling suggestions while typing
      </p>
    </div>
    <Switch
      checked={settings.uiSettings.spellcheckEnabled}
      onCheckedChange={(v) => settings.setSpellcheckEnabled(v)}
    />
  </div>

  <!-- Disable Suggestions Toggle -->
  <div class="flex items-center justify-between">
    <div>
      <label class="text-sm font-medium text-foreground">Disable Suggestions</label>
      <p class="text-xs text-muted-foreground">
        Hide AI-generated action choices and plot suggestions
      </p>
    </div>
    <Switch
      checked={settings.uiSettings.disableSuggestions}
      onCheckedChange={(v) => settings.setDisableSuggestions(v)}
    />
  </div>

  <!-- Disable Action Prefixes Toggle -->
  <div class="flex items-center justify-between">
    <div>
      <label class="text-sm font-medium text-foreground">Disable Action Prefixes</label>
      <p class="text-xs text-muted-foreground">
        Hide Do/Say/Think buttons and use raw input
      </p>
    </div>
    <Switch
      checked={settings.uiSettings.disableActionPrefixes}
      onCheckedChange={(v) => settings.setDisableActionPrefixes(v)}
    />
  </div>

  <!-- Show Reasoning Toggle -->
  <div class="flex items-center justify-between">
    <div>
      <label class="text-sm font-medium text-foreground">Show Reasoning Block</label>
      <p class="text-xs text-muted-foreground">Show thought process display</p>
    </div>
    <Switch
      checked={settings.uiSettings.showReasoning}
      onCheckedChange={(v) => settings.setShowReasoning(v)}
    />
  </div>
</div>
