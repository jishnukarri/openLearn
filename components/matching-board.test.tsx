import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MatchingBoard } from "./matching-board";

const lefts = ["age", "name", "isStudent"];
// shuffled right-hand items; `index` is the pair each belongs to
const rights = [
  { label: "boolean", index: 2 },
  { label: "integer", index: 0 },
  { label: "string", index: 1 },
];
// What a reader sees: markup removed, spacing collapsed.
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const correctRightIndex = (left: number) => rights.findIndex((r) => r.index === left);

describe("MatchingBoard once marked", () => {
  it("lists the correct matches even when every pick was wrong", () => {
    // every left matched to the wrong right: age→boolean, name→integer, isStudent→string
    const html = renderToStaticMarkup(
      <MatchingBoard lefts={lefts} rights={rights} value={{ 0: 0, 1: 1, 2: 2 }} onChange={() => {}} revealed correctRightIndex={correctRightIndex} />
    );
    const seen = text(html);
    expect(seen).toContain("The correct matches");
    expect(seen).toContain("age → integer");
    expect(seen).toContain("name → string");
    expect(seen).toContain("isStudent → boolean");
    expect(seen).toContain("you matched it to boolean");
    expect(html).not.toContain("All matched correctly");
  });

  it("says so when everything was right", () => {
    const html = renderToStaticMarkup(
      <MatchingBoard lefts={lefts} rights={rights} value={{ 0: 1, 1: 2, 2: 0 }} onChange={() => {}} revealed correctRightIndex={correctRightIndex} />
    );
    expect(html).toContain("All matched correctly");
    expect(html).not.toContain("you matched it to");
  });

  it("shows no answer key while the student is still answering", () => {
    const html = renderToStaticMarkup(
      <MatchingBoard lefts={lefts} rights={rights} value={{}} onChange={() => {}} revealed={false} correctRightIndex={correctRightIndex} />
    );
    expect(html).not.toContain("The correct matches");
    expect(html).not.toContain("All matched correctly");
  });
});
