import "server-only";
// AI hints and remediation for exam questions, generated lazily by the same
// cheap model as scenes (see cheap-model.ts) and cached in the question's
// `format` JSON (format.hints / format.remediation), shared by all students.
// Never throws: any failure yields null.
import type { Question } from "@/lib/supabase/questions";
import { mergeQuestionFormat, readFormatCache } from "@/lib/supabase/questions";
import { chatJson } from "./client";
import { checkKeyRateLimit } from "@/lib/rate-limit";
import { getQuestionById } from "@/lib/supabase/questions";
import { LEASE_WINDOW_MS, leaseKey, withGenerationLease } from "./generation-lease";
import type { Remediation } from "@/lib/question-remediation";
import {
  callCheapModel,
  cheapFetch,
  cheapKey,
  cheapModel,
  cheapProvider,
  FatalModelError,
  warnOnce,
  type Msg,
} from "./cheap-model";
import {
  buildHintsPrompt,
  buildRemediationPrompt,
  buildRetryPrompt,
  extractJsonObject,
  HINTS_SYSTEM_PROMPT,
  remediationKind,
  remediationSystemPrompt,
  validateHints,
  validateRemediation,
  type RemediationInput,
  type Validated,
} from "./remediation-helpers";

const MAX_TOKENS = 6000;
const TIMEOUT_MS = 100_000;
const ATTEMPTS = 2; // first try + one retry with the rejection reason

export function toRemediationInput(q: Question, topicTitle?: string | null): RemediationInput {
  return {
    prompt: q.prompt,
    markscheme: q.markscheme,
    maxMarks: q.max_marks,
    modelAnswer: q.model_answer,
    format: q.format,
    topicTitle,
  };
}

type Opts = { apiKey?: string; model?: string; fetchImpl?: typeof fetch; topicTitle?: string | null };

async function generateJson<T>(
  system: string,
  user: string,
  retryWhat: string,
  validate: (raw: unknown) => Validated<T>,
  opts: Opts,
  schema?: object
): Promise<(Validated<T> & { ok: true }) | null> {
  const apiKey = opts.apiKey ?? cheapKey();
  if (!apiKey) {
    warnOnce("remediation", "nokey", `No API key for provider "${cheapProvider()}"; hints and remediation unavailable.`);
    return null;
  }
  const model = opts.model ?? cheapModel();
  const fetchImpl = opts.fetchImpl ?? cheapFetch();
  const messages: Msg[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  try {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const reply = await callCheapModel(messages, {
        apiKey,
        model,
        fetchImpl,
        label: "remediation",
        maxTokens: MAX_TOKENS,
        timeoutMs: TIMEOUT_MS,
        schema,
      });
      let reason: string;
      try {
        const v = validate(extractJsonObject(reply));
        if (v.ok) return v;
        reason = v.reason;
      } catch (e) {
        reason = `invalid JSON (${e instanceof Error ? e.message : "parse error"})`;
      }
      messages.push({ role: "assistant", content: reply }, { role: "user", content: buildRetryPrompt(reason, retryWhat) });
    }
    return null;
  } catch (e) {
    if (!(e instanceof FatalModelError)) {
      console.warn("[remediation] generation failed:", e instanceof Error ? e.message : e);
    }
    return null;
  }
}

// Fixed reply shape for hints: exactly three strings, nothing else.
const HINTS_SCHEMA = {
  type: "object",
  properties: { hints: { type: "array", items: { type: "string" } } },
  required: ["hints"],
  additionalProperties: false,
};

export async function generateHints(question: Question, opts: Opts = {}): Promise<string[] | null> {
  const input = toRemediationInput(question, opts.topicTitle);
  // Hints use their own model (HINT_MODEL): they must not leak the answer.
  if (!opts.model && process.env.HINT_MODEL) opts = { ...opts, model: process.env.HINT_MODEL };
  const r = await generateJson(
    HINTS_SYSTEM_PROMPT,
    buildHintsPrompt(input),
    "hints",
    (raw) => validateHints(raw, input),
    opts,
    HINTS_SCHEMA
  );
  if (r) return r.hints;
  return generateHintsViaMainModel(input);
}

