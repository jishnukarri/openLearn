import { describe, expect, it } from "vitest";
import { threadWithDividers } from "./lesson-coach-thread";

const m = (step: number) => ({ step });
describe("threadWithDividers", () => {
  it("adds nothing for an empty thread", () => {
    expect(threadWithDividers([], 4)).toEqual([]);
  });
  it("adds a divider where the step changes, numbered for the new step", () => {
    const items = threadWithDividers([m(2), m(2), m(3)]);
    expect(items.map((i) => i.kind)).toEqual(["msg", "msg", "divider", "msg"]);
    expect(items[2]).toMatchObject({ kind: "divider", step: 3 });
  });
  it("adds a trailing divider when the student moved on without asking", () => {
    const items = threadWithDividers([m(2)], 3);
    expect(items.at(-1)).toMatchObject({ kind: "divider", step: 3 });
    expect(threadWithDividers([m(2)], 2)).toHaveLength(1);
  });
});
