import "server-only";
// Shared plumbing for the very cheap text model used for scenes, hints and
// remediation (independent of the lesson provider, AI_PROVIDER). Env:
//   SCENE_PROVIDER      "hackclub" | "openrouter". Default: hackclub when
//                       HACKCLUB_API_KEY is set, otherwise openrouter.
//   HACKCLUB_API_KEY / OPENROUTER_API_KEY  the key for the chosen provider
//   SCENE_MODEL         default "deepseek/deepseek-v4.1-flash"
import { hackClubFetch, providerOrder } from "./client";

export const CHEAP_ENDPOINTS = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  hackclub: "https://ai.hackclub.com/proxy/v1/chat/completions",
} as const;
export type CheapProvider = keyof typeof CHEAP_ENDPOINTS;

export const CHEAP_DEFAULT_MODEL = "deepseek/deepseek-v4.1-flash";

export type Msg = { role: "system" | "user" | "assistant"; content: string };

export function cheapProvider(): CheapProvider {
  const v = process.env.SCENE_PROVIDER;
  if (v === "hackclub" || v === "openrouter") return v;
  return providerOrder()[0];
}

export function cheapKey(): string | undefined {
  return cheapProvider() === "hackclub" ? process.env.HACKCLUB_API_KEY : process.env.OPENROUTER_API_KEY;
}

export function cheapModel(): string {
  return process.env.SCENE_MODEL || CHEAP_DEFAULT_MODEL;
}

export function cheapFetch(): typeof fetch {
  return cheapProvider() === "hackclub" ? (hackClubFetch as unknown as typeof fetch) : fetch;
}

const warned = new Set<string>();
export function warnOnce(label: string, key: string, msg: string) {
  const k = `${label}:${key}`;
  if (warned.has(k)) return;
  warned.add(k);
  console.warn(`[${label}] ${msg}`);
}

// 401/402: nothing will work until config is fixed; callers stop retrying.
export class FatalModelError extends Error {}

// Tries the chosen provider; if it fails, the other one (same models) when its
// key is set. A key that is wrong or out of credit (FatalModelError) also falls back.
export async function callCheapModel(
  messages: Msg[],
  opts: Parameters<typeof callCheapModelOnce>[1]
): Promise<string> {
  const primary = cheapProvider();
  const other: CheapProvider = primary === "hackclub" ? "openrouter" : "hackclub";
  const otherKey = other === "hackclub" ? process.env.HACKCLUB_API_KEY : process.env.OPENROUTER_API_KEY;
  try {
    return await callCheapModelOnce(messages, opts, primary);
  } catch (e) {
    if (!otherKey) throw e;
    warnOnce(opts.label, `fallback-${primary}`, `${primary} failed (${e instanceof Error ? e.message : e}); using ${other}.`);
    return callCheapModelOnce(messages, { ...opts, apiKey: otherKey, fetchImpl: other === "hackclub" ? (hackClubFetch as unknown as typeof fetch) : fetch }, other);
  }
}

async function callCheapModelOnce(
  messages: Msg[],
  opts: {
    apiKey: string;
    model: string;
    fetchImpl: typeof fetch;
    label: string; // log prefix, e.g. "scenes"
    maxTokens?: number;
    timeoutMs?: number;
    // A JSON schema makes the provider enforce the reply's exact shape. Without
    // one the reply is only "some JSON object" and callers must validate it.
    schema?: object;
  },
  provider: CheapProvider
): Promise<string> {
  const post = (schema: object | undefined) => opts.fetchImpl(CHEAP_ENDPOINTS[provider], {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      messages,
      // DeepSeek V4.1 Flash is a reasoning model: a small budget gets eaten
      // by thinking and the JSON is cut off. Keep thinking short and leave
      // plenty of room for the answer.
      max_tokens: opts.maxTokens ?? 8000,
      reasoning: { effort: "low" },
      response_format: schema
        ? { type: "json_schema", json_schema: { name: "response", strict: true, schema } }
        : { type: "json_object" },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 100_000),
  });
  let res = await post(opts.schema);
  // A model/provider that rejects json_schema still gets a JSON-object reply
  // (callers validate the shape either way).
  if (opts.schema && res.status === 400) res = await post(undefined);
  if (res.status === 402) {
    warnOnce(opts.label, "402", `${provider} returned 402 (insufficient credits or quota); ${opts.label} disabled until that is fixed.`);
    throw new FatalModelError("402");
  }
  if (res.status === 401) {
    warnOnce(opts.label, "401", `${provider} rejected the API key (401); ${opts.label} disabled.`);
    throw new FatalModelError("401");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(String(data.error.message ?? "provider error"));
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content) throw new Error("empty response");
  return content;
}
