<script lang="ts">
  import { settings } from "$lib/stores/settings.svelte";
  import {
    promptService,
    type PromptTemplate,
    type MacroOverride,
    type Macro,
    type SimpleMacro,
    type ComplexMacro,
  } from "$lib/services/prompts";
  import { promptExportService } from "$lib/services/promptExport";
  import PromptEditor from "$lib/components/prompts/PromptEditor.svelte";
  import MacroChip from "$lib/components/prompts/MacroChip.svelte";
  import MacroEditor from "$lib/components/prompts/MacroEditor.svelte";
  import ComplexMacroEditor from "$lib/components/prompts/ComplexMacroEditor.svelte";
  import {
    RotateCcw,
    Download,
    Upload,
    Loader2,
  } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";

  interface Props {
    openImportModal: () => void;
  }

  let { openImportModal }: Props = $props();

  // Prompts tab state
  let selectedTemplateId = $state<string | null>(null);
  let editingMacro = $state<Macro | null>(null);
  let showMacroEditor = $state(false);
  let showComplexMacroEditor = $state(false);
  let promptsCategory = $state<"story" | "service" | "wizard">("story");

  let isExporting = $state(false);

  // Get all templates grouped by category
  const allTemplates = $derived(promptService.getAllTemplates());
  const storyTemplates = $derived(
    allTemplates.filter((t) => t.category === "story"),
  );
  const serviceTemplates = $derived(
    allTemplates.filter((t) => t.category === "service"),
  );
  const wizardTemplates = $derived(
    allTemplates.filter((t) => t.category === "wizard"),
  );
  const allMacros = $derived(promptService.getAllMacros());

  // Get templates for current category
  function getTemplatesForCategory() {
    if (promptsCategory === "story") return storyTemplates;
    if (promptsCategory === "service") return serviceTemplates;
    return wizardTemplates;
  }

  // Get category label
  function getCategoryLabel() {
    if (promptsCategory === "story") return "Story Templates";
    if (promptsCategory === "service") return "Service Templates";
    return "Wizard Templates";
  }

  // Get current template content (with overrides)
  function getTemplateContent(templateId: string): string {
    const override = settings.promptSettings.templateOverrides.find(
      (o) => o.templateId === templateId,
    );
    if (override) return override.content;
    const template = allTemplates.find((t) => t.id === templateId);
    return template?.content ?? "";
  }

  // Get current user content (with overrides)
  function getUserContent(templateId: string): string | undefined {
    const template = allTemplates.find((t) => t.id === templateId);
    if (!template?.userContent) return undefined;

    // Check for user content override (stored as templateId-user)
    const override = settings.promptSettings.templateOverrides.find(
      (o) => o.templateId === `${templateId}-user`,
    );
    if (override) return override.content;
    return template.userContent;
  }

  // Check if template is modified
  function isTemplateModified(templateId: string): boolean {
    return settings.promptSettings.templateOverrides.some(
      (o) => o.templateId === templateId,
    );
  }

  // Check if user content is modified
  function isUserContentModified(templateId: string): boolean {
    return settings.promptSettings.templateOverrides.some(
      (o) => o.templateId === `${templateId}-user`,
    );
  }

  // Handle template content change
  function handleTemplateChange(templateId: string, content: string) {
    settings.setTemplateOverride(templateId, content);
  }

  // Handle user content change
  function handleUserContentChange(templateId: string, content: string) {
    settings.setTemplateOverride(`${templateId}-user`, content);
  }

  // Handle template reset
  function handleTemplateReset(templateId: string) {
    settings.removeTemplateOverride(templateId);
  }

  // Handle user content reset
  function handleUserContentReset(templateId: string) {
    settings.removeTemplateOverride(`${templateId}-user`);
  }

  // Handle macro override
  function handleMacroOverride(override: MacroOverride) {
    const existingIndex = settings.promptSettings.macroOverrides.findIndex(
      (o) => o.macroId === override.macroId,
    );
    if (existingIndex >= 0) {
      // Use spread operator to trigger Svelte reactivity
      const updated = [...settings.promptSettings.macroOverrides];
      updated[existingIndex] = override;
      settings.promptSettings.macroOverrides = updated;
    } else {
      settings.promptSettings.macroOverrides = [
        ...settings.promptSettings.macroOverrides,
        override,
      ];
    }
    settings.savePromptSettings();
  }

  // Handle macro reset
  function handleMacroReset(macroId: string) {
    settings.promptSettings.macroOverrides =
      settings.promptSettings.macroOverrides.filter(
        (o) => o.macroId !== macroId,
      );
    settings.savePromptSettings();
  }

  // Find macro override
  function findMacroOverride(macroId: string): MacroOverride | undefined {
    return settings.promptSettings.macroOverrides.find(
      (o) => o.macroId === macroId,
    );
  }
</script>