// If the cheap model has no key or keeps failing, the platform's main model
// writes the hints live instead (same prompt, same schema, same safety check),
// so a question never ends up with "no hint available".
async function generateHintsViaMainModel(input: RemediationInput): Promise<string[] | null> {
  try {
    let prompt = buildHintsPrompt(input);
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const raw = await chatJson<{ hints: string[] }>(`${HINTS_SYSTEM_PROMPT}\n\n${prompt}`, HINTS_SCHEMA);
      const v = validateHints(raw, input);
      if (v.ok) return v.hints;
      prompt = `${buildHintsPrompt(input)}\n\n${buildRetryPrompt(v.reason, "hints")}`;
    }
  } catch (e) {
    console.warn("[remediation] main-model hints failed:", e instanceof Error ? e.message : e);
  }
  return null;
}

export async function generateRemediation(question: Question, opts: Opts = {}): Promise<Remediation | null> {
  const input = toRemediationInput(question, opts.topicTitle);
  const kind = remediationKind(input);
  const r = await generateJson(
    remediationSystemPrompt(kind),
    buildRemediationPrompt(input, kind),
    kind === "scaffold" ? "scaffold" : "teaching card",
    (raw) => validateRemediation(raw, input, kind),
    opts
  );
  return r ? r.remediation : null;
}

/* ── lazy, cached, de-duplicated ──────────────────────────────────────── */

const inFlightHints = new Map<string, Promise<string[] | null>>();
const inFlightRemediation = new Map<string, Promise<Remediation | null>>();

export function readCachedHints(q: Question): string[] | null {
  return cachedHints(q);
}

function cachedHints(q: Question): string[] | null {
  const h = readFormatCache(q.format).hints;
  return Array.isArray(h) && h.length === 3 && h.every((s) => typeof s === "string" && s.trim()) ? (h as string[]) : null;
}

function cachedRemediation(q: Question): Remediation | null {
  const r = readFormatCache(q.format).remediation as Remediation | undefined;
  if (!r || typeof r !== "object") return null;
  if (r.type === "scaffold" && Array.isArray(r.steps) && r.steps.length >= 3) return r;
  if (r.type === "explain" && typeof r.content === "string" && r.transferCheck) return r;
  return null;
}

// Cached hints for a question, generating and storing them on first need.
export function getOrCreateHints(question: Question, topicTitle?: string | null): Promise<string[] | null> {
  const hit = cachedHints(question);
  if (hit) return Promise.resolve(hit);
  const pending = inFlightHints.get(question.id);
  if (pending) return pending;
  const p = withGenerationLease<string[]>({
    acquire: () => checkKeyRateLimit("gen", leaseKey(question.id, "hints"), 1, LEASE_WINDOW_MS),
    readCached: async () => {
      const q = await getQuestionById(question.id).catch(() => null);
      return q ? cachedHints(q) : null;
    },
    generate: async () => {
    const hints = await generateHints(question, { topicTitle });
    if (hints) await mergeQuestionFormat(question.id, { hints }).catch((e) => console.warn("[remediation] cache write failed:", e));
    return hints;
    },
  }).finally(() => inFlightHints.delete(question.id));
  inFlightHints.set(question.id, p);
  return p;
}

export function getOrCreateRemediation(question: Question, topicTitle?: string | null): Promise<Remediation | null> {
  const hit = cachedRemediation(question);
  if (hit) return Promise.resolve(hit);
  const pending = inFlightRemediation.get(question.id);
  if (pending) return pending;
  const p = withGenerationLease<Remediation>({
    acquire: () => checkKeyRateLimit("gen", leaseKey(question.id, "remediation"), 1, LEASE_WINDOW_MS),
    readCached: async () => {
      const q = await getQuestionById(question.id).catch(() => null);
      return q ? cachedRemediation(q) : null;
    },
    generate: async () => {
    const rem = await generateRemediation(question, { topicTitle });
    if (rem) await mergeQuestionFormat(question.id, { remediation: rem }).catch((e) => console.warn("[remediation] cache write failed:", e));
    return rem;
    },
  }).finally(() => inFlightRemediation.delete(question.id));
  inFlightRemediation.set(question.id, p);
  return p;
}
