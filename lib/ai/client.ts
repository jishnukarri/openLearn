import "server-only";
import { fetch as undiciFetch, Agent } from "undici";

// A real paper-marking upload hit: TypeError: fetch failed, cause: Error:
// Stream closed with error code NGHTTP2_INTERNAL_ERROR — a low-level HTTP/2
// stream reset talking to ai.hackclub.com. A scripted repro (a multi-MB,
// multi-image POST to the same endpoint) did NOT reliably reproduce it, on
// either HTTP/1.1 or HTTP/2, so this reads as an intermittent reset on
// Hack Club's free proxy under load rather than a deterministic bug tied to
// payload size. Two mitigations, both safe with zero functional cost here:
// (1) force HTTP/1.1 for this host, which makes the NGHTTP2_* error class
// categorically impossible for these calls; (2) retry transient network
// failures a couple of times before giving up, since "fetch failed" from a
// third-party proxy is exactly the kind of blip a retry papers over. Every
// hand-rolled fetch to this endpoint (vision calls in marking.ts,
// images.ts, paper-extraction.ts, paper-marking.ts) should go through this
// instead of the global fetch.
// Without a deadline a stalled provider leaves the page render (and the
// "Building your lesson" screen) hanging forever; with one it fails into the
// route's error boundary, which offers a retry.
export const AI_TIMEOUT_MS = 120_000;

const hackClubAgent = new Agent({ allowH2: false });

export async function hackClubFetch(
  input: string,
  init: RequestInit,
  retries = 2
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await undiciFetch(input, {
        ...init,
        dispatcher: hackClubAgent,
      } as Parameters<typeof undiciFetch>[1])) as unknown as Response;
    } catch (err) {
      // A timeout already burned the whole deadline; retrying would triple it.
      if (attempt >= retries || (err as Error)?.name === "TimeoutError") throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
}

// Single entry point for every AI request in the app. Two providers, which
// serve the same models through different proxies:
//
// - hackclub:   the main one (ai.hackclub.com proxy)
// - openrouter: the fallback, used automatically when Hack Club fails
//               (network error, timeout, rate limit, out of credit, 5xx)
//
// AI_PROVIDER picks which one goes first (default hackclub); the other is
// the fallback as long as its key is set. Models are the same on both, so
// one set of model variables applies. Admins see the live values on
// /admin/settings; changing them means editing the env and restarting.

export type Provider = "hackclub" | "openrouter";

export type ProviderConfig = {
  provider: Provider;
  model?: string;
};

const PROVIDERS: Record<Provider, { url: string; label: string; keyEnv: string }> = {
  hackclub: { url: "https://ai.hackclub.com/proxy/v1/chat/completions", label: "Hack Club AI", keyEnv: "HACKCLUB_API_KEY" },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", label: "OpenRouter", keyEnv: "OPENROUTER_API_KEY" },
};

export const DEFAULT_CHAT_MODEL = "anthropic/claude-haiku-5.5";

// Providers to try, in order: the chosen primary first, then the other one if
// it has a key. With no keys at all the primary is still returned so the error
// says which key is missing.
export function providerOrder(): Provider[] {
  const primary: Provider = process.env.AI_PROVIDER === "openrouter" ? "openrouter" : "hackclub";
  const other: Provider = primary === "hackclub" ? "openrouter" : "hackclub";
  const withKey = [primary, other].filter((p) => !!process.env[PROVIDERS[p].keyEnv]);
  return withKey.length ? withKey : [primary];
}

export function platformDefault(): ProviderConfig {
  return { provider: providerOrder()[0], model: process.env.HACKCLUB_MODEL || DEFAULT_CHAT_MODEL };
}

// Every caller gets the platform config. The profile id is still accepted so
// existing call sites keep working, but nobody has a personal provider any more.
export async function resolveProviderConfig(
  profileId?: string | null
): Promise<ProviderConfig> {
  void profileId;
  return platformDefault();
}

// Content that is written once and then shared (lessons, exam questions)
// can use a stronger model than per-turn chat: set HACKCLUB_GEN_MODEL.
export function forGeneration(config?: ProviderConfig): ProviderConfig {
  const base = config ?? platformDefault();
  const genModel = process.env.HACKCLUB_GEN_MODEL;
  return genModel ? { ...base, model: genModel } : base;
}

export type ChatOptions = {
  // Stable instructions/reference sent as a system message so providers can
  // cache the repeated prefix across calls. Keep it byte-identical between
  // calls (no timestamps, step numbers or chat history), or the cache misses.
  system?: string;
};

// Set AI_LOG_USAGE=1 to log prompt/cached token counts per request, to check
// that prefix caching is really happening (and that a proxy passes it through).
function logUsage(provider: string, model: string, usage: Record<string, unknown>) {
  if (!process.env.AI_LOG_USAGE) return;
  console.log(`[ai-usage] ${provider} ${model} ${JSON.stringify(usage)}`);
}

export class ProviderHttpError extends Error {
  constructor(public status: number, public provider: string, public body: string) {
    super(`${provider} request failed (${status}): ${body.slice(0, 600)}`);
    this.name = "ProviderHttpError";
  }
}

// Failures that say "this provider is unavailable", not "this request is bad":
// bad key, no credit, rate limit, timeout, server error. These try the fallback.
function isFallbackable(status: number): boolean {
  return status === 401 || status === 402 || status === 403 || status === 408 || status === 429 || status >= 500;
}

