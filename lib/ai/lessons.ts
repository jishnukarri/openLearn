import "server-only";
import { chatJson, type ProviderConfig } from "./client";

// ── Interactive pre-lesson widget ───────────────────────────────────────────
// Generated for a specific subject archetype. Follows the Interact →
// Observe → Codify pattern. Always optional (null on old/plain lessons).

export type SliderOutcome = {
  minThreshold: number; // 0–100 (percent of slider range)
  maxThreshold: number;
  label: string;       // short label for badge
  description: string; // 1-2 sentences describing what student observes
};

export type InteractiveSliderSim = {
  kind: "slider_sim";
  title: string;
  description: string; // sets the scene before the slider
  sliders: Array<{ id: string; label: string; min: number; max: number; step: number; unit: string; default: number }>;
  outcomes: SliderOutcome[];
  codify: string;
};

export type InteractiveBranching = {
  kind: "branching";
  scenario: string;
  choices: Array<{ id: string; label: string; consequence: string; isOptimal: boolean }>;
  codify: string;
};

export type InteractiveGraph = {
  kind: "graph";
  title: string;
  curveType: "parabola" | "line" | "sine" | "exponential";
  params: Array<{ name: string; label: string; min: number; max: number; step: number; default: number }>;
  observations: string[];
  codify: string;
};

export type InteractiveBlockSort = {
  kind: "block_sort";
  prompt: string;
  blocks: string[];     // displayed in shuffled order
  correctOrder: number[]; // indices into blocks[] that form correct sequence
  codify: string;
};

export type InteractiveFlowchart = {
  kind: "flowchart";
  prompt: string;
  steps: Array<{ label: string; description: string }>;
  correctOrder: number[]; // indices into steps[] for correct sequence
  codify: string;
};

export type InteractiveCategorize = {
  kind: "categorize";
  prompt: string;
  categories: Array<{ label: string }>;  // 2-4 named columns
  items: string[];                        // cards to sort
  correctMapping: number[];               // index into categories[] for each item
  codify: string;
};

export type LessonInteractive =
  | InteractiveSliderSim
  | InteractiveBranching
  | InteractiveGraph
  | InteractiveBlockSort
  | InteractiveFlowchart
  | InteractiveCategorize;

// ── Lesson quick-checks ─────────────────────────────────────────────────────
// Lesson quick-checks: all auto-marked in the player, no AI at answer time.
// The bare `{question, options, correctIndex}` shape (no `kind`) is the
// original single-answer MCQ — kept exactly as-is so stored lessons work.
export type LessonCheck =
  | { kind?: "mcq"; question: string; options: string[]; correctIndex: number }
  | { kind: "multi"; question: string; options: string[]; correctIndexes: number[] }
  | { kind: "short"; question: string; accepted: string[]; wordBank?: string[] }
  | { kind: "matching"; question: string; pairs: { left: string; right: string }[] };

// An optional visual per section. The model writes structure only — every
// style/class is stripped and SVG colors are limited to theme tokens by
// lib/lesson-sanitize.ts; `image` visuals get their `url` filled in by
// lib/lesson-finalize.ts (generated and stored server-side).
export type LessonVisual =
  | { kind: "svg"; svg: string; caption?: string }
  | { kind: "html"; html: string }
  | { kind: "image"; prompt: string; alt: string; url?: string };

export type LessonSection = {
  heading: string;
  explanation: string;
  example: string;
  visual?: LessonVisual | null;
  visualPosition?: "top" | "middle" | "bottom";
  check: LessonCheck;
};

export type LessonContent = {
  hook?: string; // 1-sentence challenge that opens the lesson — optional for backward compat
  interactive?: LessonInteractive | null;
  sections: LessonSection[];
};

