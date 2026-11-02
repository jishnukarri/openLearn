import "server-only";
import { chatJson, forGeneration, type ProviderConfig } from "./client";
// Animated scenes (exampleScene) are generated separately by lib/ai/scenes.ts
// with a cheaper model, so the main prompt only asks for step annotations.
const STEPS_GUIDE =
  `\n\nFor each section also write "exampleSteps": 3-5 short sentences ` +
  `walking through the worked example in order, the last giving the answer.`;

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
import type { Scene as LessonScene } from "@/lib/lesson-scene";

export type LessonVisual =
  | { kind: "svg"; svg: string; caption?: string }
  | { kind: "html"; html: string }
  | { kind: "image"; prompt: string; alt: string; url?: string };

export type LessonSection = {
  heading: string;
  explanation: string;
  example: string;
  // Worked-example visual (diagram or image) and short step annotations the
  // player animates over it. Optional: older lessons derive steps from `example`.
  exampleVisual?: LessonVisual | null;
  // Preferred worked-example visual: a declarative animated scene
  // (lib/lesson-scene.ts). Validated by lib/lesson-finalize.ts.
  exampleScene?: LessonScene | null;
  exampleSteps?: string[];
  // Spoken script for a tricky section, and the id of its pre-recorded MP3
  // (lib/ai/narration.ts). Both absent for simple sections.
  narration?: string | null;
  audioId?: string | null;
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
          exampleVisual: {
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
          narration: {
            type: "string",
            description:
              "ONLY for a conceptually tricky section (a process, a formula, a counter-intuitive idea); leave it out for simple ones, and for at most 2 sections per lesson. A 40-70 word script a teacher would SAY aloud: spoken English with no symbols or markdown (say 'v equals f times lambda'), explaining the idea from a different angle than the written explanation, never repeating it.",
          },
          exampleSteps: {
            type: "array",
            description: "3-5 short annotations (one short sentence each) walking through the worked example in order.",
            items: { type: "string" },
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
  `\n\nAlso generate an "interactive" field: a short visual explainer shown ` +
  `BEFORE the lesson that teaches ONE core idea of the topic. Students do ` +
  `not need to work anything out; it must make sense on its own, with no ` +
  `prior knowledge, and every label, option and sentence must be factually ` +
  `correct for GCSE. Choose the kind that shows this topic's core idea most ` +
  `clearly:\n\n` +
  `- "slider_sim": best for cause-and-effect topics (physics, chemistry, ` +
  `biology). Add exactly 1 slider for the single key variable (outcomes can only depend on that one slider). Provide 3 outcome bands ordered from the slider's low end to its high end. Each band's label names the result and its description says WHAT happens and WHY in one or two plain sentences; the three bands together must show one consistent rule (for example: more insulation means less heat escapes, so less energy is needed). ` +
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
  `Quality rules for every kind: (1) it explains the idea, it is not a ` +
  `trick or a guessing game; (2) use plain words and define any term the ` +
  `first time it appears; (3) never include an item, label or outcome that ` +
  `is wrong, ambiguous or belongs to a different idea (for example do not ` +
  `put forces or power into a list of energy stores); (4) the "codify" ` +
  `sentence states the rule in one clear sentence that follows directly ` +
  `from what was shown; (5) outcomes and observations must agree with real ` +
  `science: check the direction of every cause and effect before writing it.`;

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
    `Write a clear, short GCSE lesson on "${topicName}" for the ` +
      `subject "${subjectName}". The student reads each section's teaching ` +
      `FIRST and is quizzed on it straight after, so every section must ` +
      `actually teach before it asks. Principles: explain one idea at a ` +
      `time, define key terms in plain words, say why it matters, show one ` +
      `worked example, then check understanding of exactly what was taught.\n\n` +
      `START with a "hook": ONE plain sentence saying what the student will ` +
      `be able to do or explain by the end (e.g. "By the end you will be ` +
      `able to explain what the atomic number counts and use it to find ` +
      `the number of protons."). No markdown, no question mark, no riddle.\n\n` +
      `Then write 3-5 sections. Each section, in the order the student ` +
      `sees them:\n` +
      `1. heading — 2-5 words naming the concept (chip label only).\n` +
      `2. explanation — the teaching. 3-5 short sentences: define the key ` +
      `term, explain how or why it works in everyday words, add one ` +
      `memorable analogy or comparison if it helps, and name one common ` +
      `mistake to avoid. Never assume knowledge from a later section.\n` +
      `3. example — one concrete worked example that applies the explanation ` +
      `step by step, with real numbers or a real situation, ending on the ` +
      `answer.\n` +
      `4. check — a question that can be answered using ONLY the explanation ` +
      `and example just shown (no outside knowledge, no trick wording). Wrong ` +
      `options should be plausible mistakes, not nonsense. Never use "all ` +
      `of the above" or "none of the above".\n\n` +
      `Accuracy: only state facts that are true and in the GCSE specification; ` +
      `do not contradict an earlier section; make sure every example's ` +
      `numbers and units are correct.\n\n` +
    `Vary check "kind" across sections:\n` +
      `- "mcq": 4 options, exactly 1 correct (set correctIndex). Default ` +
      `choice for science, maths, geography, history, economics — any ` +
      `factual or conceptual question.\n` +
      `- "multi": 4-5 options, 2+ correct (set correctIndexes). Use when ` +
      `multiple things are simultaneously true.\n` +
      `- "matching": 3-4 left/right pairs. Use for definitions, ` +
      `term↔example, cause↔effect. Every left item must be the same kind ` +
      `of thing and every right item the same kind of thing, and each ` +
      `left item must match exactly one right item (no overlaps).\n` +
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
      `${INTERACTIVE_GUIDE}${helpNote}${instructionNote}${VISUAL_GUIDE}${STEPS_GUIDE}`,
    SCHEMA,
    forGeneration(config)
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
  config?: ProviderConfig,
  customInstructions?: string | null
): Promise<LessonContent> {
  const note = customInstructions?.trim()
    ? `\n\nThe teacher's standing instructions for this topic (keep following them): ${customInstructions.trim()}`
    : "";
  return chatJson<LessonContent>(
    `Here is an existing GCSE lesson on "${topicName}" (subject: ` +
      `"${subjectName}") as JSON:\n\n${JSON.stringify(current)}\n\n` +
      `Revise it according to this instruction from the reviewer: ` +
      `"${instruction}". Change only what the instruction asks. Keep the hook, interactive, other sections, their checks and exampleSteps unchanged unless the instruction explicitly concerns them. Keep the same overall structure (3-5 sections, ` +
      `each with a quick check) unless the instruction says otherwise. ` +
      `Each check's "kind" is one of: "mcq" (4 options, correctIndex), ` +
      `"multi" (options + correctIndexes, 2+ correct), "short" (accepted ` +
      `answers list), or "matching" (3-4 left/right pairs) — use whichever ` +
      `the instruction asks for or fits best. Return the complete revised ` +
      `lesson, not a diff.` +
      note +
      VISUAL_GUIDE +
      STEPS_GUIDE,
    SCHEMA,
    forGeneration(config)
  );
}