<div class="space-y-6">
  <!-- Category Toggle -->
  <div
    class="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto"
  >
    <Button
      variant={promptsCategory === "story" ? "default" : "ghost"}
      size="sm"
      onclick={() => (promptsCategory = "story")}
    >
      Story
    </Button>
    <Button
      variant={promptsCategory === "service" ? "default" : "ghost"}
      size="sm"
      onclick={() => (promptsCategory = "service")}
    >
      Services
    </Button>
    <Button
      variant={promptsCategory === "wizard" ? "default" : "ghost"}
      size="sm"
      onclick={() => (promptsCategory = "wizard")}
    >
      Wizard
    </Button>
  </div>

  <!-- Templates List -->
  <div class="space-y-4 !mt-0 sm:!mt-3">
    <div class="flex items-center justify-between -mb-3 sm:-mb-1">
      <h3 class="text-sm font-medium text-foreground">
        {getCategoryLabel()}
      </h3>
      <div class="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          class="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          onclick={() => {
            getTemplatesForCategory().forEach((t) => {
              handleTemplateReset(t.id);
              handleUserContentReset(t.id);
            });
          }}
        >
          <RotateCcw class="h-3 w-3" />
          Reset All
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="text-xs"
          onclick={async () => {
            isExporting = true;
            try {
              await promptExportService.exportPrompts();
            } finally {
              isExporting = false;
            }
          }}
          disabled={isExporting}
        >
          {#if isExporting}
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
          {:else}
            <Download class="h-3.5 w-3.5" />
          {/if}
          Export
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="text-xs"
          onclick={openImportModal}
        >
          <Upload class="h-3.5 w-3.5" />
          Import
        </Button>
      </div>
    </div>

        {#each getTemplatesForCategory() as template}
      <div class="rounded-lg border bg-card p-4">
        {#if selectedTemplateId === template.id}
          <PromptEditor
            {template}
            content={getTemplateContent(template.id)}
            userContent={getUserContent(template.id)}
            isModified={isTemplateModified(template.id)}
            isUserModified={isUserContentModified(template.id)}
            macroOverrides={settings.promptSettings.macroOverrides}
            onChange={(content) =>
              handleTemplateChange(template.id, content)}
            onUserChange={(content) =>
              handleUserContentChange(template.id, content)}
            onReset={() => handleTemplateReset(template.id)}
            onUserReset={() => handleUserContentReset(template.id)}
            onMacroOverride={handleMacroOverride}
            onMacroReset={handleMacroReset}
          />
          <button
            type="button"
            class="mt-3 text-xs text-muted-foreground hover:text-foreground"
            onclick={() => (selectedTemplateId = null)}
          >
            Collapse
          </button>
        {:else}
          <button
            type="button"
            class="flex items-center justify-between w-full text-left"
            onclick={() => (selectedTemplateId = template.id)}
          >
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-foreground">{template.name}</span>
                {#if isTemplateModified(template.id)}
                  <span
                    class="text-xs px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-700/30"
                  >
                    Modified
                  </span>
                {/if}
              </div>
              <p class="text-xs text-muted-foreground mt-0.5">
                {template.description}
              </p>
            </div>
            <span
              class="text-xs text-primary hover:text-primary/80"
            >
              Edit
            </span>
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Macros Section -->
  <div class="border-t border-border pt-4 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-medium text-foreground">Macro Library</h3>
        <p class="text-xs text-muted-foreground mt-0.5">
          Click a macro to view and edit its values
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
        onclick={() => {
          settings.promptSettings.macroOverrides = [];
          settings.savePromptSettings();
        }}
      >
        <RotateCcw class="h-3 w-3" />
        Reset All Macros
      </Button>
    </div>

    <!-- Simple Macros -->
    <div class="rounded-lg border bg-card p-4">
      <h4 class="text-xs font-medium text-muted-foreground mb-3">
        Simple Macros
      </h4>
      <div class="flex flex-wrap gap-2">
        {#each allMacros.filter((m) => m.type === "simple") as macro}
          <MacroChip
            {macro}
            interactive={true}
            onClick={() => {
              editingMacro = macro;
              showMacroEditor = true;
            }}
          />
        {/each}
      </div>
    </div>

    <!-- Complex Macros -->
    <div class="rounded-lg border bg-card p-4">
      <h4 class="text-xs font-medium text-muted-foreground mb-3">
        Complex Macros (Variant-based)
      </h4>
      <div class="flex flex-wrap gap-2">
        {#each allMacros.filter((m) => m.type === "complex") as macro}
          <MacroChip
            {macro}
            interactive={true}
            onClick={() => {
              editingMacro = macro;
              showComplexMacroEditor = true;
            }}
          />
        {/each}
      </div>
    </div>
  </div>
</div>

<!-- Macro Editor Modals -->
{#if editingMacro && editingMacro.type === "simple"}
  <MacroEditor
    isOpen={showMacroEditor}
    macro={editingMacro as SimpleMacro}
    currentOverride={findMacroOverride(editingMacro.id)}
    onClose={() => {
      showMacroEditor = false;
      editingMacro = null;
    }}
    onSave={(value) => {
      if (editingMacro) {
        handleMacroOverride({ macroId: editingMacro.id, value });
      }
      showMacroEditor = false;
      editingMacro = null;
    }}
    onReset={() => {
      if (editingMacro) {
        handleMacroReset(editingMacro.id);
      }
      showMacroEditor = false;
      editingMacro = null;
    }}
  />
{/if}

{#if editingMacro && editingMacro.type === "complex"}
  <ComplexMacroEditor
    isOpen={showComplexMacroEditor}
    macro={editingMacro as ComplexMacro}
    currentOverride={findMacroOverride(editingMacro.id)}
    onClose={() => {
      showComplexMacroEditor = false;
      editingMacro = null;
    }}
    onSave={(variantOverrides) => {
      if (editingMacro) {
        handleMacroOverride({ macroId: editingMacro.id, variantOverrides });
      }
      showComplexMacroEditor = false;
      editingMacro = null;
    }}
    onReset={() => {
      if (editingMacro) {
        handleMacroReset(editingMacro.id);
      }
      showComplexMacroEditor = false;
      editingMacro = null;
    }}
  />
{/if}
