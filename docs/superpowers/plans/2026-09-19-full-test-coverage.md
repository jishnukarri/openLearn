# Full Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, mocked test suite covering `lib/` (53 files), `app/actions/` (16 files) via Vitest, and end-to-end behavior of every page/route and interactive component via Playwright — genuine 100% coverage of the codebase's logic and user-facing flows, not a shallow pass to hit a percentage.

**Architecture:** Four phases, each independently shippable: (1) test infrastructure — mocking seams for Supabase/Appwrite/AI providers/Next.js request APIs, since none of the 69 server-only files import cleanly under plain Vitest today; (2) `lib/` unit tests, organized around one worked template per dependency pattern (pure logic, Supabase CRUD, Appwrite, AI-provider) that every remaining file's task follows; (3) `app/actions/` unit tests, one template covering the Server-Action-specific concerns (ownership checks, `redirect`/`notFound`, form validation) layered on top of phase 2's mocks; (4) Playwright installation plus one E2E spec per route/flow and per genuinely-interactive component, since Server Components and real browser interaction aren't unit-testable.

**Tech Stack:** Vitest 4 + `@vitest/coverage-v8` (phases 1-3, Node environment, no DOM). Playwright (phase 4, real browser). No MSW, no jsdom, no React Testing Library — deliberately: server-only logic doesn't need a DOM, and UI behavior gets tested for real in a browser instead of a JSDOM approximation of one.

## Global Constraints

- Every `lib/*.ts` file that imports `"server-only"` (38 of 53) fails to import under plain Vitest without the `server-only` → empty-stub alias from Phase 1, Task 1. No lib/actions test file works before that task lands.
- **`vi.mock(path, factory)` calls must be written inline, at the top level of the test file that uses them** — never inside an imported helper function. Vitest's hoisting only scans the test file's own AST for `vi.mock` call expressions; a call hidden inside an imported function runs too late (after ES module imports, including the module under test, have already resolved). Shared helpers (in `tests/support/`) export plain factory functions or object-builders that the test file passes into its own inline `vi.mock(...)` call — see Phase 1, Task 3 for the exact pattern.
- For Supabase/Appwrite mocks specifically, the return value needs to vary per test case (different rows, different errors) — so those two mocks use `vi.mock(path, () => ({ fnName: vi.fn() }))` (a static placeholder, written inline per test file) plus `vi.mocked(fnName).mockReturnValue(...)` inside each `it()` to set that test's specific behavior. This supersedes the object-factory pattern originally sketched in `docs/superpowers/specs/2026-09-19-test-infrastructure-design.md` for Supabase/Appwrite only — that spec's pattern is still correct and used as-is for `next/navigation`/`next/cache`/`next/headers`/`@google/genai`, whose mock shape is fixed rather than varying per test.
- Test files live under `tests/`, mirroring the source tree (`tests/lib/...`, `tests/actions/...`, `tests/e2e/...`). The 4 existing colocated tests (`lib/roles.test.ts`, `lib/lesson-sanitize.test.ts`, `lib/question-marking.test.ts`, `lib/ai/question-bank.test.ts`) stay where they are.
- Every task's test file must pass in isolation (`npx vitest run tests/lib/path/to/file.test.ts`) before moving to the next task. Run `npx vitest run --coverage` after each phase to confirm coverage actually increased for the files that phase targeted.
- No test may reach the real network, Supabase, or Appwrite. Every external boundary (`createServiceClient`, `createServerUsers`/`createPublicAccount`/`createSessionClient`, `fetch`, `@google/genai`) is mocked.
- Two source catalogs, produced by reading every target file, back every task-table entry below and are the source of truth for exact function signatures and branch behavior — consult them before writing any test, don't re-derive from memory:
  - `/tmp/claude-1000/-home-phantom-projects-AIRoadmap-old-open-learn/353b7f31-72c8-4945-802b-d043f1553306/scratchpad/catalog-lib-actions.md` (lib/ + app/actions/)
  - `/tmp/claude-1000/-home-phantom-projects-AIRoadmap-old-open-learn/353b7f31-72c8-4945-802b-d043f1553306/scratchpad/catalog-components-pages.md` (pages + components)

  These live in a scratchpad directory tied to the session that produced this plan — if it's been cleaned up by the time this plan executes, regenerate them first (dispatch two Explore agents with the same prompts used originally, or read the files directly) rather than proceeding without them; the per-file task tables in phases 2-4 are compact summaries, not full replacements.
- Two pre-existing bugs surfaced while cataloging are explicitly listed as things to **assert, not silently work around**, since a test suite's job includes locking in known-correct behavior and flagging known-odd behavior for a human to decide on:
  - `app/actions/subjects.ts`'s `publishSubjectAction` uses `Promise.all` (not `allSettled`) across topic pregeneration, unlike `generateTopicsAction`'s `allSettled` — one bad topic can fail the whole publish even though the DB-level publish already committed. Test both behaviors as-is; don't "fix" it mid test-writing.
  - `lib/supabase/classes.ts`'s `deleteClass` silently no-ops on an ownership mismatch (query filters find nothing, no error) while `removeStudentFromClass` throws — test both behaviors as-is, and flag the asymmetry in the test's own description string so it's visible in test output.

---

## PHASE 1 — Test Infrastructure

### Task 1: `vitest.config.ts` + `server-only` stub

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/support/stubs/server-only.ts`

**Interfaces:**
- Produces: a working `npx vitest run --coverage` command; every `import "server-only"` resolves to a no-op under Vitest.

- [ ] **Step 1: Create the stub**

```ts
// tests/support/stubs/server-only.ts
export {};
```

- [ ] **Step 2: Add the new devDependency**

```bash
npm install -D @vitest/coverage-v8
```

- [ ] **Step 3: Create the config**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./tests/support/stubs/server-only.ts", import.meta.url)),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "app/actions/**/*.ts"],
      exclude: ["lib/**/*.test.ts", "**/*.d.ts"],
    },
  },
});
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `npm test`
Expected: 4 files, same tests passing as before (31 tests, per the last confirmed run this session).

- [ ] **Step 5: Verify coverage reporting works**

Run: `npx vitest run --coverage`
Expected: completes without error and prints a coverage table (near-zero coverage is fine at this point — only the 4 existing test files exist).

---

### Task 2: Shared mock helpers

**Files:**
- Create: `tests/support/supabase-mock.ts`
- Create: `tests/support/next-mocks.ts`
- Create: `tests/support/ai-provider-mock.ts`

**Interfaces:**
- Produces: `createFakeSupabaseClient(result: { data: unknown; error: unknown }): FakeSupabaseClient`, `makeNavigationMock()`, `makeCacheMock()`, `makeHeadersMock()`, `mockProviderFetch(body: unknown, status?: number)`, `makeGeminiMock(responseText: string)`

- [ ] **Step 1: Supabase fake chainable client**

```ts
// tests/support/supabase-mock.ts
import { vi } from "vitest";

type Result = { data: unknown; error: unknown };