const INTERACTIVE_SCHEMA = {
  type: "object",
  description: "Pre-lesson interactive widget — follow the Interact → Observe → Codify pattern for the subject archetype.",
  properties: {
    kind: { type: "string", enum: ["slider_sim", "branching", "graph", "block_sort", "flowchart", "categorize"] },
    // slider_sim
    title: { type: "string" },
    description: { type: "string" },
    sliders: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          min: { type: "number" },
          max: { type: "number" },
          step: { type: "number" },
          unit: { type: "string" },
          default: { type: "number" },
        },
        required: ["id", "label", "min", "max", "step", "unit", "default"],
      },
    },
    outcomes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          minThreshold: { type: "number" },
          maxThreshold: { type: "number" },
          label: { type: "string" },
          description: { type: "string" },
        },
        required: ["minThreshold", "maxThreshold", "label", "description"],
      },
    },
    // branching
    scenario: { type: "string" },
    choices: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          consequence: { type: "string" },
          isOptimal: { type: "boolean" },
        },
        required: ["id", "label", "consequence", "isOptimal"],
      },
    },
    // graph
    curveType: { type: "string", enum: ["parabola", "line", "sine", "exponential"] },
    params: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          label: { type: "string" },
          min: { type: "number" },
          max: { type: "number" },
          step: { type: "number" },
          default: { type: "number" },
        },
        required: ["name", "label", "min", "max", "step", "default"],
      },
    },
    observations: { type: "array", items: { type: "string" } },
    // block_sort
    prompt: { type: "string" },
    blocks: { type: "array", items: { type: "string" } },
    correctOrder: { type: "array", items: { type: "integer" } },
    // flowchart
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          description: { type: "string" },
        },
        required: ["label", "description"],
      },
    },
    // categorize
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" } },
        required: ["label"],
      },
    },
    items: { type: "array", items: { type: "string" } },
    correctMapping: { type: "array", items: { type: "integer" } },
    // shared
    codify: { type: "string" },
  },
  required: ["kind", "codify"],
};

const SCHEMA = {
  type: "object",
  properties: {
    hook: {
      type: "string",
      description:
        "One punchy sentence that frames the lesson as a puzzle or challenge (e.g. 'Can you figure out what the atomic number actually counts?'). No markdown.",
    },
    interactive: INTERACTIVE_SCHEMA,
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          explanation: { type: "string" },
          example: { type: "string" },
          visual: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["svg", "html", "image"] },
              svg: { type: "string" },
              html: { type: "string" },
              caption: { type: "string" },
              prompt: { type: "string" },
              alt: { type: "string" },
            },
            required: ["kind"],
          },
          check: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: ["mcq", "multi", "short", "matching"],
              },
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              correctIndex: { type: "integer" },
              correctIndexes: { type: "array", items: { type: "integer" } },
              accepted: { type: "array", items: { type: "string" } },
              wordBank: {
                type: "array",
                items: { type: "string" },
                description:
                  "For 'short' kind only: 6-10 individual word tiles the student taps to build their answer. Include all words needed to form accepted answers (split multi-word answers into separate tiles) plus 3-4 subject-specific distractors — these must be plausible wrong answers from the same subject domain (e.g. for a vectors question: 'scalar', 'magnitude', 'displacement' — NOT common English words like 'circle', 'number' that any student can dismiss without subject knowledge).",
              },
              pairs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    left: { type: "string" },
                    right: { type: "string" },
                  },
                  required: ["left", "right"],
                },
              },
            },
            // options/correctIndex are always required, even for kinds that
            // don't use them (short/matching) — a provider under strict
            // JSON-schema mode is otherwise free to omit correctIndex for
            // "mcq" checks entirely, which silently breaks marking (every
            // option reads as wrong since idx === undefined is never true).
            required: ["kind", "question", "options", "correctIndex"],
          },
        },
        required: ["heading", "explanation", "example", "check"],
      },
    },
  },
  required: ["hook", "interactive", "sections"],
};

