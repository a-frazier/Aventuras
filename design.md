# Aventura Design Document

> A frontend for immersive adventure roleplay and creative writing, built for flow state.

**Version:** 1.0 Draft  
**Last Updated:** December 2024

---

## Table of Contents

1. [Vision & Philosophy](#1-vision--philosophy)
2. [Architecture Overview](#2-architecture-overview)
3. [Core Systems](#3-core-systems)
4. [Modes](#4-modes)
5. [User Experience](#5-user-experience)
6. [Technical Stack](#6-technical-stack)
7. [Data Models](#7-data-models)
8. [Prompts](#8-prompts)
9. [API & External Services](#9-api--external-services)
10. [Future Considerations](#10-future-considerations)

---

## 1. Vision & Philosophy

### 1.1 Core Philosophy

Aventura is designed around a single principle: **enabling creative flow state**.

Unlike existing tools that optimize for power and flexibility at the cost of complexity, Aventura optimizes for **immersion and creative momentum**. The infrastructure should be invisible. Users should feel less like they're operating software and more like they're writing in a journal that writes back.

### 1.2 Design Principles

| Principle | Description |
|-----------|-------------|
| **Plug and Play** | Minimal configuration required to start. Sensible defaults everywhere. |
| **AI-First** | Use AI for classification, logic, and decision-making rather than brittle heuristics. |
| **Invisible Infrastructure** | Background processes (summarization, image generation, tracking) happen without user awareness. |
| **Modular Architecture** | Semi-independent systems that communicate through events, allowing parallel processing. |
| **Reduced Decision Fatigue** | Pre-selected models, curated options, single quality slider instead of dozens of settings. |

### 1.3 What Breaks Flow State (Anti-Goals)

- Decision fatigue (which model? which settings? which prompt format?)
- Context switching (opening settings panels, managing files, troubleshooting)
- Waiting without engagement (loading screens, spinners)
- Visible "machinery" (seeing JSON, token counts, retry buttons)

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

Aventura uses an **event-driven architecture** with autonomous modules. Each module subscribes to events it cares about, does its work, and emits new events. Modules don't call each other directly—they communicate through events and shared state.

```
┌─────────────────────────────────────────────────────────────────┐
│                         EVENT BUS                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ UserInput │ ContextReady │ NarrativeResponse │ ...        │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
       ┌───────────┬───────────┼───────────┬───────────┐
       ▼           ▼           ▼           ▼           ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
  │ Narrator│ │ Vision  │ │ Memory  │ │ Entries │ │  Voice  │
  │ Module  │ │ Module  │ │ Module  │ │ Module  │ │ Module  │
  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
       │           │           │           │           │
       └───────────┴───────────┼───────────┴───────────┘
                               ▼
                    ┌─────────────────────┐
                    │    SHARED STATE     │
                    │  (Story, Entries,   │
                    │   Chapters, etc.)   │
                    └─────────────────────┘
```

### 2.2 Processing Phases

Every user message flows through distinct phases:

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: PRE-GENERATION (Blocking)                     ~2-4s   │
│                                                                 │
│ ┌─────────────────┐     ┌─────────────────┐                    │
│ │ Memory          │     │ Entry           │                    │
│ │ Retrieval       │     │ Selection       │   ← Run in parallel│
│ └────────┬────────┘     └────────┬────────┘                    │
│          └──────────┬───────────┘                              │
│                     ▼                                           │
│              ContextReady                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: GENERATION (Streaming)                        ~3-6s   │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Narrator generates response (streaming)                 │    │
│ │                                    │                    │    │
│ │                                    ▼                    │    │
│ │                         ┌─────────────────┐             │    │
│ │                         │ TTS (parallel,  │             │    │
│ │                         │ sentence-by-    │             │    │
│ │                         │ sentence)       │             │    │
│ │                         └─────────────────┘             │    │
│ └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: CLASSIFICATION (Fast)                         ~1-2s   │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Classifier analyzes response → structured output        │    │
│ └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: POST-PROCESSING (Parallel, non-blocking)              │
│                                                                 │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │  Vision  │ │ Entries  │ │ Lorebook │ │Summarizer│           │
│ │ (queue)  │ │ (update) │ │ (update) │ │(if thres)│           │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                     │                                          │
│                     ▼                                          │
│              ┌──────────────┐                                  │
│              │ Persistence  │                                  │
│              │ (autosave)   │                                  │
│              └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: BACKGROUND (Async, user unaware)             ~10-30s  │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ Image Generation (appears in UI when ready)             │    │
│ └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Perceived latency:** 2-4 seconds (just memory retrieval)  
**Total background work:** 10-40 seconds (invisible to user)

### 2.3 Event Types

```typescript
type EventType = 
  | 'UserInput'              // User sends a message
  | 'ContextReady'           // Memory + entries prepared for narrator
  | 'ResponseStreaming'      // Tokens arriving from narrator
  | 'SentenceComplete'       // Full sentence ready for TTS
  | 'NarrativeResponse'      // Complete response from narrator
  | 'ClassificationComplete' // Structured analysis ready
  | 'SuggestionsReady'       // AI suggestions generated (creative mode)
  | 'StateUpdated'           // Entries/world state changed
  | 'ChapterCreated'         // New chapter summarized
  | 'ImageQueued'            // Image generation requested
  | 'ImageReady'             // Image generation complete
  | 'SaveComplete';          // Autosave finished
```

### 2.4 Module Summary

| Module | Phase | Blocking? | Description |
|--------|-------|-----------|-------------|
| **Memory** | 1 | Yes | Retrieval decision + parallel chapter queries |
| **Entries** | 1 & 4 | Partial | Provides context (P1), updates state (P4) |
| **Narrator** | 2 | Yes (streaming) | Main story generation |
| **TTS** | 2 | No | Sentence-by-sentence audio generation |
| **Classifier** | 3 | Yes | Structured analysis of response |
| **Vision** | 4 & 5 | No | Queue + generate images |
| **Suggestions** | 4 | No | Generate story direction options (creative mode) |
| **Lore Management** | On-demand | Yes | Agentic lore review and maintenance |
| **Persistence** | 4 | No | Autosave to disk |

---

## 3. Core Systems

### 3.1 Memory System

The memory system tracks story history through chapters and enables intelligent retrieval of past context.

#### 3.1.1 Chapters

A chapter is a segment of chat with an AI-generated summary, defined by its endpoint.

```typescript
interface Chapter {
  id: string;
  number: number;
  
  // Boundaries
  startMessageId: string;
  endMessageId: string;
  messageCount: number;
  
  // Content
  summary: string;
  fullContent: string;        // Actual messages for querying
  
  // Metadata
  createdAt: Date;
  
  // Retrieval optimization
  keywords: string[];
  characters: string[];
  locations: string[];
  plotThreads: string[];
  emotionalTone: string;
}
```

#### 3.1.2 Auto-Summarization

Chapters are created automatically based on thresholds:

- **N (threshold):** Messages before considering a chapter (default: 50)
- **X (buffer):** Recent messages protected from chapter end (default: 10)

When `messagesSinceLastChapter >= N + X`:
1. AI analyzes messages 1 through N
2. AI selects optimal chapter endpoint (natural story beat)
3. Chapter is created with AI-generated summary

**Endpoint Selection Prompt:**

```typescript
async function selectChapterEndpoint(
  messages: Message[],      // Messages in the N window
  existingChapters: Chapter[]
): Promise<EndpointSelection> {
  return await aiCall({
    model: config.models.summarization,
    messages: [{
      role: 'system',
      content: `You analyze story segments to find natural chapter breaks.
                Look for: scene transitions, emotional beats, revelations,
                time skips, or significant character moments.`
    }, {
      role: 'user',
      content: `STORY SEGMENT (messages ${startId} to ${endId}):
${formatMessages(messages)}

PREVIOUS CHAPTER ENDED WITH:
${existingChapters.at(-1)?.summary || 'This is the first chapter.'}

Select the best message ID to end this chapter at. Choose a moment that 
feels like a natural pause - a scene ending, a revelation, a decision made.

Return JSON:
{
  "endMessageId": "msg_xxx",
  "reason": "Why this is a good chapter break",
  "suggestedTitle": "A short evocative title"
}`
    }]
  });
}
```

**Summarization Prompt:**

```typescript
async function summarizeChapter(
  messages: Message[],
  chapterNumber: number
): Promise<string> {
  return await aiCall({
    model: config.models.summarization,
    messages: [{
      role: 'system',
      content: `You create concise chapter summaries for a story. Focus on:
                - Key plot events and decisions
                - Character developments and revelations  
                - Important items, locations, or information introduced
                - Relationship changes
                Keep summaries to 2-4 paragraphs.`
    }, {
      role: 'user',
      content: `CHAPTER ${chapterNumber} CONTENT:
${formatMessages(messages)}

Write a summary capturing the essential events and developments.`
    }]
  });
}
```

**Metadata Extraction:**

After summarization, a fast extraction call pulls structured metadata:

```typescript
interface ChapterMetadata {
  keywords: string[];
  characters: string[];        // Characters who appear
  locations: string[];         // Locations visited
  plotThreads: string[];       // Story threads active/advanced
  emotionalTone: string;       // Overall mood
}
```

This metadata enables faster retrieval decisions without reading full summaries.

#### 3.1.3 Memory Query Tools

The memory system exposes tools that can be used by retrieval and other agentic systems:

```typescript
interface MemoryTools {
  // List available chapters with summaries
  list_chapters(): {
    chapters: {
      number: number;
      summary: string;
      messageRange: { start: number; end: number };
      characters: string[];
      locations: string[];
    }[];
  };
  
  // Query a single chapter with a specific question
  query_chapter(params: {
    chapterNumber: number;
    question: string;
  }): {
    chapterNumber: number;
    question: string;
    answer: string;
  };
  
  // Query a range of chapters (for broader questions)
  query_chapters(params: {
    startChapter: number;
    endChapter: number;
    question: string;
  }): {
    range: { start: number; end: number };
    question: string;
    answer: string;
  };
  
  // Get chapter summary only (no AI call)
  get_chapter_summary(chapterNumber: number): {
    number: number;
    summary: string;
    characters: string[];
    locations: string[];
    plotThreads: string[];
  };
}
```

#### 3.1.4 Retrieval Flow

Before the narrator generates a response, the memory system retrieves relevant context from past chapters.

**Static Retrieval (Default)**

Fast, predictable, runs every turn:

```
UserInput
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. Retrieval Decision (AI call)         │
│    "Given this input and these chapter  │
│     summaries, which chapters matter?"  │
│                                         │
│    Input: user message + chapter list   │
│    Output: [                            │
│      { chapter: 3, query: "What did..." },
│      { chapter: 7, query: "How did..." }
│    ]                                    │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 2. Parallel Query Execution             │
│                                         │
│    ┌─────────┐  ┌─────────┐            │
│    │ Query 3 │  │ Query 7 │ (parallel) │
│    └────┬────┘  └────┬────┘            │
│         └──────┬─────┘                  │
│                ▼                        │
│    Combined retrieval results           │
└─────────────────────────────────────────┘
    │
    ▼
ContextReady → Narrator
```

**Agentic Retrieval (Optional)**

More thorough, for complex situations where the AI needs to explore:

```
UserInput
    │
    ▼
┌─────────────────────────────────────────┐
│ Retrieval Agent Loop                    │
│                                         │
│ Agent has access to:                    │
│ • list_chapters()                       │
│ • query_chapter(n, question)            │
│ • query_chapters(start, end, question)  │
│ • list_entries() (for cross-reference)  │
│ • finish_retrieval(summary)             │
│                                         │
│ Agent iteratively queries until it has  │
│ gathered sufficient context, then calls │
│ finish_retrieval with synthesized info  │
└─────────────────────────────────────────┘
    │
    ▼
ContextReady → Narrator
```

**When to use Agentic Retrieval:**
- Very long stories (50+ chapters) where targeted exploration helps
- Complex queries that reference multiple interrelated events
- User explicitly requests "deep recall"

**Configuration:**

```typescript
interface RetrievalConfig {
  mode: 'static' | 'agentic' | 'auto';
  
  // Static mode settings
  maxQueriesPerTurn: number;        // Default: 5
  maxChaptersPerQuery: number;      // Default: 3
  
  // Agentic mode settings
  maxAgentIterations: number;       // Default: 10
  
  // Auto mode thresholds
  agenticThreshold: number;         // Use agentic if chapters > N (default: 30)
}
```

#### 3.1.5 Query Execution

Individual chapter queries use a focused prompt:

```typescript
async function queryChapter(chapter: Chapter, question: string): Promise<string> {
  return await aiCall({
    model: config.models.query,  // Fast model
    messages: [{
      role: 'system',
      content: `You answer questions about a story chapter. Be specific and 
                include relevant details. If the chapter doesn't contain 
                relevant information, say so briefly.`
    }, {
      role: 'user',
      content: `CHAPTER ${chapter.number} CONTENT:
${chapter.fullContent}

QUESTION: ${question}

Answer concisely with only the relevant information.`
    }]
  });
}
```

For range queries (`query_chapters`), chapter contents are concatenated (respecting token limits) and queried together.

---

### 3.2 Entry System

The entry system unifies "lorebook" (static descriptions) and "tracker" (dynamic state) into a single concept.

#### 3.2.1 Entry Structure

```typescript
interface Entry {
  id: string;
  name: string;
  type: 'character' | 'location' | 'item' | 'faction' | 'concept' | 'event';
  
  // Static content
  description: string;
  hiddenInfo: string;           // Info protagonist doesn't know yet
  aliases: string[];
  
  // Dynamic state (varies by type)
  state: EntryState;
  
  // Mode-specific state
  adventureState?: AdventureEntryState;
  creativeState?: CreativeEntryState;
  
  // Injection rules
  injection: {
    mode: 'always' | 'keyword' | 'relevant' | 'never';
    keywords: string[];
    priority: number;
  };
  
  // Metadata
  firstMentioned: string;
  lastMentioned: string;
  mentionCount: number;
  createdBy: 'user' | 'ai' | 'import';
}
```

#### 3.2.2 Entry State by Type

```typescript
interface CharacterState {
  type: 'character';
  isPresent: boolean;
  lastSeenLocation: string;
  currentDisposition: string;
  relationship: {
    level: number;              // -100 to 100
    status: string;
    history: RelationshipChange[];
  };
  knownFacts: string[];
  revealedSecrets: string[];
}

interface LocationState {
  type: 'location';
  isCurrentLocation: boolean;
  visitCount: number;
  changes: { description: string; messageId: string }[];
  presentCharacters: string[];
  presentItems: string[];
}

interface ItemState {
  type: 'item';
  inInventory: boolean;
  currentLocation: string;
  condition: string;
  uses: { action: string; result: string; messageId: string }[];
}
```

#### 3.2.3 Tiered Injection

Entry injection uses a tiered approach to balance relevance and latency:

```
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1: Always Inject (Zero latency)                           │
│                                                                 │
│ • Current location (isCurrentLocation = true)                  │
│ • Present characters (isPresent = true)                        │
│ • Inventory items (inInventory = true)                         │
│ • Entries marked "always" by user                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIER 2: Name Matching (Zero latency)                           │
│                                                                 │
│ • Fuzzy name/alias match against recent messages + input       │
│ • Catches direct references without AI                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIER 3: LLM Selection (Conditional, parallelized)              │
│                                                                 │
│ • Only runs if entry count > threshold (e.g., 30+)             │
│ • Only considers entries NOT in Tier 1/2                       │
│ • Runs parallel with memory retrieval (no added latency)       │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Classification System

The classifier is the "brain" that analyzes each narrative response and directs all other modules.

#### 3.3.1 Classification Output Schema

```typescript
interface ClassificationResult {
  // For Vision module
  visualElements: {
    textSpan: string;
    type: 'object' | 'character' | 'location' | 'scene';
    importance: 'high' | 'medium' | 'low';
    imagePrompt: string;
    generateImmediately: boolean;
  }[];
  
  // For Entries module
  entryUpdates: {
    updates: {
      entryId: string;
      changes: Partial<EntryState>;
    }[];
    newEntries: {
      name: string;
      type: EntryType;
      description: string;
      aliases: string[];
      initialState: Partial<EntryState>;
    }[];
    scene: {
      newLocationName: string | null;
      presentCharacterIds: string[];
      timeProgression: 'none' | 'minutes' | 'hours' | 'days';
    };
  };
  
  // For Memory module
  chapterAnalysis: {
    shouldCreateChapter: boolean;
    reason: string;
    suggestedTitle: string | null;
  };
  
  // For TTS module
  voiceContext: {
    primarySpeaker: string | null;
    mood: 'neutral' | 'tense' | 'warm' | 'excited' | 'somber';
  };
  
  // Creative Writing mode only
  creativeUpdates?: CreativeClassificationUpdates;
}
```

---

### 3.4 Lore Management Mode

While the Classifier updates entries reactively after each message, Lore Management Mode is a dedicated agentic system for comprehensive lore maintenance.

#### 3.4.1 Purpose

- Review story holistically and identify gaps in tracked lore
- Consolidate scattered information about characters/locations
- Update outdated entries that no longer reflect story state
- Create missing entries for important elements
- Clean up redundant or contradictory entries

#### 3.4.2 When It Runs

- **On-demand:** User triggers via settings/command
- **Suggested:** After major story milestones (e.g., chapter threshold reached)
- **Never automatic:** Always requires user confirmation (it modifies data)

#### 3.4.3 Agent Tools

The Lore Management agent has access to:

```typescript
interface LoreManagementTools {
  // === Entry Operations ===
  
  // Read operations
  list_entries(filter?: { type?: EntryType }): EntryPreview[];
  get_entry(entryId: string): Entry;
  
  // Write operations
  create_entry(entry: NewEntry): Entry;
  update_entry(entryId: string, changes: Partial<Entry>): Entry;
  merge_entries(entryIds: string[], mergedEntry: NewEntry): Entry;
  delete_entry(entryId: string): void;
  
  // === Memory/Story Access ===
  
  // Get recent messages directly
  get_recent_story(messageCount: number): Message[];
  
  // Chapter tools (same as Memory system)
  list_chapters(): ChapterList;
  get_chapter_summary(chapterNumber: number): ChapterSummary;
  query_chapter(chapterNumber: number, question: string): QueryResult;
  query_chapters(startChapter: number, endChapter: number, question: string): QueryResult;
  
  // === Completion ===
  
  finish_lore_management(summary: string): void;
}
```

The memory query tools (`query_chapter`, `query_chapters`) allow the agent to dig into specific chapter content when summaries aren't sufficient. For example:

- "I need to verify when Elena first learned about the Order" → `query_chapters(1, 5, "When did Elena first learn about the Order?")`
- "What exactly did the merchant say about the amulet's origin?" → `query_chapter(3, "What did the merchant reveal about the amulet's origin?")`

#### 3.4.4 Agent Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ LORE MANAGEMENT SESSION                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Agent receives: current entries + recent story + summaries  │
│                                                                 │
│  2. Agent analyzes gaps and inconsistencies                     │
│                                                                 │
│  3. Agent uses tools iteratively:                               │
│     - "I see references to 'the Order' but no entry exists"    │
│     → create_entry({ name: "The Order", type: "faction", ... })│
│                                                                 │
│     - "Elena's description is outdated after Chapter 5"        │
│     → update_entry("elena-id", { description: "..." })         │
│                                                                 │
│     - "Two entries for the same tavern"                        │
│     → merge_entries(["tavern-1", "tavern-2"], { ... })         │
│                                                                 │
│  4. Agent calls finish_lore_management() when done              │
│                                                                 │
│  5. User shown summary of changes for review                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.4.5 User Review

After the agent finishes, user sees:

```
┌─────────────────────────────────────────────────────────────────┐
│ LORE MANAGEMENT COMPLETE                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Changes made:                                                   │
│                                                                 │
│ CREATED (3)                                                     │
│ • The Order (faction) - "A secretive organization that..."     │
│ • Thornwick Market (location) - "The central marketplace..."   │
│ • The Wasting Sickness (concept) - "A mysterious illness..."   │
│                                                                 │
│ UPDATED (2)                                                     │
│ • Elena - Added relationship history with merchant              │
│ • Bronze Amulet - Updated with revealed origin                  │
│                                                                 │
│ MERGED (1)                                                      │
│ • "Silver Stag Tavern" + "The Tavern" → "Silver Stag Tavern"   │
│                                                                 │
│                              [ Accept All ]  [ Review Each ]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.4.6 Lore Management Prompt

```
You are a lore manager for an interactive story. Your job is to 
maintain a consistent, comprehensive database of story elements.

CURRENT ENTRIES:
{entries}

RECENT STORY (last {n} messages):
{recentMessages}

CHAPTER SUMMARIES:
{chapterSummaries}

Your tasks:
1. Identify important characters, locations, items, factions, and 
   concepts that appear in the story but have no entry
2. Find entries that are outdated or incomplete based on story events
3. Identify redundant entries that should be merged
4. Update relationship statuses and character states

Use your tools to make necessary changes. Be conservative - only 
create entries for elements that are genuinely important to the 
story. When finished, call finish_lore_management with a summary.
```

---

### 3.5 Checkpoints

Checkpoints provide simple save/restore functionality without branching complexity.

```typescript
interface Checkpoint {
  id: string;
  name: string;
  createdAt: Date;
  
  snapshot: {
    messageCount: number;
    lastMessageId: string;
    lastMessagePreview: string;
    
    // Deep copies
    messages: Message[];
    entries: Entry[];
    chapters: Chapter[];
  };
}
```

**Operations:**
- **Create:** Deep copy current state
- **Restore:** Replace current state with snapshot
- **Delete:** Remove from array

---

## 4. Modes

Aventura supports two distinct modes optimized for different creative workflows.

### 4.1 Adventure Mode

**User role:** Protagonist  
**Input style:** "I approach the merchant"  
**AI role:** Narrator/GM  
**Focus:** Immersion, discovery, world exploration

#### Key Features
- Second-person POV (typically)
- World state tracking (location, inventory, present characters)
- Relationship tracking with NPCs
- Discovery-based gameplay

#### Prompt Focus
- Sensory details and atmosphere
- Leave space for protagonist decisions
- React to player actions

### 4.2 Creative Writing Mode

**User role:** Author/Director  
**Input style:** "Elena confronts the merchant about the amulet"  
**AI role:** Co-writer  
**Focus:** Craft, structure, narrative arcs

#### Key Features
- Third-person POV (typically)
- AI-generated story direction suggestions
- Plot thread tracking
- Character arc tracking
- Theme tracking
- Setups and payoffs (Chekhov's guns)

#### Narrative State Tracking

```typescript
interface CreativeWritingState {
  // Story structure
  currentAct: number;
  currentBeat: string;
  
  // Plot threads
  plotThreads: {
    id: string;
    name: string;
    status: 'setup' | 'developing' | 'climax' | 'resolved';
    foreshadowing: string[];
    payoffs: string[];
  }[];
  
  // Character arcs
  characterArcs: {
    characterId: string;
    want: string;           // External goal
    need: string;           // Internal growth
    flaw: string;           // What holds them back
    currentState: string;
    keyMoments: { description: string; messageId: string }[];
  }[];
  
  // Themes
  themes: {
    name: string;
    instances: { description: string; messageId: string }[];
  }[];
  
  // Setups awaiting payoff
  setups: {
    description: string;
    messageId: string;
    paidOff: boolean;
    payoffMessageId?: string;
  }[];
  
  // Current scene
  currentScene: {
    location: string;
    charactersPresent: string[];
    tension: 'low' | 'medium' | 'high' | 'climactic';
    purpose: string;
  };
}
```

#### Suggestions System

After each response, AI generates 3 story direction options:

```
┌─────────────────────────────────────────────────────────────────┐
│ WHAT HAPPENS NEXT?                                              │
│                                                                 │
│ ▸ The merchant confesses—he knew her mother                    │
│ ▸ He attacks, revealing he's more than a simple trader         │
│ ▸ A third party interrupts—the city guard arrives              │
│ ▸ Write your own direction...                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Mode Comparison

| Aspect | Adventure Mode | Creative Writing Mode |
|--------|---------------|----------------------|
| User role | Protagonist | Author |
| Input | Actions ("I do X") | Directions ("X happens") |
| POV | Usually 2nd person | Usually 3rd person |
| Tracking focus | World state | Narrative structure |
| AI suggestions | No | Yes |
| Character arcs | Implicit | Explicit tracking |
| Plot threads | Implicit | Explicit tracking |

---

## 5. User Experience

### 5.1 Story Setup Wizard

The wizard collects information to populate the system prompt and initial state.

```
┌─────────────────────────────────────────┐
│ Step 1: Mode Selection                  │
│                                         │
│ ⚔️ Adventure Mode                       │
│ ✒️ Creative Writing Mode                │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Step 2: Genre Selection                 │
│                                         │
│ Fantasy | Sci-Fi | Modern | Horror      │
│ Mystery | Romance | Custom              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Step 3: Setting                         │
│                                         │
│ • Quick prompt (1-2 sentences)          │
│ • AI expand from seed                   │
│ • Import from lorebook                  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Step 4: Protagonist/Characters          │
│                                         │
│ Adventure: Your character               │
│ Creative: Main cast                     │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Step 5: Writing Style                   │
│                                         │
│ POV: 2nd / 3rd limited / 3rd omni      │
│ Tense: Past / Present                   │
│ Tone: (dropdown or freeform)            │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Step 6: Import (Optional)               │
│                                         │
│ Drop lorebook or character card         │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Step 7: Generate Opening                │
│                                         │
│ AI creates opening scene + image        │
│ User can regenerate or edit             │
└─────────────────────────────────────────┘
                    │
                    ▼
              Story Begins
```

### 5.2 Main Interface

#### Adventure Mode

```
┌─────────────────────────────────────────────────────────────────┐
│  AVENTURA                                              [ ⚙ ]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │              [Current Scene Image]                      │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  The tavern's warmth hits you immediately—smoke from the        │
│  hearth, the smell of stew, low murmurs of conversation.        │
│  A ⟦curious bronze amulet⟧ rests on the table between you      │
│  and the merchant.                                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  │ I examine the amulet more closely...                     │  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Creative Writing Mode

```
┌─────────────────────────────────────────────────────────────────┐
│  AVENTURA - Creative Writing                           [ ⚙ ]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Elena's hand trembled as she held the amulet up to the         │
│  lamplight. The inscription—she knew that symbol. She'd         │
│  seen it once before, in her mother's journal, the night        │
│  before she vanished.                                           │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ▸ Elena confronts the merchant about the symbol         │   │
│  │ ▸ She pockets the amulet and flees before he notices    │   │
│  │ ▸ A memory surfaces—her mother's final words            │   │
│  │ ▸ Write direction...                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Story Map]  [Characters]  [Plot Threads]  [Outline]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Embedded Images

Visual elements are highlighted in text and expand on click:

```
Text: "A ⟦curious bronze amulet⟧ rests on the table"
      └──────────┬──────────┘
                 │ click
                 ▼
┌──────────────────────────────────────┐
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │     [Generated amulet image]   │  │
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  A bronze amulet, tarnished with     │
│  age, bearing an inscription in a    │
│  language you don't recognize.       │
│                                      │
│                          [ Close ]   │
└──────────────────────────────────────┘
```

### 5.4 Settings Panel

Settings are hidden by default, accessible via gear icon. Users shouldn't need to open this during normal play.

**Settings Categories:**
- **Story Settings** - Genre, style, custom instructions
- **Models** - Quality tier slider or advanced model selection
- **Memory** - Chapter thresholds, retrieval settings
- **Entries** - View/edit, injection mode
- **Voice** - TTS provider, voice selection
- **Images** - Provider, style, auto-generation toggle
- **Checkpoints** - View, create, restore, delete
- **Import/Export** - Lorebook import, story export

### 5.5 Quality Tier (Simplified Model Selection)

Instead of model dropdowns, a single slider:

| Tier | Description | Models Used |
|------|-------------|-------------|
| **Swift** | Faster, cheaper | Fast models for all tasks |
| **Balanced** | Good defaults | Mix of quality and speed |
| **Vivid** | Best quality | Flagship models, higher cost |

Advanced users can override individual model assignments in settings.

---

## 6. Technical Stack

### 6.1 Framework

**Tauri** - Rust backend + Web frontend

| Component | Technology |
|-----------|------------|
| Backend | Rust (Tauri) |
| Frontend | Svelte or Vue + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |

### 6.2 Rust Backend Responsibilities

- File I/O (save/load projects)
- Spawning local processes (Kokoro TTS)
- Secure API key storage
- System tray, native notifications

### 6.3 TypeScript Frontend Responsibilities

- All UI rendering
- Event bus implementation
- API calls to OpenRouter/image providers
- Module logic
- State management

### 6.4 External Services

| Service | Provider | Purpose |
|---------|----------|---------|
| LLM | OpenRouter | All text generation |
| Images | OpenRouter / NanoGPT / Chutes | Image generation |
| TTS (Cloud) | Configurable | Voice synthesis |
| TTS (Local) | Kokoro | Local voice synthesis |

---

## 7. Data Models

### 7.1 Project Structure

```
my_story.aventura/
├── manifest.json              # Story metadata, settings
├── state/
│   ├── entries.json           # All entries
│   ├── adventure-state.json   # Adventure mode state (if applicable)
│   └── creative-state.json    # Creative mode state (if applicable)
├── history/
│   └── messages.jsonl         # Chat history (append-only)
├── memory/
│   └── chapters.json          # Chapter summaries
├── checkpoints/
│   └── {id}.json              # Checkpoint snapshots
├── assets/
│   └── images/
│       └── {id}.webp          # Generated images
└── imports/
    └── lorebook.json          # Original imported data
```

### 7.2 Core Interfaces

```typescript
// Message
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  
  // Visual elements in this message
  visualElements?: {
    textSpan: string;
    imageId: string;
  }[];
  
  // Metadata
  chapterId?: string;           // Which chapter this belongs to
  tokensUsed?: number;
}

// Story Configuration
interface StoryConfig {
  mode: 'adventure' | 'creative-writing';
  genre: string;
  setting: string;
  
  // Adventure mode
  protagonistDescription?: string;
  
  // Creative mode
  premise?: string;
  mainCharacters?: string[];
  
  // Writing style
  writingStyle: {
    pov: 'second' | 'third-limited' | 'third-omniscient';
    tense: 'past' | 'present';
    tone: string;
    prose?: string;
  };
  
  customInstructions?: string;
}

// Memory Configuration
interface MemoryConfig {
  chapterThreshold: number;       // N (default: 50)
  chapterBuffer: number;          // X (default: 10)
  autoSummarize: boolean;
  enableRetrieval: boolean;
  maxChaptersPerRetrieval: number;
}

// Entry Configuration
interface EntryConfig {
  enableLLMSelection: boolean;
  llmThreshold: number;           // Only use LLM if >N entries
  injectionMode: 'auto' | 'all' | 'state-only';
  maxEntryTokens: number;
}
```

### 7.3 Event Bus Implementation

```typescript
interface AventuraEvent<T = unknown> {
  type: EventType;
  payload: T;
  timestamp: Date;
  id: string;
}

class EventBus {
  private listeners: Map<EventType, Set<Handler>> = new Map();
  private eventLog: AventuraEvent[] = [];
  
  subscribe(type: EventType, handler: Handler): Unsubscribe;
  emit<T>(type: EventType, payload: T): void;
  getRecentEvents(count?: number): AventuraEvent[];
}
```

### 7.4 Module Interface

```typescript
interface Module {
  name: string;
  triggers: EventType[];
  initialize(): Promise<void>;
  cleanup(): void;
}

class ModuleManager {
  register(module: Module): void;
  async initializeAll(): Promise<void>;
}
```

---

## 8. Prompts

### 8.1 Narrator Prompt (Adventure Mode)

```
You are the narrator of an interactive {genre} story.

SETTING:
{setting}

PROTAGONIST:
{protagonistDescription}

WRITING STYLE:
- POV: {pov}
- Tense: {tense}
- Tone: {tone}

NARRATION GUIDELINES:
- Write 2-4 paragraphs per response unless shorter is natural
- Focus on sensory details and character reactions
- Leave space for the protagonist to act; don't assume their decisions
- Dialogue should feel natural to the characters and setting
- Maintain consistency with established facts

{customInstructions}
```

### 8.2 Narrator Prompt (Creative Writing Mode)

```
You are a skilled fiction writer collaborating on a {genre} story.

STORY PREMISE:
{premise}

WRITING STYLE:
- POV: {pov}
- Tense: {tense}
- Tone: {tone}
- Prose style: {prose}

YOUR ROLE:
- Write vivid, engaging prose following the author's direction
- Maintain consistency with established characters and plot
- Craft scenes with purpose—each should advance plot or character
- Use subtext and implication; avoid over-explanation
- Balance action, dialogue, and interiority

COLLABORATION GUIDELINES:
- Follow the author's direction for what happens
- Add detail, texture, and craft to their vision
- If direction is vague, make interesting choices
- Maintain the story's voice and tone

{customInstructions}
```

### 8.3 Context Block Template

```
[STORY CONTEXT]

CURRENT LOCATION: {location.name}
{location.description}

PRESENT:
• {character.name}: {character.description} ({character.disposition})
...

INVENTORY: {items.join(', ')}

RELEVANT CONTEXT:
• {entry.name}: {entry.description}
...

FROM EARLIER IN THE STORY:
{retrievedContext}

[/STORY CONTEXT]
```

### 8.4 Classifier Prompt

```
You analyze story responses and extract structured information.
You MUST respond with valid JSON matching the exact schema provided.
Be precise and conservative—only note changes that clearly occurred.

PASSAGE:
"""
{narrativeResponse}
"""

KNOWN ENTRIES:
{entries as JSON}

CHAPTER INFO:
- Messages since last chapter: {count}
- Chapter threshold: {threshold}

Respond with JSON matching this schema:
{schema}

Guidelines:
- Only include visualElements for notable objects, new characters, or significant scenes
- Only include entryUpdates for actual changes—omit if nothing changed
- Only set shouldCreateChapter=true if there's a natural story beat AND past threshold
```

### 8.5 Retrieval Decision Prompt

```
You are deciding what past story context is relevant for the next response.

CURRENT SCENE:
{recentMessages}

USER'S NEW INPUT:
{userInput}

CHAPTER SUMMARIES:
{chapters with numbers, summaries, characters, locations}

Based on the user's input and current scene, which chapters contain 
information the narrator needs?

Consider:
- Characters mentioned or present who appeared in past chapters
- Locations being revisited
- Plot threads being referenced
- Items or information from the past
- Relationships that have history

Return JSON with chapters to query and specific questions for each.
Only query chapters that are ACTUALLY relevant. Often, no queries are needed.
```

### 8.6 Suggestions Prompt (Creative Mode)

```
You suggest story directions for a collaborative fiction project.

Current scene ended with:
"""
{lastParagraphs}
"""

STORY STATE:
- Active threads: {threads}
- Unpaid setups: {setups}
- Current tension: {tension}

Generate 3 distinct directions the story could go next.
Each should be:
- A single sentence describing what happens
- Varied in tone/approach
- Specific enough to write toward, vague enough to allow creativity

Return as JSON array of 3 strings.
```

---

## 9. API & External Services

### 9.1 OpenRouter Integration

All LLM calls go through OpenRouter for simplicity.

```typescript
interface OpenRouterConfig {
  apiKey: string;
  
  // Model assignments by role
  models: {
    narrator: string;           // Main story generation
    classifier: string;         // Fast structured extraction
    retrieval: string;          // Retrieval decisions
    summarization: string;      // Chapter summaries
    suggestions: string;        // Story suggestions (creative mode)
  };
  
  // Or use quality tier
  qualityTier: 'swift' | 'balanced' | 'vivid';
}
```

### 9.2 Quality Tier Model Mapping

| Role | Swift | Balanced | Vivid |
|------|-------|----------|-------|
| Narrator | claude-3-haiku | claude-3.5-sonnet | claude-3-opus |
| Classifier | gpt-4o-mini | gpt-4o-mini | gpt-4o |
| Retrieval | gpt-4o-mini | gpt-4o-mini | gpt-4o-mini |
| Summarization | claude-3-haiku | claude-3.5-sonnet | claude-3.5-sonnet |
| Suggestions | gpt-4o-mini | claude-3.5-sonnet | claude-3-opus |

*(Models subject to change based on availability and performance)*

### 9.3 Image Generation

Supported providers:
- OpenRouter (via compatible models)
- NanoGPT
- Chutes API

### 9.4 TTS Providers

| Provider | Type | Notes |
|----------|------|-------|
| Kokoro | Local | Free, private, requires setup |
| ElevenLabs | Cloud | High quality, voice cloning |
| OpenAI TTS | Cloud | Good quality, simple API |

### 9.5 Error Handling

**Retry Strategy:**
- API failures: Retry up to 5 times with exponential backoff
- Classification parse failures: Retry prompt up to 5 times
- After 5 failures: Surface error to user

**Graceful Degradation:**
- If image generation fails: Continue without image, log error
- If TTS fails: Continue without audio, log error
- If classification fails: Skip post-processing for that message

---

## 10. Future Considerations

Items explicitly deferred from v1:

### 10.1 Deferred Features

| Feature | Reason for Deferral |
|---------|---------------------|
| Branching | Complexity; checkpoints provide 90% of value |
| Collaborative/multiplayer | Scope; v1 is single-player |
| Plugin system | Need stable core first |
| Mobile app | Desktop first |
| Offline mode | Requires local models |
| Voice input | Nice-to-have, not core |

### 10.2 Potential v2 Features

- **Story analytics** - Word counts, pacing graphs, character screen time
- **Export to formats** - ePub, PDF, manuscript format
- **Template library** - Pre-built story structures, genre templates
- **Character voice profiles** - Different TTS voices per character
- **Mood-based music** - Background audio that shifts with story tension
- **Writing sprints** - Timed writing sessions with goals

### 10.3 Performance Optimizations to Consider

- **Incremental summarization** - Update chapter summaries as messages come in
- **Entry embedding cache** - Pre-compute embeddings for semantic search
- **Predictive image generation** - Start generating likely images before needed
- **Response caching** - Cache retrieval results for repeated patterns

---

## Appendix A: Module Specifications

### A.1 Memory Module

```typescript
class MemoryModule implements Module {
  name = 'memory';
  triggers = ['UserInput', 'ClassificationComplete'];
  
  private config: MemoryConfig;
  
  // === TOOLS (exposed to agentic systems) ===
  
  tools: MemoryTools = {
    list_chapters: () => {
      return getChapters().map(ch => ({
        number: ch.number,
        summary: ch.summary,
        messageRange: { start: ch.startMessageId, end: ch.endMessageId },
        characters: ch.characters,
        locations: ch.locations
      }));
    },
    
    query_chapter: async ({ chapterNumber, question }) => {
      const chapter = getChapter(chapterNumber);
      if (!chapter) throw new Error(`Chapter ${chapterNumber} not found`);
      
      const answer = await this.executeQuery(chapter, question);
      return { chapterNumber, question, answer };
    },
    
    query_chapters: async ({ startChapter, endChapter, question }) => {
      const chapters = getChaptersInRange(startChapter, endChapter);
      const combinedContent = chapters.map(ch => 
        `=== Chapter ${ch.number} ===\n${ch.fullContent}`
      ).join('\n\n');
      
      const answer = await this.executeRangeQuery(combinedContent, question);
      return { range: { start: startChapter, end: endChapter }, question, answer };
    },
    
    get_chapter_summary: (chapterNumber) => {
      const chapter = getChapter(chapterNumber);
      if (!chapter) throw new Error(`Chapter ${chapterNumber} not found`);
      return {
        number: chapter.number,
        summary: chapter.summary,
        characters: chapter.characters,
        locations: chapter.locations,
        plotThreads: chapter.plotThreads
      };
    }
  };
  
  // === PHASE 1: Pre-generation retrieval ===
  
  async handleUserInput(event: UserInputEvent): Promise<void> {
    const chapters = getChapters();
    
    // Skip if no history
    if (chapters.length === 0) {
      eventBus.emit('ContextReady', { 
        retrievedContext: null,
        userInput: event.text 
      });
      return;
    }
    
    // Choose retrieval mode
    const useAgentic = this.config.mode === 'agentic' || 
      (this.config.mode === 'auto' && chapters.length > this.config.agenticThreshold);
    
    const context = useAgentic 
      ? await this.agenticRetrieval(event.text, chapters)
      : await this.staticRetrieval(event.text, chapters);
    
    eventBus.emit('ContextReady', { 
      retrievedContext: context, 
      userInput: event.text 
    });
  }
  
  private async staticRetrieval(
    userInput: string, 
    chapters: Chapter[]
  ): Promise<RetrievedContext> {
    // 1. Decide what to query
    const decision = await this.decideRetrieval(userInput, chapters);
    
    // 2. Execute queries in parallel
    const queryPromises = decision.queries.map(q => 
      this.tools.query_chapter({ 
        chapterNumber: q.chapter, 
        question: q.question 
      })
    );
    
    const results = await Promise.all(queryPromises);
    
    return {
      queriedChapters: results,
      retrievalTimestamp: new Date()
    };
  }
  
  private async agenticRetrieval(
    userInput: string, 
    chapters: Chapter[]
  ): Promise<RetrievedContext> {
    // Agent loop with tool access
    let complete = false;
    let iterations = 0;
    let gatheredContext: QueryResult[] = [];
    let messages = [{ role: 'user', content: this.buildAgentPrompt(userInput, chapters) }];
    
    while (!complete && iterations < this.config.maxAgentIterations) {
      const response = await this.callRetrievalAgent(messages);
      
      for (const toolCall of response.toolCalls) {
        if (toolCall.name === 'finish_retrieval') {
          complete = true;
          break;
        }
        
        const result = await this.tools[toolCall.name](toolCall.args);
        gatheredContext.push(result);
        
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'tool', content: JSON.stringify(result) });
      }
      
      iterations++;
    }
    
    return {
      queriedChapters: gatheredContext,
      retrievalTimestamp: new Date()
    };
  }
  
  // === PHASE 4: Chapter creation ===
  
  async handleClassificationComplete(event: ClassificationEvent): Promise<void> {
    if (!event.chapterAnalysis.shouldCreateChapter) return;
    
    const endpoint = event.chapterAnalysis.suggestedEndpoint;
    await this.createChapter(endpoint);
  }
  
  private async createChapter(endpoint: EndpointSelection): Promise<Chapter> {
    const messages = getMessagesSinceLastChapter(endpoint.endMessageId);
    
    // Generate summary
    const summary = await this.summarizeChapter(messages);
    
    // Extract metadata
    const metadata = await this.extractMetadata(messages, summary);
    
    const chapter: Chapter = {
      id: generateId(),
      number: getChapters().length + 1,
      startMessageId: getLastChapterEnd() || messages[0].id,
      endMessageId: endpoint.endMessageId,
      messageCount: messages.length,
      summary,
      fullContent: formatMessages(messages),
      createdAt: new Date(),
      ...metadata
    };
    
    saveChapter(chapter);
    
    eventBus.emit('ChapterCreated', { chapter });
    
    return chapter;
  }
}
```

### A.2 Narrator Module

```typescript
class NarratorModule implements Module {
  name = 'narrator';
  triggers = ['ContextReady'];
  
  async handleContextReady(event: ContextReadyEvent): Promise<void> {
    const prompt = this.buildPrompt(event.retrievedContext, event.userInput);
    const stream = await this.generate(prompt);
    
    let fullResponse = '';
    let sentenceBuffer = '';
    
    for await (const chunk of stream) {
      fullResponse += chunk;
      sentenceBuffer += chunk;
      
      eventBus.emit('ResponseStreaming', { chunk });
      
      const sentences = this.extractCompleteSentences(sentenceBuffer);
      for (const sentence of sentences.complete) {
        eventBus.emit('SentenceComplete', { text: sentence });
      }
      sentenceBuffer = sentences.remainder;
    }
    
    eventBus.emit('NarrativeResponse', { 
      messageId: generateId(),
      content: fullResponse 
    });
  }
}
```

### A.3 Classifier Module

```typescript
class ClassifierModule implements Module {
  name = 'classifier';
  triggers = ['NarrativeResponse'];
  
  async handleNarrativeResponse(event: NarrativeEvent): Promise<void> {
    const classification = await this.classify(event.content);
    
    eventBus.emit('ClassificationComplete', {
      messageId: event.messageId,
      ...classification
    });
  }
}
```

### A.4 Vision Module

```typescript
class VisionModule implements Module {
  name = 'vision';
  triggers = ['ClassificationComplete'];
  
  private queue: ImageJob[] = [];
  private activeGenerations = 0;
  private maxConcurrent = 2;
  
  async handleClassificationComplete(event: ClassificationEvent): Promise<void> {
    for (const element of event.visualElements) {
      if (element.generateImmediately || element.importance === 'high') {
        this.queue.push(this.createJob(element, event.messageId));
      }
    }
    
    this.queue.sort((a, b) => a.priority - b.priority);
    this.processQueue();
  }
  
  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeGenerations < this.maxConcurrent) {
      const job = this.queue.shift()!;
      this.activeGenerations++;
      
      this.generateImage(job).finally(() => {
        this.activeGenerations--;
        this.processQueue();
      });
    }
  }
}
```

### A.5 TTS Module

```typescript
class TTSModule implements Module {
  name = 'tts';
  triggers = ['SentenceComplete'];
  
  private queue: AudioSegment[] = [];
  private isPlaying = false;
  
  async handleSentenceComplete(event: SentenceEvent): Promise<void> {
    const audio = await this.synthesize(event.text);
    this.queue.push(audio);
    this.playNext();
  }
  
  private async playNext(): Promise<void> {
    if (this.isPlaying || this.queue.length === 0) return;
    
    this.isPlaying = true;
    const segment = this.queue.shift()!;
    await this.playAudio(segment);
    this.isPlaying = false;
    this.playNext();
  }
}
```

### A.6 Entries Module

```typescript
class EntriesModule implements Module {
  name = 'entries';
  triggers = ['UserInput', 'ClassificationComplete'];
  
  // Phase 1: Provide context (called directly, not via event)
  async getRelevantEntries(
    userInput: string,
    recentMessages: Message[]
  ): Promise<Entry[]> {
    const tier1 = this.getStateBasedEntries();
    const tier2 = this.getNameMatchedEntries(userInput, recentMessages);
    
    const remaining = this.getRemainingEntries(tier1, tier2);
    
    if (remaining.length > this.config.llmThreshold) {
      const tier3 = await this.llmSelectEntries(remaining, userInput);
      return [...tier1, ...tier2, ...tier3];
    }
    
    return [...tier1, ...tier2];
  }
  
  // Phase 4: Update state
  async handleClassificationComplete(event: ClassificationEvent): Promise<void> {
    for (const update of event.entryUpdates.updates) {
      await this.updateEntry(update.entryId, update.changes);
    }
    
    for (const newEntry of event.entryUpdates.newEntries) {
      await this.createEntry(newEntry);
    }
    
    eventBus.emit('StateUpdated', { entries: getAllEntries() });
  }
}
```

### A.7 Suggestions Module (Creative Mode)

```typescript
class SuggestionsModule implements Module {
  name = 'suggestions';
  triggers = ['NarrativeResponse'];
  
  async handleNarrativeResponse(event: NarrativeEvent): Promise<void> {
    if (getMode() !== 'creative-writing') return;
    if (!this.config.enableSuggestions) return;
    
    const suggestions = await this.generateSuggestions(event.content);
    
    eventBus.emit('SuggestionsReady', { suggestions });
  }
}
```

### A.8 Lore Management Module

```typescript
class LoreManagementModule implements Module {
  name = 'lore-management';
  triggers = [];  // On-demand only, not event-triggered
  
  private tools: LoreManagementTools;
  private changes: LoreChange[] = [];
  
  async runSession(): Promise<LoreManagementResult> {
    this.changes = [];
    
    const context = {
      entries: getAllEntries(),
      recentMessages: getRecentMessages(100),
      chapterSummaries: getChapterSummaries()
    };
    
    // Agent loop with tool calls
    let complete = false;
    let messages = [{ role: 'user', content: this.buildPrompt(context) }];
    
    while (!complete) {
      const response = await this.callAgent(messages);
      
      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(toolCall);
        
        if (toolCall.name === 'finish_lore_management') {
          complete = true;
        }
        
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'tool', content: result });
      }
    }
    
    return {
      changes: this.changes,
      summary: this.changes[this.changes.length - 1]?.summary || ''
    };
  }
  
  private async executeTool(toolCall: ToolCall): Promise<string> {
    switch (toolCall.name) {
      case 'create_entry':
        const created = await createEntry(toolCall.args);
        this.changes.push({ type: 'create', entry: created });
        return JSON.stringify(created);
        
      case 'update_entry':
        const updated = await updateEntry(toolCall.args.id, toolCall.args.changes);
        this.changes.push({ type: 'update', entry: updated, previous: toolCall.args.previous });
        return JSON.stringify(updated);
        
      case 'merge_entries':
        const merged = await mergeEntries(toolCall.args.ids, toolCall.args.merged);
        this.changes.push({ type: 'merge', entry: merged, mergedFrom: toolCall.args.ids });
        return JSON.stringify(merged);
        
      case 'delete_entry':
        const deleted = await deleteEntry(toolCall.args.id);
        this.changes.push({ type: 'delete', entry: deleted });
        return 'Deleted';
        
      case 'finish_lore_management':
        this.changes.push({ type: 'complete', summary: toolCall.args.summary });
        return 'Session complete';
        
      default:
        // Read-only operations
        return JSON.stringify(await this.tools[toolCall.name](toolCall.args));
    }
  }
}

interface LoreChange {
  type: 'create' | 'update' | 'merge' | 'delete' | 'complete';
  entry?: Entry;
  previous?: Partial<Entry>;
  mergedFrom?: string[];
  summary?: string;
}

interface LoreManagementResult {
  changes: LoreChange[];
  summary: string;
}
```

---

## Appendix B: SillyTavern Import

### B.1 Lorebook Format Conversion

```typescript
interface STLorebookEntry {
  uid: string;
  key: string[];
  content: string;
  extensions: {
    position?: number;
    disable?: boolean;
    // ...
  };
}

function convertSTLorebook(stLorebook: STLorebook): Entry[] {
  return stLorebook.entries.map(stEntry => ({
    id: generateId(),
    name: stEntry.key[0] || 'Unnamed',
    type: inferType(stEntry),
    description: stEntry.content,
    aliases: stEntry.key.slice(1),
    state: inferInitialState(stEntry),
    injection: {
      mode: stEntry.extensions.disable ? 'never' : 'keyword',
      keywords: stEntry.key,
      priority: stEntry.extensions.position || 0
    },
    createdBy: 'import'
  }));
}
```

### B.2 Character Card Import

Character cards can seed:
- Protagonist description (adventure mode)
- Main character entry (creative mode)
- Setting description
- Initial entries from embedded lorebook

---

*End of Design Document*
