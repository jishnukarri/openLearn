import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const hackClub = vi.fn();
vi.mock("undici", () => ({ fetch: (...a: unknown[]) => hackClub(...a), Agent: class {} }));

import { chatJson, countOptionalFields, providerOrder } from "./client";

const ok = (content: object) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 });
const SCHEMA = { type: "object", properties: { a: { type: "string" } }, required: ["a"] };

describe("provider fallback", () => {
  const openRouter = vi.fn();
  beforeEach(() => {
    hackClub.mockReset();
    openRouter.mockReset();
    vi.stubGlobal("fetch", openRouter);
    vi.stubEnv("HACKCLUB_API_KEY", "hc-key");
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("AI_PROVIDER", "hackclub");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("tries Hack Club first, OpenRouter second", () => {
    expect(providerOrder()).toEqual(["hackclub", "openrouter"]);
    vi.stubEnv("AI_PROVIDER", "openrouter");
    expect(providerOrder()).toEqual(["openrouter", "hackclub"]);
  });

  it("uses Hack Club when it works", async () => {
    hackClub.mockResolvedValue(ok({ a: "hc" }));
    expect(await chatJson("hi", SCHEMA)).toEqual({ a: "hc" });
    expect(openRouter).not.toHaveBeenCalled();
  });

  it("falls back to OpenRouter on a rate limit, an outage or a network error", async () => {
    for (const failure of [
      () => Promise.resolve(new Response("slow down", { status: 429 })),
      () => Promise.resolve(new Response("down", { status: 503 })),
      () => Promise.reject(new TypeError("fetch failed")),
      () => Promise.resolve(new Response(JSON.stringify({ error: { code: 402, message: "no credit" } }), { status: 200 })),
    ]) {
      hackClub.mockReset().mockImplementation(failure);
      openRouter.mockReset().mockResolvedValue(ok({ a: "or" }));
      expect(await chatJson("hi", SCHEMA)).toEqual({ a: "or" });
    }
  });

  it("does not retry a request that is simply wrong", async () => {
    hackClub.mockResolvedValue(new Response("bad request", { status: 404 }));
    await expect(chatJson("hi", SCHEMA)).rejects.toThrow(/404/);
    expect(openRouter).not.toHaveBeenCalled();
  });

  it("reports every provider when all fail", async () => {
    hackClub.mockResolvedValue(new Response("x", { status: 500 }));
    openRouter.mockResolvedValue(new Response("y", { status: 500 }));
    await expect(chatJson("hi", SCHEMA)).rejects.toThrow(/All AI providers failed[\s\S]*Hack Club[\s\S]*OpenRouter/);
  });

  it("falls back to a plain JSON reply when a model refuses a big schema", async () => {
    hackClub
      .mockResolvedValueOnce(new Response('{"error":{"message":"too many optional parameters in schema"}}', { status: 400 }))
      .mockResolvedValueOnce(ok({ a: "loose" }));
    expect(await chatJson("hi", { ...SCHEMA, properties: { a: { type: "string" }, b: { type: "string" } } })).toEqual({ a: "loose" });
    const body = JSON.parse(hackClub.mock.calls[1][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("counts optional fields, including nested ones", () => {
    const schema = { type: "object", required: ["a"], properties: { a: { type: "string" }, b: { type: "string" }, c: { type: "array", items: { type: "object", properties: { d: { type: "string" } } } } } };
    expect(countOptionalFields(schema)).toBe(3);
  });

  it("goes straight to a plain JSON reply for a Claude model with a big schema", async () => {
    vi.stubEnv("HACKCLUB_MODEL", "anthropic/claude-sonnet-5.5");
    const props = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`f${i}`, { type: "string" }]));
    hackClub.mockResolvedValue(ok({ a: "x" }));
    await chatJson("hi", { type: "object", properties: props }, { provider: "hackclub", model: "anthropic/claude-sonnet-5.5" });
    expect(hackClub).toHaveBeenCalledTimes(1);
    expect(JSON.parse(hackClub.mock.calls[0][1].body).response_format).toEqual({ type: "json_object" });
  });
});