// Shared prompt snippet describing when and how a section may carry a
// visual. Kept in lockstep with the allowlists in lib/lesson-sanitize.ts
// and the theme tokens in app/globals.css.
const VISUAL_GUIDE =
  `\n\nOptionally, a section may include a "visual" when (and only when) a ` +
  `picture genuinely teaches the idea better than words. Pick the first that fits:\n` +
  `1. kind "svg" — for diagrammable ideas (graphs, cycles, forces, labelled ` +
  `structures). Inline SVG with a viewBox (around 0 0 400 240), no fixed ` +
  `pixel width. Allowed tags: svg, g, path, line, polyline, polygon, rect, ` +
  `circle, ellipse, text, tspan, defs, marker, title. Colors ONLY via ` +
  `fill/stroke set to currentColor, none, or one of: var(--color-primary), ` +
  `var(--color-secondary), var(--color-highlight), var(--color-success), ` +
  `var(--color-error), var(--color-muted), var(--color-border), ` +
  `var(--color-surface).\n` +
  `2. kind "html" — for structural content (comparison tables, step lists, ` +
  `labelled figures). Allowed tags: p, ul, ol, li, table, thead, tbody, tr, ` +
  `th, td, strong, em, code, pre, blockquote, figure, figcaption, br, sub, ` +
  `sup, h4.\n` +
  `3. kind "image" — only when a realistic picture is essential. Write a ` +
  `"prompt" describing the image for an image generator plus an "alt" text. ` +
  `Never write a URL.\n` +
  `NEVER write style or class attributes anywhere — the site applies all ` +
  `styling. Most sections should have no visual at all.`;

// AI picks the best interactive kind for the topic — no admin input needed.
const INTERACTIVE_GUIDE =
  `\n\nAlso generate an "interactive" field. Choose the kind that best fits ` +
  `this specific topic — pick the one that will give students the most ` +
  `intuitive "aha" moment before any explanation:\n\n` +
  `- "slider_sim": best for cause-and-effect topics (physics, chemistry, ` +
  `biology). Add exactly 1 slider for the single key variable (outcomes can only depend on that one slider). Provide 3 outcome bands ordered from the slider's low end to its high end, each describing what that slider value causes ` +
  `(minThreshold/maxThreshold as 0-100% of slider range, label, description). ` +
  `title + description set the scene. Example: concentration slider that ` +
  `speeds up a reaction.\n\n` +
  `- "branching": best for topics involving human decisions, historical ` +
  `events, ethical dilemmas, or economic trade-offs. Write a compelling ` +
  `scenario, exactly 2 choices. Each choice needs a vivid concrete ` +
  `consequence (specific numbers, outcomes). isOptimal=true means this ` +
  `choice led to the better outcome.\n\n` +
  `- "graph": best for maths or any topic with a formula/function that ` +
  `transforms visually. Pick curveType (parabola/line/sine/exponential). ` +
  `Add 2-3 named params with min/max/step/default. Write 3 observations — ` +
  `one insight per param students discover as they drag.\n\n` +
  `- "block_sort": best for sentence ordering tasks only — e.g. arrange ` +
  `words into the correct grammatical order. Give 4-6 blocks (already ` +
  `shuffled), correctOrder as indices for the right sequence. Do NOT use ` +
  `for classification or grouping tasks.\n\n` +
  `- "flowchart": best for multi-stage processes where order is the whole ` +
  `point — river formation, cell division, manufacturing steps. Write the ` +
  `steps in correct order (label + 1-sentence description). correctOrder is ` +
  `usually [0,1,2,3,4]. Students will be shown them scrambled and must sort.\n\n` +
  `- "categorize": best for classification tasks — sorting items into 2-4 ` +
  `named groups. Use when the topic is "X vs Y" or "types of Z". ` +
  `categories: array of {label} objects (2-4 groups). items: 6-10 cards ` +
  `to sort. correctMapping: for EACH item (same length as items), the ` +
  `0-based index of its correct category (first category = 0, second = 1, ` +
  `etc). Example: categories=[{label:"Eukaryotic"},{label:"Prokaryotic"}], ` +
  `items=["Has nucleus","DNA free in cytoplasm","Organelles present"], ` +
  `correctMapping=[0,1,0]. correctMapping MUST be 0-indexed and the same ` +
  `length as items. ALWAYS use "categorize" for classification — ` +
  `never use "block_sort" for grouping.\n\n` +
  `Choose whichever creates the biggest "I just discovered something" moment ` +
  `before reading a single definition. The interactive runs BEFORE the hook ` +
  `and sections.`;