// Every lib/supabase/*.ts function calls a chain like
// .from("table").select("cols").eq("col", val).order("col").maybeSingle(),
// terminating in either .single()/.maybeSingle() or a bare await on the
// chain itself. This fake supports every chain method actually used in
// this codebase and lets a test program the terminal result.
export function createFakeSupabaseClient(result: Result) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "from", "select", "insert", "update", "delete",
    "eq", "in", "not", "or", "order", "limit", "upsert",
  ];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  // A bare chain with no terminal call (e.g. `await supabase.from(...).select(...)`)
  // is itself awaited — make the chain thenable so that resolves too.
  (chain as any).then = (resolve: (r: Result) => void) => resolve(result);
  return chain;
}

// For functions that make two sequential different-result Supabase calls
// in one execution (e.g. saveSpecAction's select-then-update, or
// createClass's collision-retry loop) — returns a fresh createServiceClient
// call each time, backed by a shift()'d queue.
export function createFakeSupabaseClientQueue(results: Result[]) {
  const queue = [...results];
  return () => createFakeSupabaseClient(queue.shift() ?? { data: null, error: null });
}
```

- [ ] **Step 2: Next.js request-API mocks**

```ts
// tests/support/next-mocks.ts
import { vi } from "vitest";

// next/navigation: redirect/notFound throw a special error Next's own
// error boundary catches — tests assert on the thrown value's shape,
// matching how Next itself signals these from Server Actions/pages.
export function makeNavigationMock() {
  return {
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  };
}

export function makeCacheMock() {
  return { revalidatePath: vi.fn() };
}

// next/headers: cookies()/headers() return Promises in this Next version
// (the codebase already does `await cookies()` — see app/actions/auth.ts).
export function makeHeadersMock() {
  const cookieStore = new Map<string, { value: string }>();
  const headerStore = new Map<string, string>();
  return {
    cookies: vi.fn(async () => ({
      get: (name: string) => cookieStore.get(name),
      set: (name: string, value: string) => cookieStore.set(name, { value }),
      delete: (name: string) => cookieStore.delete(name),
    })),
    headers: vi.fn(async () => headerStore),
  };
}
```

Usage in a consuming test file (the call itself must be inline per the Global Constraints hoisting rule):

```ts
import { vi } from "vitest";
import { makeNavigationMock } from "@/tests/support/next-mocks";

vi.mock("next/navigation", () => makeNavigationMock());
```

- [ ] **Step 3: AI-provider mocks**

```ts
// tests/support/ai-provider-mock.ts
import { vi } from "vitest";

// Stubs global fetch for the OpenAI-compatible providers (OpenRouter, Hack
// Club) and Ollama, which all call fetch() directly in lib/ai/client.ts.
export function mockProviderFetch(responseBody: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(responseBody),
      json: async () => responseBody,
    }))
  );
}

// Gemini uses the @google/genai SDK via a dynamic import, not fetch — this
// mocks the whole module, so use it via an inline vi.mock like the
// next-mocks helpers above: vi.mock("@google/genai", () => makeGeminiMock("..."))
export function makeGeminiMock(responseText: string) {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: { generateContent: vi.fn(async () => ({ text: responseText })) },
    })),
    Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", INTEGER: "INTEGER", BOOLEAN: "BOOLEAN" },
  };
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (these files aren't included in the app's own type-check path issues, but should still compile cleanly).

---

## PHASE 2 — `lib/` Unit Tests

### Task 3: Template — pure-logic file (`lib/question-distribute.ts`)

**Files:**
- Create: `tests/lib/question-distribute.test.ts`

**Interfaces:**
- Consumes: `distributeQuestions(sectionCount: number, total: number): number[]` from `@/lib/question-distribute`

- [ ] **Step 1: Write the tests**

```ts
// tests/lib/question-distribute.test.ts
import { describe, it, expect } from "vitest";
import { distributeQuestions } from "@/lib/question-distribute";

describe("distributeQuestions", () => {
  it("splits evenly when total divides sectionCount exactly", () => {
    expect(distributeQuestions(2, 10)).toEqual([5, 5]);
  });

  it("gives the last `remainder` sections one extra (documented example)", () => {
    expect(distributeQuestions(3, 10)).toEqual([3, 3, 4]);
  });

  it("returns [total] for a single section", () => {
    expect(distributeQuestions(1, 7)).toEqual([7]);
  });

  it("still sums to total when sectionCount exceeds total", () => {
    const result = distributeQuestions(5, 2);
    expect(result).toHaveLength(5);
    expect(result.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("returns an empty array for sectionCount = 0 (degenerate input, no guard in caller)", () => {
    expect(distributeQuestions(0, 10)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and verify**

Run: `npx vitest run tests/lib/question-distribute.test.ts`
Expected: 5 passed.

- [ ] **Step 3: Commit** (skip if this repo has no git remote configured yet — otherwise `git add tests/lib/question-distribute.test.ts && git commit -m "test: add pure-logic template (distributeQuestions)"`)

---

### Task 4: Template — Supabase CRUD file (`lib/supabase/profiles.ts`)

This is also Phase 1's own end-to-end verification (per the infra spec) — it proves the whole `server-only` alias + Supabase mock chain actually works, not just that the pieces individually look right.

**Files:**
- Create: `tests/lib/supabase/profiles.test.ts`

**Interfaces:**
- Consumes: `createFakeSupabaseClient` from `@/tests/support/supabase-mock`; `getProfileByAppwriteId`, `updateProfileName`, `deleteProfile`, `createProfile` from `@/lib/supabase/profiles`; `createServiceClient` from `@/lib/supabase/server`

- [ ] **Step 1: Write the tests**

```ts
// tests/lib/supabase/profiles.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServiceClient } from "@/lib/supabase/server";
import { createFakeSupabaseClient } from "@/tests/support/supabase-mock";
import {
  getProfileByAppwriteId,
  updateProfileName,
  deleteProfile,
  createProfile,
} from "@/lib/supabase/profiles";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProfileByAppwriteId", () => {
  it("returns the row when found", async () => {
    const row = {
      id: "p1", appwrite_user_id: "u1", email: "a@b.com",
      full_name: "A", role: "student", xp: 0, streak_count: 0,
    };
    vi.mocked(createServiceClient).mockReturnValue(
      createFakeSupabaseClient({ data: row, error: null }) as any
    );
    expect(await getProfileByAppwriteId("u1")).toEqual(row);
  });

  it("returns null when no row matches", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createFakeSupabaseClient({ data: null, error: null }) as any
    );
    expect(await getProfileByAppwriteId("missing")).toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createFakeSupabaseClient({ data: null, error: new Error("db down") }) as any
    );
    await expect(getProfileByAppwriteId("u1")).rejects.toThrow("db down");
  });
});

describe("updateProfileName", () => {
  it("resolves on success", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createFakeSupabaseClient({ data: null, error: null }) as any
    );
    await expect(updateProfileName("p1", "New Name")).resolves.toBeUndefined();
  });

  it("throws on a DB error", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createFakeSupabaseClient({ data: null, error: new Error("constraint violation") }) as any
    );
    await expect(updateProfileName("p1", "New Name")).rejects.toThrow("constraint violation");
  });
});

describe("deleteProfile", () => {
  it("resolves on success", async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      createFakeSupabaseClient({ data: null, error: null }) as any
    );
    await expect(deleteProfile("p1")).resolves.toBeUndefined();
  });
});

