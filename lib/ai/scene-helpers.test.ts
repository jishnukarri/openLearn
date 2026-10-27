import { describe, expect, it } from "vitest";
import { describeCollisions } from "./scene-helpers";
import { buildRetryPrompt, buildScenePrompt, estimateSceneCostUsd, extractJson, SCENE_SYSTEM_PROMPT } from "./scene-helpers";

describe("scene helpers", () => {
  it("extracts plain, fenced and prose-wrapped json", () => {
    expect(extractJson('{"elements":[]}')).toEqual({ elements: [] });
    expect(extractJson('```json\n{"elements":[1]}\n```')).toEqual({ elements: [1] });
    expect(extractJson('Here: {"elements":[2]} done')).toEqual({ elements: [2] });
  });
  it("unwraps exampleScene", () => {
    expect(extractJson('{"exampleScene":{"elements":[3]}}')).toEqual({ elements: [3] });
  });
  it("throws on garbage", () => {
    expect(() => extractJson("nope")).toThrow();
  });
  it("builds prompts", () => {
    const p = buildScenePrompt({ heading: "H", explanation: "E", example: "X", subjectName: "Physics" });
    expect(p).toContain("Physics");
    expect(p).toContain("X");
    expect(SCENE_SYSTEM_PROMPT).toContain("exampleScene");
    expect(buildRetryPrompt("bad")).toContain("your previous reply failed validation: bad".replace("your", "Your"));
  });
  it("estimates cost", () => {
    expect(estimateSceneCostUsd(10)).toBeGreaterThan(0);
    expect(estimateSceneCostUsd(0)).toBe(0);
  });
});

describe("describeCollisions", () => {
  it("names both overlapping labels", () => {
    expect(describeCollisions([{ kind: "hard", a: "converging lens", b: "focal length = 10 cm" }])).toBe(
      'the labels "converging lens" and "focal length = 10 cm" overlap; move them apart or shorten them'
    );
  });
});