export async function generateLesson(
  topicName: string,
  subjectName: string,
  extraHelp = false,
  customInstructions?: string,
  config?: ProviderConfig
): Promise<LessonContent> {

  const helpNote = extraHelp
    ? `This student found the normal version too hard. Slow right down: use ` +
      `simpler everyday words, break each idea into more, smaller sections ` +
      `than usual (aim for more sections, each covering less), add an extra ` +
      `everyday-life analogy in every explanation, and make the worked ` +
      `examples more step-by-step and explicit. Never assume a fact wasn't ` +
      `already covered — reintroduce it briefly instead.`
    : "";

  const instructionNote = customInstructions
    ? `\n\nThe admin who set up this topic left these instructions — follow ` +
      `them: ${customInstructions}`
    : "";

  return chatJson<LessonContent>(
    `Write a short interactive GCSE lesson on "${topicName}" for the ` +
      `subject "${subjectName}" following the Duolingo/Brilliant model: ` +
      `bite-sized, interactive-first, never a wall of text.\n\n` +
      `START with a "hook" — one punchy sentence that frames the whole ` +
      `lesson as a puzzle or challenge (e.g. "Can you figure out what the ` +
      `atomic number actually counts?"). No markdown. No question mark at ` +
      `the end — it should feel like a dare, not an exam prompt.\n\n` +
      `Then write 3-5 sections. Each section:\n` +
      `1. heading — 2-5 words naming the concept (chip label only, not a ` +
      `sentence).\n` +
      `2. check — the QUESTION the student answers first, before any ` +
      `explanation. Make it self-contained: the question + options/pairs ` +
      `must carry enough context that the student can attempt it from ` +
      `intuition.\n` +
      `3. explanation — post-answer teaching: WHY that is right. 2-3 ` +
      `sentences, conversational, no filler.\n` +
      `4. example — one short concrete worked example shown as feedback.\n\n` +
      `Vary check "kind" across sections:\n` +
      `- "mcq": 4 options, exactly 1 correct (set correctIndex). Default ` +
      `choice for science, maths, geography, history, economics — any ` +
      `factual or conceptual question.\n` +
      `- "multi": 4-5 options, 2+ correct (set correctIndexes). Use when ` +
      `multiple things are simultaneously true.\n` +
      `- "matching": 3-4 left/right pairs. Use for definitions, ` +
      `term↔example, cause↔effect.\n` +
      `- "short" WITH "wordBank": ONLY for modern foreign language lessons ` +
      `(word order, sentence construction) or early English literacy. ` +
      `NEVER use wordBank for science, maths, history, geography, ` +
      `economics, or any subject where the student is recalling a fact or ` +
      `concept — those students are not building sentences, they are ` +
      `answering questions, and the tile UI is patronising and wrong for ` +
      `that context. For those subjects, use "mcq" or "matching" instead.\n` +
      `Schema requires "options" and "correctIndex" always — for ` +
      `"multi"/"short"/"matching" set options to [] and correctIndex to 0.\n` +
      `Write for a 15-16 year old. Plain prose only — no **, *, #, or ` +
      `bullet dashes anywhere. Math/chemistry as LaTeX: $x^2$ inline, ` +
      `$$formula$$ standalone. Never plain-text approximations. ` +
      `${INTERACTIVE_GUIDE}${helpNote}${instructionNote}${VISUAL_GUIDE}`,
    SCHEMA,
    config
  );
}

// Regenerates a lesson incorporating a free-text tweak instruction from an
// admin/teacher reviewing it (e.g. "add a diagram description to section 2",
// "make the tone less formal") on top of the existing content.
export async function tweakLesson(
  current: LessonContent,
  instruction: string,
  topicName: string,
  subjectName: string,
  config?: ProviderConfig
): Promise<LessonContent> {
  return chatJson<LessonContent>(
    `Here is an existing GCSE lesson on "${topicName}" (subject: ` +
      `"${subjectName}") as JSON:\n\n${JSON.stringify(current)}\n\n` +
      `Revise it according to this instruction from the reviewer: ` +
      `"${instruction}". Keep the same overall structure (3-5 sections, ` +
      `each with a quick check) unless the instruction says otherwise. ` +
      `Each check's "kind" is one of: "mcq" (4 options, correctIndex), ` +
      `"multi" (options + correctIndexes, 2+ correct), "short" (accepted ` +
      `answers list), or "matching" (3-4 left/right pairs) — use whichever ` +
      `the instruction asks for or fits best. Return the complete revised ` +
      `lesson, not a diff.` +
      VISUAL_GUIDE,
    SCHEMA,
    config
  );
}