describe("createProfile", () => {
  it("defaults role to student when omitted", async () => {
    const inserted = {
      id: "p2", appwrite_user_id: "u2", email: "c@d.com",
      full_name: "C", role: "student", xp: 0, streak_count: 0,
    };
    const client = createFakeSupabaseClient({ data: inserted, error: null });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    const result = await createProfile({ appwriteUserId: "u2", email: "c@d.com", fullName: "C" });

    expect(result).toEqual(inserted);
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "student" })
    );
  });

  it("passes through an explicit role", async () => {
    const client = createFakeSupabaseClient({
      data: { id: "p3", appwrite_user_id: "u3", email: "e@f.com", full_name: "E", role: "pending_teacher", xp: 0, streak_count: 0 },
      error: null,
    });
    vi.mocked(createServiceClient).mockReturnValue(client as any);

    await createProfile({ appwriteUserId: "u3", email: "e@f.com", fullName: "E", role: "pending_teacher" });

    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "pending_teacher" })
    );
  });
});
```

- [ ] **Step 2: Run and verify**

Run: `npx vitest run tests/lib/supabase/profiles.test.ts`
Expected: 7 passed. If this fails with "Cannot find package 'server-only'", Task 1 wasn't applied correctly — stop and fix the alias before continuing to any other lib/ task.

- [ ] **Step 3: Commit**

---

### Task 5: Template — Appwrite file (`lib/appwrite/server.ts`)

**Files:**
- Create: `tests/lib/appwrite/server.test.ts`

**Interfaces:**
- Consumes: `createServerUsers`, `createPublicAccount`, `createSessionClient` from `@/lib/appwrite/server`

- [ ] **Step 1: Write the tests**

These factories construct real `node-appwrite` `Client`/`Users`/`Account` instances from env vars — no network call happens at construction time, so this doesn't need to mock `node-appwrite` itself, only exercise the env-var validation and confirm the right class comes back.

```ts
// tests/lib/appwrite/server.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Users, Account } from "node-appwrite";

const ENV_KEYS = ["APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) originalEnv[k] = process.env[k];
  process.env.APPWRITE_ENDPOINT = "https://appwrite.test/v1";
  process.env.APPWRITE_PROJECT_ID = "proj1";
  process.env.APPWRITE_API_KEY = "key1";
});

afterEach(() => {
  for (const k of ENV_KEYS) process.env[k] = originalEnv[k];
});

describe("createServerUsers", () => {
  it("returns a Users instance when env vars are present", async () => {
    const { createServerUsers } = await import("@/lib/appwrite/server");
    expect(createServerUsers()).toBeInstanceOf(Users);
  });

  it("throws when APPWRITE_API_KEY is missing", async () => {
    delete process.env.APPWRITE_API_KEY;
    const { createServerUsers } = await import("@/lib/appwrite/server");
    expect(() => createServerUsers()).toThrow(/Missing APPWRITE_ENDPOINT/);
  });
});

describe("createPublicAccount", () => {
  it("returns an Account instance without needing an API key", async () => {
    delete process.env.APPWRITE_API_KEY;
    const { createPublicAccount } = await import("@/lib/appwrite/server");
    expect(createPublicAccount()).toBeInstanceOf(Account);
  });

  it("throws when APPWRITE_PROJECT_ID is missing", async () => {
    delete process.env.APPWRITE_PROJECT_ID;
    const { createPublicAccount } = await import("@/lib/appwrite/server");
    expect(() => createPublicAccount()).toThrow(/Missing APPWRITE_ENDPOINT/);
  });
});

