import { describe, expect, it } from "vitest";
import { sanitizeLessonHtml, sanitizeLessonSvg } from "./lesson-sanitize";

describe("sanitizeLessonHtml", () => {
  it("keeps allowed structural markup", () => {
    const html =
      "<table><thead><tr><th>A</th></tr></thead><tbody><tr><td><strong>1</strong></td></tr></tbody></table>";
    expect(sanitizeLessonHtml(html)).toBe(html);
  });

  it("strips scripts, iframes, imgs and event handlers", () => {
    expect(
      sanitizeLessonHtml(
        '<p onclick="x()">hi<script>evil()</script><iframe src="x"></iframe><img src="x"></p>'
      )
    ).toBe("<p>hi</p>");
  });

  it("strips style and class attributes", () => {
    expect(sanitizeLessonHtml('<p style="color:red" class="x">hi</p>')).toBe(
      "<p>hi</p>"
    );
  });

  it("returns empty string when nothing safe remains", () => {
    expect(sanitizeLessonHtml("<script>x</script>")).toBe("");
  });
});

describe("sanitizeLessonSvg", () => {
  it("keeps themed svg", () => {
    const svg =
      '<svg viewBox="0 0 100 50"><circle cx="10" cy="10" r="5" fill="var(--color-primary)"></circle><text x="1" y="1">hi</text></svg>';
    expect(sanitizeLessonSvg(svg)).toBe(svg);
  });

  it("drops raw-color fills but keeps the element", () => {
    expect(
      sanitizeLessonSvg(
        '<svg viewBox="0 0 1 1"><rect width="1" height="1" fill="#ff0000" stroke="currentColor"></rect></svg>'
      )
    ).toBe(
      '<svg viewBox="0 0 1 1"><rect width="1" height="1" stroke="currentColor"></rect></svg>'
    );
  });

  it("strips script/foreignObject/handlers/style/class", () => {
    expect(
      sanitizeLessonSvg(
        '<svg viewBox="0 0 1 1" onload="x()" class="a"><foreignObject>x</foreignObject><path d="M0 0" style="fill:red"></path></svg>'
      )
    ).toBe('<svg viewBox="0 0 1 1"><path d="M0 0"></path></svg>');
  });

  it("returns empty string for non-svg input", () => {
    expect(sanitizeLessonSvg("<p>hi</p>")).toBe("");
  });
});
