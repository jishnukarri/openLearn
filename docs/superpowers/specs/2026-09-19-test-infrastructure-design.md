# Test infrastructure (sub-project 1 of 4)

## Context

The user wants 100% test coverage across the codebase (217 source files). That's too large for one spec/plan, so it's decomposed into four independently shippable sub-projects:

1. **Test infrastructure** (this spec) — mocking helpers, config, folder structure. Nothing else can start without it.
2. `lib/` unit tests (53 files) — pure logic plus Supabase/Appwrite/AI-provider-backed functions, using the mocks built here.
3. `app/actions/` unit tests (16 files) — Server Actions, using the same mocks plus Next.js request-API mocks.
4. Playwright + UI coverage (47 components, 34 pages) — a different tool entirely, since React Server Components aren't unit-testable and this app has no client-only component logic worth isolating from real rendering.

This spec covers only #1.

## Problem

Two structural blockers stop any lib/actions test from even loading its target module today:

- **`server-only`** is imported at the top of 38 files under `lib/`. It is not a real installed npm package — Next.js only makes it resolvable through its own bundler (webpack/Turbopack), by aliasing it to an empty module during the Next build. Running the same file through plain Vitest throws `Cannot find package 'server-only'` (verified directly: a throwaway test file importing it fails exactly this way before any assertion runs).
- **Next.js request-scoped APIs** — `redirect()`/`notFound()` (`next/navigation`), `cookies()`/`headers()` (`next/headers`), `revalidatePath()` (`next/cache`) — all read from Next's internal `AsyncLocalStorage` request context, which only exists inside a real request handled by the Next server. Called from a plain Vitest test, they throw. Every Server Action and every page component calls at least one of these.

Additionally, all data access goes through exactly one factory function per concern — `createServiceClient()` (Supabase), `createServerUsers()`/`createPublicAccount()`/`createSessionClient()` (Appwrite) — and all AI-provider calls go through `chatJson()` in `lib/ai/client.ts`, which either calls `fetch()` directly (OpenRouter, Hack Club, Ollama) or dynamically imports `@google/genai` (Gemini). These are the seams every mock hangs off.

## Design

### New dependency

`@vitest/coverage-v8` (devDependency) — the only new package needed for this sub-project. Nothing else (no MSW, no jsdom, no testing-library): sub-projects 2–3 test server-only logic in Node, not rendered UI: sub-project 4 owns Playwright and its own dependencies separately.

### `vitest.config.ts` (new file — the project currently runs vitest zero-config)

```ts
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
      exclude: [
        "lib/**/*.test.ts",
        "lib/ai/**", // provider-calling code covered via mocked fetch, but
                     // schema-definition-only files (no branches) are excluded
                     // case-by-case as sub-project 2 finds them — not decided here
      ],
    },
  },
});
```

The `@` alias mirrors the `paths` entry already in `tsconfig.json` (`"@/*": ["./*"]`) — Vitest doesn't read `tsconfig.json` path mappings on its own, so every test importing `@/lib/...` needs this alias declared here too.

### `tests/support/stubs/server-only.ts`

```ts
export {};
```

An empty module — exactly what Next's own bundler substitutes it with. Every `import "server-only"` resolves here under Vitest and does nothing, matching production behavior (the check that package performs is bundler-time, not runtime).

### `tests/support/next-mocks.ts`