describe("createSessionClient", () => {
  it("returns an Account instance scoped to the given session", async () => {
    const { createSessionClient } = await import("@/lib/appwrite/server");
    expect(createSessionClient("some-session-secret")).toBeInstanceOf(Account);
  });
});
```

- [ ] **Step 2: Run and verify**

Run: `npx vitest run tests/lib/appwrite/server.test.ts`
Expected: 5 passed.

- [ ] **Step 3: Commit**

---

### Task 6: Template — AI-provider file (`lib/ai/client.ts`)

This is the foundational file every other `lib/ai/*.ts` generator routes through — testing it thoroughly here means later `lib/ai/*.ts` tasks only need to mock `chatJson` itself, not re-derive provider/fetch mocking each time.

**Files:**
- Create: `tests/lib/ai/client.test.ts`

**Interfaces:**
- Consumes: `mockProviderFetch`, `makeGeminiMock` from `@/tests/support/ai-provider-mock`; `chatJson`, `resolveProviderConfig` from `@/lib/ai/client`; `getTeacherAiSettings` from `@/lib/supabase/ai-settings`

- [ ] **Step 1: Write the tests**

```ts
// tests/lib/ai/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockProviderFetch, makeGeminiMock } from "@/tests/support/ai-provider-mock";
import { getTeacherAiSettings } from "@/lib/supabase/ai-settings";

vi.mock("@/lib/supabase/ai-settings", () => ({ getTeacherAiSettings: vi.fn() }));
vi.mock("@google/genai", () => makeGeminiMock('{"ok":true}'));

const SCHEMA = { type: "object", properties: { ok: { type: "boolean" } } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  process.env.AI_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveProviderConfig", () => {
  it("falls back to the platform default when no profileId is given", async () => {
    const { resolveProviderConfig } = await import("@/lib/ai/client");
    const config = await resolveProviderConfig();
    expect(config.provider).toBe("openrouter");
  });

  it("returns the teacher's saved config when one exists", async () => {
    vi.mocked(getTeacherAiSettings).mockResolvedValue({
      provider: "gemini", apiKey: "teacher-key",
    });
    const { resolveProviderConfig } = await import("@/lib/ai/client");
    const config = await resolveProviderConfig("teacher-1");
    expect(config).toEqual({ provider: "gemini", apiKey: "teacher-key" });
  });

  it("falls back to platform default when the teacher has no saved settings", async () => {
    vi.mocked(getTeacherAiSettings).mockResolvedValue(null);
    const { resolveProviderConfig } = await import("@/lib/ai/client");
    const config = await resolveProviderConfig("teacher-1");
    expect(config.provider).toBe("openrouter");
  });
});

describe("chatJson — OpenAI-compatible providers (OpenRouter/Hack Club)", () => {
  it("parses a well-formed response", async () => {
    mockProviderFetch({ choices: [{ message: { content: '{"ok":true}' } }] });
    const { chatJson } = await import("@/lib/ai/client");
    const result = await chatJson("prompt", SCHEMA, { provider: "openrouter", apiKey: "k" });
    expect(result).toEqual({ ok: true });
  });

  it("throws when no apiKey is configured", async () => {
    const { chatJson } = await import("@/lib/ai/client");
    await expect(
      chatJson("prompt", SCHEMA, { provider: "openrouter" })
    ).rejects.toThrow(/requires an API key/);
  });

  it("surfaces a provider-embedded error even on HTTP 200 (the 429-rate-limit case)", async () => {
    mockProviderFetch({ id: "gen-1", error: { message: "Provider returned error", code: 429 } }, 200);
    const { chatJson } = await import("@/lib/ai/client");
    await expect(
      chatJson("prompt", SCHEMA, { provider: "openrouter", apiKey: "k" })
    ).rejects.toThrow(/OpenRouter error \(429\): Provider returned error/);
  });

  it("throws on a non-OK HTTP response", async () => {
    mockProviderFetch({ message: "server error" }, 500);
    const { chatJson } = await import("@/lib/ai/client");
    await expect(
      chatJson("prompt", SCHEMA, { provider: "openrouter", apiKey: "k" })
    ).rejects.toThrow(/request failed \(500\)/);
  });

  it("throws when the response has no choices/message/content", async () => {
    mockProviderFetch({ id: "gen-1" });
    const { chatJson } = await import("@/lib/ai/client");
    await expect(
      chatJson("prompt", SCHEMA, { provider: "openrouter", apiKey: "k" })
    ).rejects.toThrow(/unexpected response format/);
  });
});

describe("chatJson — Ollama", () => {
  it("parses a well-formed response", async () => {
    mockProviderFetch({ message: { content: '{"ok":true}' } });
    const { chatJson } = await import("@/lib/ai/client");
    const result = await chatJson("prompt", SCHEMA, { provider: "ollama", host: "http://localhost:11434" });
    expect(result).toEqual({ ok: true });
  });

  it("throws on a non-OK response with the body text included", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, text: async () => "boom" })));
    const { chatJson } = await import("@/lib/ai/client");
    await expect(
      chatJson("prompt", SCHEMA, { provider: "ollama" })
    ).rejects.toThrow(/Ollama request failed \(500\): boom/);
  });
});

describe("chatJson — Gemini", () => {
  it("parses a well-formed response via the mocked SDK", async () => {
    const { chatJson } = await import("@/lib/ai/client");
    const result = await chatJson("prompt", SCHEMA, { provider: "gemini", apiKey: "k" });
    expect(result).toEqual({ ok: true });
  });

  it("throws when no apiKey is configured", async () => {
    const { chatJson } = await import("@/lib/ai/client");
    await expect(
      chatJson("prompt", SCHEMA, { provider: "gemini" })
    ).rejects.toThrow(/Gemini requires an API key/);
  });
});
```

- [ ] **Step 2: Run and verify**

Run: `npx vitest run tests/lib/ai/client.test.ts`
Expected: 11 passed. Note this test exercises the exact `data.error` embedded-error bug fixed earlier this session (see the "surfaces a provider-embedded error" case) — if this regresses, that fix has been reverted.

- [ ] **Step 3: Commit**

---

### Task 7: Remaining `lib/` files — task table

Every remaining file below gets its own test file under `tests/lib/...` (mirroring its source path), following whichever template (Task 3/4/5/6) matches its category. Each is right-sized as its own task: a reviewer could approve testing of one file while rejecting another, and files differ enough in actual branch logic that no two are truly identical work. Consult the lib/actions catalog (path in Global Constraints) for the exact function signatures and branch list per file before writing its test — the "behaviors" column below is a condensed pointer into that catalog, not a replacement for reading it.

**Pure logic (Template: Task 3), no mocking needed:**

| File | Key behaviors to cover |
|---|---|
| `lib/roles.ts` | Already has `lib/roles.test.ts` — confirm it covers `canManageSubject` (admin/owner/non-owner/student) and `roleHome` (all 4 roles + undefined); add any missing case. |
| `lib/diagnostic-scoring.ts` | Every question-type branch of `scoreDiagnosticAnswerInstant`; empty-pairs match → 0 not NaN; short_answer always null; unknown type → 0. |
| `lib/diagnostic-client.ts` | `toClientDiagnosticQuestion` per type — assert answer-revealing fields never appear in output; match-type shuffle produces a valid permutation. |
| `lib/question-client.ts` | `toClientFormat` per format type — assert `correctIndexes`/`accepted`/`answer`/markscheme never leak; matching shuffle permutation check. |
| `lib/question-marking.ts` | Already has `lib/question-marking.test.ts` covering `answersMatch`/`autoMark`/`payloadToText` — this is the most test-critical pure function in the catalog; verify all cases listed there are present (exact/case/abbreviation/math-symbol/fraction-vs-decimal/fuzzy-boundary matches) and extend if any documented branch (e.g. `payloadToText`'s calculation workingSteps-vs-working precedence) is missing. |
| `lib/text-chunk.ts` | Empty/whitespace input → `[]`; shorter-than-size → single chunk; exact-size boundary; multi-window overlap correctness. |
| `lib/text-sanitize.ts` | `collapseRepeatedChars` 3-vs-4+ repeat boundary, unicode; `deepCollapseRepeatedChars` nested object/array/primitive pass-through. |
| `lib/utils.ts` | `cn` conflicting-Tailwind-class merge, falsy/conditional inputs filtered. |
| `lib/lesson-sanitize.ts` | Already has `lib/lesson-sanitize.test.ts` — confirm HTML tag/attr stripping and SVG theme-color allowlist + malformed-input-returns-`""` cases are present. |
| `lib/cache/session-store.ts` | `getSubjectDetail` missing-id → null; `clear()` swallows a `sessionStorage` throw; constructor no-ops when `window` undefined (mock via `vi.stubGlobal("window", undefined)` then dynamic import). |
| `lib/question-distribute.ts` | Already covered by Task 3 (this is the template itself). |

**Supabase CRUD (Template: Task 4), mock via `createFakeSupabaseClient`:**

| File | Key behaviors to cover |
|---|---|
| `lib/supabase/profiles.ts` | Already covered by Task 4 (this is the template itself). |
| `lib/supabase/admin-users.ts` | `deleteProfileById` returns null + skips delete when profile not found; found → deletes + returns appwrite id. |
| `lib/supabase/ai-settings.ts` | `getTeacherAiSettings` maps null model/host → undefined; `saveTeacherAiSettings` upsert shape; delete. |
| `lib/supabase/assignments.ts` | `listAssignmentsForStudent`/`getForkingAssignment` early-return-on-no-memberships; `getForkingAssignment` null-notes filtering + most-recent ordering; `copyAssignments` empty-source/all-already-assigned/partial-overlap counts. |
| `lib/supabase/classes.ts` | `generateInviteCode` charset/length; `createClass` collision-retry (success/2nd-try/5-failures-throws/non-uniqueness-error-rethrows-immediately — use `createFakeSupabaseClientQueue`); `getClassByInviteCode` case-insensitivity; `listClassMembers` wrong-teacher → `[]`; `removeStudentFromClass` wrong-teacher → throws (contrast with `deleteClass`'s silent no-op, per Global Constraints). |
| `lib/supabase/diagnostic.ts` | `createDiagnosticSession` per-type maxMarks/content + unknown-subjectName filtering; `isDiagnosticSessionOwner` all 3 outcomes; `getPendingShortAnswers`/`getSessionQuestionReviews` both array-shaped AND object-shaped `diagnostic_answers` embeds (this is the exact bug fixed earlier this session — lock it in); `buildKnowledgeModel` 0.6 boundary + empty-bucket skip; `getSessionResultsByTopic` skips negative scores. |
| `lib/supabase/flashcards.ts` | All 4 functions — straightforward CRUD, one test each for found/not-found where applicable. |
| `lib/supabase/lessons.ts` | `getLessonByTopic`/`createLesson` null-vs-set classId branching (critical: shared vs forked lesson must never cross-match). |
| `lib/supabase/practice-uploads.ts` | `addUploadedFiles` appends to existing `imagePaths` rather than overwriting; `getUploadSession` null defaults. |
| `lib/supabase/progress.ts` | `awardXp`'s 3 streak branches (same-day/consecutive/broken, including null `last_active_date` on first-ever activity) — this is the most state-dependent function in this group, deserves its own focused test block. |
| `lib/supabase/questions.ts` | The `42703`-triggers-legacy-fallback pattern across all 5 functions that share it; `listQuestionBankForTopic`'s manual JS sort null-handling; `updateQuestionVerification`'s partial-update (omitted fields untouched). |
| `lib/supabase/reports.ts` | `listOpenReports`'s reporter-profile-null → "A student" fallback. |
| `lib/supabase/students.ts` | `getSubjectsNeedingDiagnostic`'s diagnosed/undiagnosed filtering; `getFirstTopicPerSubject`'s empty-input-skips-query and first-topic-per-subject-only logic. |
| `lib/supabase/subjects.ts` | `listSubjectSummariesByOwner`'s owner-scoping (critical for teacher isolation, from the earlier subject-ownership work); `createSubject` with/without examBoardIds. |
| `lib/supabase/topic-documents.ts` | `createTopicDocument`'s zero-chunks-skips-insert; `deleteTopicDocument`'s not-found-skips-appwrite-delete. |
| `lib/supabase/topics.ts` | `createTopics`'s position-offset (first-ever vs continuing) and conditional `exam_board_id` inclusion; `publishTopic`/`unpublishTopic` cascading to subtopics; `publishAllTopicsBySubject`'s zero-topics early return. |
| `lib/supabase/server.ts` | Missing-env-var throw. |

**Appwrite (Template: Task 5):**

| File | Key behaviors to cover |
|---|---|
| `lib/appwrite/server.ts` | Already covered by Task 5 (this is the template itself). |
| `lib/appwrite/session.ts` | `getSession` no-cookie→null, valid-cookie→session, Appwrite-throws→null (never propagates); `requireSession`/`requireRole`/`requireAnyRole`/`requireOwnerOrAdmin` — mock `createSessionClient`, `getProfileByAppwriteId`, `getSubject`, and `next/navigation`/`next/headers` together (this file is the busiest integration point in the app — expect the largest test file in this category). |
| `lib/appwrite/storage.ts` | `uploadFile`'s `File`-instance vs raw-bytes branches; `getFileUrl`'s pure string templating. |

**AI-provider (Template: Task 6), mock via `mockProviderFetch`/`makeGeminiMock`, or mock `chatJson` itself for files that call it rather than re-implement it:**

| File | Key behaviors to cover |
|---|---|
| `lib/ai/client.ts` | Already covered by Task 6 (this is the template itself). |
| `lib/ai/diagnostic.ts` | `subjects.length===0` degenerate `perSubject` division; 30-question cap via `.slice`. Mock `chatJson` directly (`vi.mock("@/lib/ai/client", () => ({ chatJson: vi.fn() }))`) rather than re-mocking fetch, since this file's own logic is what's under test, not the provider dispatch. |
| `lib/ai/embeddings.ts` | No API key → null immediately; API error → caught, null (never throws). |
| `lib/ai/explain.ts` | Thin wrapper — one test confirming trim + chatJson pass-through. |
| `lib/ai/flashcards.ts` | Thin wrapper, one happy-path test. |
| `lib/ai/images.ts` | `generateBytes`'s 4-branch provider selection (preferHackClub × which keys set); `generateLessonImage`'s catch-all-errors-return-null. |
| `lib/ai/lessons.ts` | `generateLesson`/`tweakLesson` — mock `chatJson`, assert prompt content differs for `extraHelp=true` vs false (inspect `chatJson`'s call args). |
| `lib/ai/lesson-tutor.ts` | All 3 functions — thin wrappers, trim/pass-through checks. |
| `lib/ai/marking.ts` | `markAnswersBatch`'s questionId-mismatch-defaults-to-0 edge case (flagged as a potential bug in the catalog — test and document the actual behavior); `markAnswerFromImages`'s 4-branch provider selection + "no vision key" throw. |
| `lib/ai/question-bank.ts` | `generateQuestionBank`'s sort-by-sectionIndex-then-reindex-bankPosition, including out-of-order and invalid sectionIndex inputs. |
| `lib/ai/questions.ts` | Thin wrapper, one happy-path test. |
| `lib/ai/topics.ts` | `generateTopicsForSubject`'s empty-examBoardNames fallback string and specText-vs-not grounding branch; `generateSingleTopic`'s hint/no-hint and existing-topics/none branches. |

**Mixed/other:**

| File | Category | Key behaviors to cover |
|---|---|---|
| `lib/class-content.ts` | supabase+ai | `resolveLessonContent`'s fork-exists-but-malformed-content (`sections[0]?.check` guard) regeneration branch; non-student never forks; `resolveQuestionContent`'s `force:true` always-regenerates. |
| `lib/confetti.ts` | pure/browser | Reduced-motion guard via mocked `matchMedia` — confetti() not called; normal branch called with expected params. |
| `lib/content-pipeline.ts` | supabase+ai | `pregenerateTopicContent`'s topic-missing no-op and the three independent "only generate if missing" guards (lesson/bank/flashcards) — test all 8 combinations is excessive, but at minimum: all-missing, all-present, and the bank-depends-on-newly-created-lesson-sections case. |
| `lib/extract-text.ts` | file-io | PDF-mime, `.pdf`-extension-fallback, and plain-text branches — mock the dynamic `unpdf` import. |
| `lib/lesson-finalize.ts` | pure+ai | `sanitizeInteractive`/`sanitizeVisual`'s per-kind empty-vs-populated boundaries (these are pure and can be tested directly even though they're not exported — test them indirectly via `finalizeLessonContent`/`resanitizeLessonContent`'s observable output); `finalizeVisual`'s existing-url-skips-generation branch. |
| `lib/motion.ts` | pure/React hook | `useReducedMotionSafe` via `@testing-library/react`'s `renderHook` — **this is the one file in this phase that needs a DOM-adjacent testing utility**; add `@testing-library/react` + `jsdom` as devDependencies just for this one test file's `environment: "jsdom"` override (Vitest supports per-file environment via a `// @vitest-environment jsdom` comment, avoiding a global jsdom switch for the rest of the Node-environment suite). |
| `lib/question-finalize.ts` | ai (image) | Question-with-no-image skips generation; image-generation-throwing caught to null without failing the batch. |
| `lib/rag.ts` | supabase+ai+file-io | `getReferenceContext`'s 3 early-return branches (no indexed chunks / embedding fails / no search results) plus happy path; `withReferenceContext`'s 4 combinations of base/reference present-or-not. |
| `lib/rate-limit.ts` | next-request | First-N-succeed/N+1-rejected within window; expiry after `windowMs`; independent buckets/IPs. **Module has in-memory state — use `vi.resetModules()` + dynamic re-import between test cases that need a fresh Map**, or accept shared state across tests in one `describe` block and design test order accordingly (document whichever choice is made in the test file). |
| `lib/subtopic-content.ts` | supabase+ai | Same get-or-generate + malformed-guard pattern as `class-content.ts`'s subtopic variant; verify RAG context is fetched using the **parent topic's** id, not the subtopic's. |

---

## PHASE 3 — `app/actions/` Unit Tests

### Task 8: Template — Server Action (`app/actions/classes.ts`)

Chosen as the template because it exercises every recurring action-layer concern at once: zod validation, ownership delegated to the lib layer, `revalidatePath`, and a throw-on-missing-field guard — without the extra complexity of AI calls or file uploads that some other action files add on top.

**Files:**
- Create: `tests/actions/classes.test.ts`

**Interfaces:**
- Consumes: `makeNavigationMock`, `makeCacheMock` from `@/tests/support/next-mocks`; `createFakeSupabaseClient` from `@/tests/support/supabase-mock`; `createClassAction`, `deleteClassAction`, `removeStudentAction` from `@/app/actions/classes`; mocks `requireRole` from `@/lib/appwrite/session` directly (simpler than mocking its own dependencies transitively, since the action layer's contract with `requireRole` is just "resolves to `{profile}` or throws/redirects")

- [ ] **Step 1: Write the tests**

```ts
// tests/actions/classes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireRole } from "@/lib/appwrite/session";
import { createClass, deleteClass, removeStudentFromClass } from "@/lib/supabase/classes";
import { revalidatePath } from "next/cache";
import { makeCacheMock } from "@/tests/support/next-mocks";
import { createClassAction, deleteClassAction, removeStudentAction } from "@/app/actions/classes";

vi.mock("@/lib/appwrite/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/classes", () => ({
  createClass: vi.fn(),
  deleteClass: vi.fn(),
  removeStudentFromClass: vi.fn(),
}));
vi.mock("next/cache", () => makeCacheMock());

const TEACHER = { profile: { id: "teacher-1", role: "teacher" } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(TEACHER as any);
});

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("createClassAction", () => {
  it("throws when the name is under 2 characters", async () => {
    await expect(createClassAction(formData({ name: "A" }))).rejects.toThrow(
      /at least 2 characters/
    );
    expect(createClass).not.toHaveBeenCalled();
  });

  it("creates the class and revalidates on success", async () => {
    vi.mocked(createClass).mockResolvedValue({ id: "c1" } as any);
    await createClassAction(formData({ name: "Year 11 Chemistry" }));
    expect(createClass).toHaveBeenCalledWith({ name: "Year 11 Chemistry", teacherId: "teacher-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/teacher/classes");
  });
});

describe("deleteClassAction", () => {
  it("throws when classId is missing", async () => {
    await expect(deleteClassAction(formData({}))).rejects.toThrow(/Missing classId/);
  });

  it("delegates to deleteClass without a separate throw on ownership mismatch (silent no-op is deleteClass's own behavior, not this action's)", async () => {
    vi.mocked(deleteClass).mockResolvedValue(undefined);
    await deleteClassAction(formData({ classId: "c1" }));
    expect(deleteClass).toHaveBeenCalledWith({ classId: "c1", teacherId: "teacher-1" });
  });
});

describe("removeStudentAction", () => {
  it("throws when classId or studentId is missing", async () => {
    await expect(removeStudentAction(formData({ classId: "c1" }))).rejects.toThrow(
      /Missing classId or studentId/
    );
  });

  it("propagates a thrown ownership error from removeStudentFromClass (contrast with deleteClassAction's silent no-op)", async () => {
    vi.mocked(removeStudentFromClass).mockRejectedValue(new Error("Class not found."));
    await expect(
      removeStudentAction(formData({ classId: "c1", studentId: "s1" }))
    ).rejects.toThrow("Class not found.");
  });
});
```

- [ ] **Step 2: Run and verify**

Run: `npx vitest run tests/actions/classes.test.ts`
Expected: 6 passed.

- [ ] **Step 3: Commit**

---

### Task 9: Remaining `app/actions/` files — task table

Same right-sizing rationale as Task 7. Every action file needs `makeNavigationMock`/`makeCacheMock` for any action that redirects/revalidates; add `makeHeadersMock` for cookie-touching ones (`auth.ts`, `practice-uploads.ts`'s header-based URL building).

| File | Key behaviors to cover |
|---|---|
| `app/actions/account.ts` | `deleteAccountAction`'s exact-string `"DELETE"` confirmation check (including lowercase rejection); Appwrite cleanup errors swallowed, doesn't block redirect. |
| `app/actions/admin-users.ts` | `deleteUserAccountAction`'s self-deletion block (`profileId === admin.id`); `deleteProfileById` returning null skips the Appwrite call. |
| `app/actions/ai-settings.ts` | `saveTeacherAiSettingsAction`'s blank-apiKey-preserves-existing-key vs blank-with-no-prior-throws. |
| `app/actions/assign.ts` | `assertOwnsClass` guard firing before any write, on both `assignTopicAction` and `copyAssignmentsAction`; same-source-and-target throw. |
| `app/actions/auth.ts` | `signup`/`login`'s generic-error-on-any-failure (enumeration prevention — assert the SAME message for "email exists" and "any other failure"); rate-limit-exceeded branch (mock `checkRateLimit`); `roleHome(undefined)` fallback when Appwrite-authed user has no Supabase profile; `logout`'s no-cookie and delete-throws branches both still redirect. |
| `app/actions/classes.ts` | Already covered by Task 8 (this is the template itself). |
| `app/actions/diagnostic.ts` | `startFreshDiagnosticAction`'s zero-subjects and all-diagnosed redirect branches (no AI call in either); `startRecapDiagnosticAction`'s 3-topic cap and malformed-entry-without-`::`-separator; `submitDiagnosticLevelAction`'s non-owner-throws-before-scoring and the AI-marking-throws-falls-back-to-zero branch on the last question. |
| `app/actions/flashcards.ts` | `regenerateFlashcardsAction` always generates fresh, never reuses. |
| `app/actions/lessons.ts` | `completeLessonAction`'s non-student no-op (no XP/completion calls); `askLessonTutorAction`'s 500/501-char boundary; `uploadLessonImageAction`'s 3 independent validation throws (missing/wrong-type/oversized); `saveSubtopicLessonAction`'s malformed-JSON-specific-message and the combined section-completeness validation (test a section missing just one field, not just "all empty"); `markOpenAnswerAction`'s regex-mark-parse vs length-heuristic-fallback. |
| `app/actions/onboarding.ts` | `parseSelections`'s malformed-entry propagating as a ZodError; `saveSubjectSelectionAction`'s throw-on-empty vs `addSubjectsAction`'s redirect-on-empty (contrast explicitly); the `startedSyllabus`-determines-redirect-target branch. |
| `app/actions/practice.ts` | `submitAnswerAction`'s images-always-vision-marked-regardless-of-format branch; autoMark-null-falls-to-AI; structured-format markscheme-flattening-with-label-prefixes; teacher/admin-no-XP; `submitBankAnswerAction`'s exact-match `correct` flag (partial marks ≠ correct) and `isRetry` string-to-boolean coercion. |
| `app/actions/practice-uploads.ts` | `createPracticeUploadSessionAction`'s header-fallback URL branches (missing host, localhost-vs-not proto default); `getPracticeUploadStatusAction`'s cross-student-null (ownership-as-404); `uploadPracticeImagesAction`'s all-or-nothing batch rejection on one bad file (type or size), tested with a mixed valid+invalid batch. |
| `app/actions/reports.ts` | `reportContentAction`'s optional-field-to-null coercion (not a throw). |
| `app/actions/subject-cache-actions.ts` | Subject-not-found → null; zero-topics → no subtopic fan-out calls. |
| `app/actions/topic-documents.ts` | `uploadTopicDocumentsAction`'s sequential-not-parallel processing (assert call order via a mock that records call sequence) and zero-valid-files throw. |
| `app/actions/subjects.ts` | The largest file (18 functions) — split across its own sub-tasks if a reviewer would want to approve pieces independently: (a) ownership-enforcement is applied to every mutating function (a table-driven test iterating the ownership-checked functions is more maintainable than 15 near-identical individual tests); (b) `deleteSubjectAction`'s `redirectTo`-present-vs-default branch; (c) `publishSubjectAction`'s `Promise.all` vs `generateTopicsAction`'s `Promise.allSettled` behavioral contrast (per Global Constraints — test both as-is); (d) `generateTopicsAction`'s per-board-vs-all-boards draft-deletion scoping; (e) `saveSubjectArchetypeAction`'s invalid-archetype-silently-coerced-to-null; (f) `updateQuestionVerificationAction`'s lack of ownership check (flagged in the catalog as a possible gap — test the current behavior, note the gap in the test description, don't silently fix it). |

---

## PHASE 4 — Playwright + UI Coverage

### Task 10: Install and configure Playwright, first smoke spec

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/landing-and-auth.spec.ts`

**Interfaces:**
- Produces: `npx playwright test` runs against the real dev server.

- [ ] **Step 1: Install**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Configure**

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // this app has shared server-side state (rate limiter, in-memory caches) — parallel runs would flake
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

Note: this app's real backend is Supabase + Appwrite, both external services. Playwright specs in this phase run against a **real dev server hitting real (test-tier) Supabase/Appwrite instances** — there is no mocking layer for E2E, by design (that's what makes it end-to-end). This plan assumes a seeded test account per role (student/teacher/admin) exists or gets created via the signup flow inside the specs themselves. Provisioning those test accounts/seed data is a prerequisite this plan doesn't cover — flag it to whoever executes this phase before Task 11 starts, since every subsequent spec depends on being able to log in as each role.

- [ ] **Step 3: First spec — public landing + auth**

```ts
// tests/e2e/landing-and-auth.spec.ts
import { test, expect } from "@playwright/test";

test.describe("landing page", () => {
  test("shows Get Started and Log In CTAs for an anonymous visitor", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
  });

  test("Get Started navigates to /signup", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/signup$/);
  });
});

test.describe("login form", () => {
  test("shows a field error for an invalid email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("not-an-email");
    await page.getByLabel(/password/i).fill("whatever");
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test("shows a generic error for wrong credentials (no enumeration leak)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("nobody@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword123");
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();
  });
});
```

- [ ] **Step 4: Run and verify**

Run: `npx playwright test tests/e2e/landing-and-auth.spec.ts`
Expected: 4 passed, against the real dev server.

---

### Task 11: Remaining pages — task table, organized by role area

Each row becomes one `tests/e2e/<area>/<route-name>.spec.ts` file. Pure-redirect pages (`/admin`, `/teacher`, `/onboarding/diagnostic/[sessionId]`) get a one-assertion smoke test each, not a full flow spec. Consult the components/pages catalog (path in Global Constraints) for the exact interaction list per page before writing its spec.

**Public / auth area:**

| Route | Spec focus |
|---|---|
| `/` | Covered by Task 10. |
| `/login`, `/signup` | Covered by Task 10 for the error paths; add a real successful-signup-then-redirect-to-onboarding flow and a successful-login-then-role-based-redirect flow once seed/throwaway test accounts exist. |
| `/pending-approval` | `pending_teacher` sees the page and can sign out; any other role visiting is redirected away. |

**Student area (`requireRole("student")` unless noted):**

| Route | Spec focus |
|---|---|
| `/account` | Update name persists; delete-account requires typed "DELETE" confirmation and then logs out. |
| `/dashboard` | XP/streak render; subject card navigates to `/subjects/[id]`; Add subjects link navigates correctly. |
| `/dashboard/add-subjects` | Checking subjects and submitting adds them; empty-state when nothing left to add. |
| `/onboarding` | Join-class-by-code flow; subject selection flow; already-onboarded auto-redirect to `/dashboard`. |
| `/onboarding/topics` | Select-up-to-3-topics flow; skip-to-dashboard when no topics exist. |
| `/onboarding/diagnostic` | All-caught-up state links; starting a diagnostic navigates to level 0. |
| `/onboarding/diagnostic/[sessionId]` | Redirect-shim smoke test only. |
| `/onboarding/diagnostic/[sessionId]/level/[position]` | Answering advances to next position; last question redirects to results; out-of-range position 404s; another user's sessionId 404s. |
| `/onboarding/diagnostic/[sessionId]/results` | High score (≥0.8) triggers confetti; per-topic breakdown renders; non-owner 404s. |
| `/join/[code]` | Valid code joins and shows class name; invalid code shows the mismatch message; dashboard link works. |
| `/subjects/[subjectId]` | Exam-board tab switching changes visible topics; path-unit click navigates to the right lesson/practice route; weak-topic flagging visible; unknown id 404s. |
| `/learn/[topicId]`, `/learn/subtopic/[subtopicId]` | Student completes lesson and earns XP; teacher/admin preview banner shown and does NOT earn XP; unknown id 404s. (These two routes share the LessonPlayer pattern closely enough to share one parametrized spec file, per the components catalog's own note.) |
| `/flashcards/[topicId]`, `/flashcards/subtopic/[subtopicId]` | Flip/advance through deck; unknown id 404s. |
| `/practice/[topicId]`, `/practice/subtopic/[subtopicId]` | Answer-and-submit shows marking feedback; bank mode navigation between questions; Report button works; unknown id 404s. |
| `/practice/[topicId]/upload/[uploadId]` | Upload a photo/PDF shows confirmation; another student's uploadId 404s. |

**Teacher area (`requireRole("teacher")` unless noted):**

| Route | Spec focus |
|---|---|
| `/teacher` | Redirect-shim smoke test. |
| `/teacher/classes` | Create/delete class; remove student; copy invite code shows "Copied!"; assign topic to class; copy assignments between classes. |
| `/teacher/subjects`, `/teacher/subjects/[subjectId]` | Own-subject CRUD (create/publish/generate topics/etc — same interaction list as the admin subject detail page below, parametrized by `basePath`); a subject owned by another teacher or admin 404s when accessed directly by id (the ownership check from the earlier subject-ownership work). |
| `/teacher/mark` | Upload image + question/markscheme returns AI marking feedback; validation when fields missing. |
| `/teacher/settings` | Save a provider/API key; Remove deletes it and hides the "using your own key" banner. |

**Admin area (`requireRole("admin")`, enforced at `app/admin/layout.tsx` — confirmed during this planning pass, resolving the catalog's flagged gap for `/admin/settings`):**

| Route | Spec focus |
|---|---|
| `/admin` | Redirect-shim smoke test. |
| `/admin/subjects` | Create subject/exam board; card click opens quick-preview modal; Full Subject Manager link navigates. |
| `/admin/subjects/[subjectId]` | The most feature-dense page in the app: exam-board tabs, generate-topics-from-spec, add-custom-topic, publish/unpublish cascading to subtopics, delete subtopic, upload/delete topic document, question-bank editor (verify/edit/save), save custom instructions; unknown id 404s. Budget this as multiple spec files by sub-feature (e.g. `admin-subject-topics.spec.ts`, `admin-subject-documents.spec.ts`, `admin-subject-question-bank.spec.ts`) rather than one enormous file — each is independently reviewable. |
| `/admin/users` | Approve/Reject a pending teacher; delete a user account. |
| `/admin/reports` | Mark-resolved removes a report from the open list; empty state. |
| `/admin/settings` | Provider/model label displays correctly; Ollama reachability badge reflects actual `/api/version` reachability (mock or point at a real local Ollama if available in the test environment). |

---

### Task 12: Genuinely interactive components — task table

Per the components catalog's own guidance: presentational-only components (buttons, badges, skeletons, static SVG logos, `RichText`, etc. — noted "covered incidentally by page-level tests" throughout the catalog) do **not** get a dedicated spec; their behavior is exercised as a side effect of the page specs in Task 11. Only components with real, non-trivial user interaction get their own focused spec, since a page-level spec exercising them only once wouldn't cover their internal edge cases (e.g. a matching board's drag-vs-tap-fallback paths).

| Component | Spec focus |
|---|---|
| `components/admin-question-bank-editor.tsx` | Edit-mode toggle; Save & Verify persists; Verify/Unverify toggle without editing. |
| `components/admin-subject-grid.tsx` | Card click → modal loading → detail; close dismisses; failed fetch shows error state. |
| `components/copy-button.tsx` | Click copies to clipboard and shows "Copied!" for ~2s. |
| `components/explain-box.tsx` | Click shows loading then explanation; fetch failure shows fallback message. |
| `components/interactive-clarification.tsx` (`StepReveal`/`ClarificationCard`/`SortOrder`/`MatchConnect`) | Each exported component's interaction list per the catalog — 4 sub-specs. |
| `components/interactive/fill-gap.tsx` | Type-and-check per-gap coloring; hint reveal; reset. |
| `components/interactive/match-connect.tsx` | Tap-select-then-select connects; check coloring; reset. |
| `components/interactives/block-sort.tsx` | Tap-to-place/remove; check coloring; codify reveal; continue. |
| `components/interactives/branching.tsx` | Choice → consequence panel; codify reveal; continue. |
| `components/interactives/categorize.tsx` | **Test via the tap-to-place fallback as the primary path** (per the catalog's own flakiness warning about HTML5 drag simulation in Playwright), with a secondary drag-based test only if the tap path proves insufficient. |
| `components/interactives/flowchart-sort.tsx` | Tap-to-swap reordering; check coloring; reset; codify. |
| `components/interactives/graph-transformer.tsx` | Slider drag updates curve/observation text (assert text/value, not pixel path data, per the catalog's own note); codify. |
| `components/interactives/lesson-interactive.tsx` | Correct sub-component renders per `kind` — a thin dispatcher test, mostly covered by the individual interactive specs above. |
| `components/interactive/sort-order.tsx` | Tap-swap; check; lock-out on correct. |
| `components/interactives/slider-sim.tsx` | Slider reveals outcome; broken-config fallback with Skip. |
| `components/interactive/step-reveal.tsx` | Click reveals next step; final state after last step. |
| `components/matching-board.tsx` | Drag-connect; tap-to-arm fallback; revealed correct/incorrect coloring. |
| `components/math-answer-composer.tsx` | Keypad-inserts-at-last-focused-field; fraction/power builders; add/remove working steps. |
| `components/navbar.tsx` | Avatar dropdown open/close; Dashboard/Account/Log Out links; logged-out shows Login/Sign Up instead. |
| `components/navigation-progress.tsx` | Internal link triggers progress bar; external/hash/`mailto:`/`target=_blank` links do NOT. |
| `components/option-button.tsx` | Click fires onClick; disabled blocks it; visual state per prop (via page-level MCQ specs). |
| `components/report-button.tsx` | Open form → submit → success; lesson-only regenerate/escalate offer; cancel. |
| `components/star-rating.tsx` | `aria-label` matches expected score (via the results-page spec, not standalone). |
| `components/submit-button.tsx` | Disables immediately on submit, shows `pendingText` (via whichever form spec exercises it — no standalone spec needed). |
| `components/subtopic-lesson-editor.tsx` | The most complex client component in the app — section-tab switching, Markdown+KaTeX live preview, image upload/remove/replace, quick-check editing (MCQ vs free-text), prev/next, save. Budget as its own multi-case spec file, not folded into the page spec. |
| `components/ui/checkbox.tsx`, `components/ui/tabs.tsx` | Toggle/switch behavior — covered via the onboarding/add-subjects (`checkbox`) and subject-detail (`tabs`) page specs; no standalone spec needed given they're thin base-ui wrappers already exercised there. |

Route-local helper components flagged by the catalog as out-of-scope for the 47-file `components/` count but driving real page interactivity (`UpdateNameForm`, `DeleteAccountForm`, `FlashcardDeck`, `AnswerForm`, `BankPracticePlayer`, `UploadForm`, `PaperMarkForm`, `LessonPlayer`, `QuickCheck`, `CreateSubjectForm`, `AddExamBoardForm`, `DeleteUserButton`) are exercised through the Task 11 page specs that mount them (e.g. `AnswerForm` via the `/practice/[topicId]` spec) — they don't need separate entries here since their interaction surface is already listed against the pages that use them.

---

## Self-review notes (fixed inline during planning, listed for transparency)

- The original test-infrastructure spec's `mockSupabaseServer`/`mockAppwriteServer` factory pattern was simplified to the more standard `vi.mock(path, () => ({ fn: vi.fn() }))` + `vi.mocked(fn).mockReturnValue(...)` pattern for Supabase/Appwrite (Phase 1, Task 2 and its Global Constraints note) — the factory-object approach only earns its keep when a mock's shape is fixed across every use (true for `next/navigation`/`next/cache`/`next/headers`/`@google/genai`, false for Supabase/Appwrite where each test needs different rows/errors).
- Phase 1's Task 4 doubles as the infra spec's own required verification step (a real, kept test proving the mock chain works) rather than a separate throwaway file — one less artifact, same guarantee.
- `app/admin/settings/page.tsx`'s auth gating, flagged by the cataloging pass as unverified, was confirmed during this planning session: it's gated at `app/admin/layout.tsx`'s `requireRole("admin")`, not per-page. Noted in Phase 4's admin-area task table so execution doesn't re-flag it as a gap.
