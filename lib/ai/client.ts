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
      } as any)) as unknown as Response;
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
}

// Single entry point for every AI request in the app. Four providers:
//
// - ollama:     local, no API key, no usage limits, slow on CPU
// - openrouter: hosted, OpenAI-compatible, pay-per-token
// - hackclub:   hosted, OpenAI-compatible (ai.hackclub.com proxy), free for
//               Hack Club members
// - gemini:     hosted, Google's SDK, pay-per-token (or free tier w/ low limits)
//
// Which one actually runs a given request depends on WHO is asking:
// resolveProviderConfig(profileId) checks whether that profile is a teacher
// with their own key saved (teacher_ai_settings) and uses it if so; every
// other caller (students, admin-triggered generation, system/publish-time
// pregeneration) falls through to the platform default configured in
// .env.local (AI_PROVIDER + provider-specific key/host/model). Admins don't
// get a per-user key — by design they only ever configure the platform
// default via .env, per the product decision that "admins add in .env."
//
// All five generation modules (topics/lessons/questions/marking/diagnostic)
// call chatJson() here instead of talking to a provider SDK directly.

export type Provider = "ollama" | "openrouter" | "hackclub" | "gemini";

export type ProviderConfig = {
  provider: Provider;
  apiKey?: string;
  model?: string;
  host?: string; // ollama only
};

function platformDefault(): ProviderConfig {
  const provider = (process.env.AI_PROVIDER as Provider | undefined) ?? "ollama";

  switch (provider) {
    case "gemini":
      return {
        provider,
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      };
    case "openrouter":
      return {
        provider,
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      };
    case "hackclub":
      return {
        provider,
        apiKey: process.env.HACKCLUB_API_KEY,
        model: process.env.HACKCLUB_MODEL || "qwen/qwen3-32b",
      };
    case "ollama":
    default:
      return {
        provider: "ollama",
        host: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
        model: process.env.OLLAMA_MODEL || "qwen2.5:7b-instruct",
      };
  }
}

// Resolves which provider/key to use for a given acting profile. Pass the
// profile.id of whoever triggered the generation (student, teacher, or
// admin) — students and admins always fall through to the platform default;
// a teacher with a saved key in teacher_ai_settings gets their own.
export async function resolveProviderConfig(
  profileId?: string | null
): Promise<ProviderConfig> {
  if (profileId) {
    const { getTeacherAiSettings } = await import("@/lib/supabase/ai-settings");
    const custom = await getTeacherAiSettings(profileId);
    if (custom) return custom;
  }
  return platformDefault();
}

export async function chatJson<T>(
  prompt: string,
  schema: object,
  config?: ProviderConfig
): Promise<T> {
  const cfg = config ?? platformDefault();

  switch (cfg.provider) {
    case "gemini":
      return chatJsonGemini<T>(prompt, schema, cfg);
    case "openrouter":
      return chatJsonOpenAICompatible<T>(
        "https://openrouter.ai/api/v1/chat/completions",
        "OpenRouter",
        "openai/gpt-4o-mini",
        prompt,
        schema,
        cfg
      );
    case "hackclub":
      return chatJsonOpenAICompatible<T>(
        "https://ai.hackclub.com/proxy/v1/chat/completions",
        "Hack Club AI",
        "qwen/qwen3-32b",
        prompt,
        schema,
        cfg
      );
    case "ollama":
    default:
      return chatJsonOllama<T>(prompt, schema, cfg);
  }
}

// --- Ollama ---
// Structured output only works reliably with an object-rooted schema
// (`{topics: [...]}`), not a bare array root (`[...]` → model returns `[]`).
// Every schema passed into chatJson across lib/ai/*.ts follows that rule.
async function chatJsonOllama<T>(
  prompt: string,
  schema: object,
  cfg: ProviderConfig
): Promise<T> {
  const host = cfg.host || "http://127.0.0.1:11434";
  const model = cfg.model || "qwen2.5:7b-instruct";

  const response = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      format: schema,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  return JSON.parse(data.message.content) as T;
}

// --- OpenAI-compatible chat/completions (OpenRouter, Hack Club AI) ---
// Same request/response shape, different base URL and default model — Hack
// Club's proxy (https://ai.hackclub.com) is a drop-in OpenAI-compatible
// endpoint, same as OpenRouter's.
async function chatJsonOpenAICompatible<T>(
  endpoint: string,
  providerLabel: string,
  defaultModel: string,
  prompt: string,
  schema: object,
  cfg: ProviderConfig
): Promise<T> {
  if (!cfg.apiKey) throw new Error(`${providerLabel} requires an API key.`);

  const doFetch = endpoint.includes("ai.hackclub.com") ? hackClubFetch : fetch;
  const response = await doFetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model || defaultModel,
      messages: [{ role: "user", content: prompt }],
      // Every response here is a bounded JSON structure (a handful of
      // sections/questions), never a long-form essay — capping this avoids
      // some providers defaulting to a huge max_tokens that a low-credit
      // account can't afford, even though the actual output is small.
      max_tokens: 4096,
      response_format: {
        type: "json_schema",
        json_schema: { name: "response", strict: true, schema },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`${providerLabel} request failed (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();

  // Some providers (OpenRouter included) return HTTP 200 with the failure
  // embedded in the body instead of a non-2xx status — most commonly a
  // rate limit (429) on the upstream model. Surface that distinctly rather
  // than falling through to the generic "unexpected format" error below.
  if (data?.error) {
    const code = data.error.code ? ` (${data.error.code})` : "";
    throw new Error(`${providerLabel} error${code}: ${data.error.message ?? "unknown error"}`);
  }

  if (!data?.choices?.[0]?.message?.content) {
    throw new Error(
      `${providerLabel} returned an unexpected response format: ${JSON.stringify(data).slice(0, 200)}`
    );
  }
  return JSON.parse(data.choices[0].message.content) as T;
}

// --- Gemini ---
// The @google/genai SDK wants its schema shaped with a `Type` enum instead
// of plain JSON-schema type strings, so every schema is converted on the
// way in.
async function chatJsonGemini<T>(
  prompt: string,
  schema: object,
  cfg: ProviderConfig
): Promise<T> {
  if (!cfg.apiKey) throw new Error("Gemini requires an API key.");

  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: cfg.apiKey });

  const response = await ai.models.generateContent({
    model: cfg.model || "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(schema, Type),
    },
  });

  return JSON.parse(response.text ?? "{}") as T;
}

function toGeminiSchema(schema: any, Type: any): any {
  switch (schema.type) {
    case "object":
      return {
        type: Type.OBJECT,
        properties: Object.fromEntries(
          Object.entries(schema.properties ?? {}).map(([key, value]) => [
            key,
            toGeminiSchema(value, Type),
          ])
        ),
        required: schema.required,
      };
    case "array":
      return { type: Type.ARRAY, items: toGeminiSchema(schema.items, Type) };
    case "integer":
      return { type: Type.INTEGER };
    case "boolean":
      return { type: Type.BOOLEAN };
    case "string":
    default:
      return schema.enum
        ? { type: Type.STRING, enum: schema.enum }
        : { type: Type.STRING };
  }
}
