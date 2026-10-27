import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));

let stored: Record<string, unknown> = { type: "numeric", answer: "5" };
vi.mock("./database-client", () => ({
  db: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            const snapshot = { ...stored };
            await new Promise((r) => setTimeout(r, 5)); // slow read widens the race
            return { data: { format: snapshot }, error: null };
          },
        }),
      }),
      update: (v: { format: Record<string, unknown> }) => ({
        eq: async () => {
          stored = v.format;
          return { error: null };
        },
      }),
    }),
  },
}));

import { mergeQuestionFormat } from "./questions";

describe("mergeQuestionFormat", () => {
  it("concurrent merges keep each other's keys", async () => {
    await Promise.all([
      mergeQuestionFormat("q1", { hints: ["a", "b", "c"] }),
      mergeQuestionFormat("q1", { remediation: { type: "explain" } }),
    ]);
    expect(stored).toMatchObject({ type: "numeric", answer: "5", hints: ["a", "b", "c"], remediation: { type: "explain" } });
  });
});