Vitest hoists `vi.mock(path, factory)` calls by statically scanning each test file for that exact call expression — a shared helper that calls `vi.mock` *inside itself* is invisible to that scan and would run too late (module imports, including the module under test, resolve before any of the test file's own code executes). So this file exports plain **factory-producing functions** instead, and every test file writes its own top-level `vi.mock(...)` call, passing in the imported factory:

```ts
import { vi } from "vitest";

// next/navigation: redirect/notFound throw a special error Next's own
// error boundary catches — tests instead assert on the thrown value's
// shape, matching how Next itself signals these from Server Actions.
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

// next/headers: cookies() and headers() return Promises in this Next
// version (the codebase already does `await cookies()` — see
// app/actions/auth.ts). The mock returns a minimal Map-backed fake
// supporting .get/.set/.delete (cookies) and .get (headers), since that's
// the full surface the codebase calls.
export function makeHeadersMock() {
  const store = new Map<string, { value: string }>();
  return {
    cookies: vi.fn(async () => ({
      get: (name: string) => store.get(name),
      set: (name: string, value: string) => store.set(name, { value }),
      delete: (name: string) => store.delete(name),
    })),
    headers: vi.fn(async () => new Map<string, string>()),
  };
}
```

A consuming test file uses it like this — the `vi.mock` call stays inline in the test file (required for hoisting to see it), the shared logic lives in the imported factory:

```ts
import { vi } from "vitest";
import { makeNavigationMock } from "@/tests/support/next-mocks";

vi.mock("next/navigation", () => makeNavigationMock());
```

This is safe because factory functions passed to `vi.mock` are invoked lazily (only once the mocked module is actually imported), and by then ES module imports — including `makeNavigationMock` itself — have already resolved. Only `vi.mock` calls to the AI-provider/Supabase/Appwrite modules follow the same inline-call, imported-factory pattern; `mockSupabaseServer`/`mockAppwriteServer`/`mockGemini` below are written the same way (they read as "helper calls `vi.mock`" for brevity, but every actual usage is the inline form).

### `tests/support/supabase-mock.ts`

A hand-rolled fake chainable query builder — every `lib/supabase/*.ts` function calls a chain like `.from("table").select("cols").eq("col", val).order("col").maybeSingle()`, terminating in either an awaited thenable or `.single()`/`.maybeSingle()`. The fake supports the exact chain methods actually used in this codebase (`from`, `select`, `insert`, `update`, `delete`, `eq`, `in`, `not`, `order`, `limit`, `single`, `maybeSingle`) and lets a test program the terminal `{ data, error }` result:

```ts
import { vi } from "vitest";

type Result = { data: unknown; error: unknown };

export function createFakeSupabaseClient(result: Result) {
  const chain: Record<string, unknown> = {};
  const methods = ["from", "select", "insert", "update", "delete", "eq", "in", "not", "order", "limit"];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  // A bare chain with no terminal call (e.g. `await supabase.from(...).select(...)`)
  // is itself awaited — make the chain thenable so that resolves too.
  chain.then = (resolve: (r: Result) => void) => resolve(result);
  return chain;
}

export function makeSupabaseServerMock(result: Result) {
  return { createServiceClient: () => createFakeSupabaseClient(result) };
}
```

Used the same inline way: `vi.mock("@/lib/supabase/server", () => makeSupabaseServerMock({ data, error: null }));` in the test file itself.

A test that needs different results across multiple calls in the same function (e.g. `saveSpecAction` does one `select` then one `update`) programs a queue instead of a single fixed result — that variant is added when sub-project 2 hits the first function needing it, not spelled out here speculatively.

### `tests/support/appwrite-mock.ts`

```ts
import { vi } from "vitest";

export function makeAppwriteServerMock(overrides: {
  users?: Partial<Record<string, unknown>>;
  account?: Partial<Record<string, unknown>>;
} = {}) {
  return {
    createServerUsers: () => ({
      create: vi.fn(),
      createSession: vi.fn(),
      ...overrides.users,
    }),
    createPublicAccount: () => ({
      createEmailPasswordSession: vi.fn(),
      ...overrides.account,
    }),
    createSessionClient: () => ({
      get: vi.fn(),
      deleteSession: vi.fn(),
      ...overrides.account,
    }),
  };
}
```

Used inline: `vi.mock("@/lib/appwrite/server", () => makeAppwriteServerMock({ users: { create: vi.fn(async () => ({ $id: "u1" })) } }));`

### `tests/support/ai-provider-mock.ts`

```ts
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

// Gemini uses the @google/genai SDK via a dynamic import, not fetch.
// mockProviderFetch above calls vi.stubGlobal directly (safe to call as a
// plain helper — fetch is read at call time, not import time, so no
// hoisting concern). This one mocks a real module import, so it follows
// the same factory pattern as the others: vi.mock("@google/genai", () =>
// makeGeminiMock("...")) inline in the test file.
export function makeGeminiMock(responseText: string) {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: { generateContent: vi.fn(async () => ({ text: responseText })) },
    })),
    Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", INTEGER: "INTEGER", BOOLEAN: "BOOLEAN" },
  };
}
```

### `tests/` folder

Created now as the home for every future test file, mirroring the source tree:

```
tests/
  support/
    stubs/server-only.ts
    next-mocks.ts
    supabase-mock.ts
    appwrite-mock.ts
    ai-provider-mock.ts
  lib/           (empty — sub-project 2 fills this in)
  actions/       (empty — sub-project 3 fills this in)
```

The 4 existing colocated tests (`lib/roles.test.ts`, `lib/lesson-sanitize.test.ts`, `lib/question-marking.test.ts`, `lib/ai/question-bank.test.ts`) stay where they are — moving them is unrelated churn, and Vitest's default include pattern already picks up both colocated and `tests/`-folder tests with no extra config.

### Verification for this sub-project

Since this sub-project ships no feature tests of its own, "done" means:

1. `npm test` still passes (the 4 existing colocated tests unaffected).
2. `npx vitest run --coverage` runs without error and produces a coverage report (even if coverage is near-zero until sub-project 2 exists).
3. One real (kept, not throwaway) test file — `tests/lib/supabase/profiles.test.ts` — that imports a `server-only`-using module (`lib/supabase/profiles.ts`), uses `makeSupabaseServerMock` via the inline `vi.mock` pattern above, and asserts a real function's behavior (e.g. `getProfileByAppwriteId` returning the mapped row, or `null` on a `maybeSingle` miss). This becomes the first entry of sub-project 2 rather than throwaway scaffolding — proving the mock chain works and starting real coverage in the same step.

## Out of scope for this spec

- Actually writing any `lib/` or `app/actions/` test (sub-projects 2–3).
- Playwright setup (sub-project 4).
- A coverage threshold/CI gate — added once real coverage exists to gate against, not before.
