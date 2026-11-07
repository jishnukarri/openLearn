import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LessonCompletedCard } from "./lesson-completed-card";

describe("LessonCompletedCard", () => {
  const html = renderToStaticMarkup(
    <LessonCompletedCard title="Hypotheses" practiceHref="/practice/t1" redoHref="/learn/t1?redo=1" />
  );

  it("tells the student the lesson is done, in the success colour", () => {
    expect(html).toContain("Lesson completed");
    expect(html).toContain("Hypotheses");
    expect(html).toContain("border-success");
    expect(html).toContain("bg-success/10");
  });

  it("offers the exam questions first and the redo second", () => {
    expect(html).toContain('href="/practice/t1"');
    expect(html).toContain("Go to exam questions");
    expect(html).toContain('href="/learn/t1?redo=1"');
    expect(html.indexOf("Go to exam questions")).toBeLessThan(html.indexOf("Redo the lesson"));
  });

  it("animates the tick and keeps decorative parts out of the accessibility tree", () => {
    expect(html).toContain("animate-draw-check");
    expect(html).toContain("animate-pop-in");
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });
});