// POSTs one chat-completions body to the providers in order. `build` makes the
// body per provider (OpenRouter wants cache_control markers, for example).
// Returns the first good response. A 4xx that means the request itself is wrong
// (400, 404, 422) is thrown straight away, since a second provider would refuse
// it too.
// For a streamed reply (server-sent events, used by audio output) pass
// `streamed`: the raw text comes back in `text` and `isGood` decides whether
// it holds a real answer, so an empty or errored stream also tries the fallback.
export async function postChat(
  build: (provider: Provider) => Record<string, unknown>,
  streamed?: { isGood: (text: string) => boolean }
): Promise<{ data: Record<string, unknown>; text: string; provider: Provider }> {
  const errors: string[] = [];
  for (const provider of providerOrder()) {
    const spec = PROVIDERS[provider];
    const key = process.env[spec.keyEnv];
    if (!key) {
      errors.push(`${spec.label}: ${spec.keyEnv} is not set`);
      continue;
    }
    try {
      const doFetch = provider === "hackclub" ? hackClubFetch : fetch;
      const response = await doFetch(spec.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(build(provider)),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });
      const text = await response.text();
      if (!response.ok) throw new ProviderHttpError(response.status, spec.label, text);
      if (streamed) {
        if (!streamed.isGood(text)) throw new ProviderHttpError(502, spec.label, "the stream held no usable answer");
        return { data: {}, text, provider };
      }
      let data: Record<string, unknown> | null = null;
      try {
        data = JSON.parse(text);
      } catch {
        // handled below
      }
      // Some proxies return HTTP 200 with the failure in the body (a rate limit, say).
      const embedded = data?.error as { code?: unknown; message?: unknown } | undefined;
      if (embedded) {
        const code = Number(embedded.code);
        throw new ProviderHttpError(Number.isFinite(code) && code >= 400 ? code : 502, spec.label, String(embedded.message ?? "provider error"));
      }
      if (!data) throw new ProviderHttpError(502, spec.label, "response was not JSON");
      return { data, text, provider };
    } catch (e) {
      if (e instanceof ProviderHttpError && !isFallbackable(e.status)) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${spec.label}: ${msg}`);
      console.warn(`[ai] ${spec.label} failed, trying the next provider: ${msg.slice(0, 200)}`);
    }
  }
  throw new Error(`All AI providers failed. ${errors.join(" | ")}`);
}

// Adds "reply with JSON matching this schema" to the last message, for the
// loose fallback below.
function withSchemaNote(messages: Record<string, unknown>[], schema: object): Record<string, unknown>[] {
  const note = `\n\nReply with ONLY one JSON object that matches this JSON schema exactly (include every required field, omit optional ones you do not need):\n${JSON.stringify(schema)}`;
  const out = messages.map((m) => ({ ...m }));
  const last = out[out.length - 1];
  if (typeof last.content === "string") last.content = last.content + note;
  else if (Array.isArray(last.content)) last.content = [...last.content, { type: "text", text: note }];
  return out;
}

// Model+schema pairs a provider rejected as too complex for strict mode
// (Anthropic allows at most 24 optional fields).
const looseSchemaModels = new Set<string>();

// Asks for a reply that matches `schema`: strict structured output first, and
// for a model that refuses a big schema, a plain JSON reply with the schema in
// the prompt. Every caller still validates what comes back.
export async function completeJson<T>(input: {
  model: string;
  messages: Record<string, unknown>[];
  schema: object;
  maxTokens?: number;
  // Per-provider tweak of the messages, e.g. OpenRouter cache markers.
  prepare?: (provider: Provider, messages: Record<string, unknown>[]) => Record<string, unknown>[];
}): Promise<T> {
  const { model, schema } = input;
  const looseKey = `${model}|${JSON.stringify(schema).length}`;
  const send = (strict: boolean) =>
    postChat((provider) => ({
      model,
      messages: (input.prepare ?? ((_p, m) => m))(provider, strict ? input.messages : withSchemaNote(input.messages, schema)),
      max_tokens: input.maxTokens ?? 8000,
      response_format: strict
        ? { type: "json_schema", json_schema: { name: "response", strict: true, schema } }
        : { type: "json_object" },
    }));

  let result;
  if (looseSchemaModels.has(looseKey)) {
    result = await send(false);
  } else {
    try {
      result = await send(true);
    } catch (e) {
      if (!(e instanceof ProviderHttpError) || e.status !== 400 || !/optional parameters|grammar|schema/i.test(e.body)) throw e;
      looseSchemaModels.add(looseKey);
      result = await send(false);
    }
  }

  const { data, provider } = result;
  const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | undefined;
  if (usage) {
    logUsage(PROVIDERS[provider].label, model, {
      prompt_tokens: usage.prompt_tokens,
      cached_tokens: usage.prompt_tokens_details?.cached_tokens ?? null,
      completion_tokens: usage.completion_tokens,
    });
  }
  const content = (data.choices as { message?: { content?: unknown } }[] | undefined)?.[0]?.message?.content;
  if (typeof content !== "string" || !content) {
    throw new Error(`${PROVIDERS[provider].label} returned an unexpected response format: ${JSON.stringify(data).slice(0, 200)}`);
  }
  // A loose-mode reply may arrive wrapped in a code fence.
  return JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
}

export async function chatJson<T>(
  prompt: string,
  schema: object,
  config?: ProviderConfig,
  options?: ChatOptions
): Promise<T> {
  const cfg = config ?? platformDefault();
  const system = options?.system;
  return completeJson<T>({
    model: cfg.model || DEFAULT_CHAT_MODEL,
    messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }],
    schema,
    // OpenRouter needs an explicit cache breakpoint on the system part for
    // models that do not cache by themselves; Hack Club caches the prefix on its own.
    prepare: (provider, messages) =>
      provider === "openrouter" && system
        ? messages.map((m) => (m.role === "system" ? { ...m, content: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] } : m))
        : messages,
  });
}
