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

  it("prefixes ids so they cannot clobber page elements", () => {
    const out = sanitizeLessonSvg(
      '<svg viewBox="0 0 1 1"><defs><marker id="arrow" markerWidth="1" markerHeight="1" refX="0" refY="0" orient="auto"></marker></defs><line x1="0" y1="0" x2="1" y2="1" marker-end="url(#arrow)"></line><g id="__next"></g></svg>'
    );
    expect(out).toContain('id="lv-arrow"');
    expect(out).toContain('marker-end="url(#lv-arrow)"');
    expect(out).not.toContain('id="__next"');
  });

  it("drops marker references to external documents", () => {
    const out = sanitizeLessonSvg(
      '<svg viewBox="0 0 1 1"><line x1="0" y1="0" x2="1" y2="1" marker-end="url(https://evil.example/x.svg#m)"></line></svg>'
    );
    expect(out).not.toContain("evil.example");
    expect(out).not.toContain("marker-end");
  });

  it("is idempotent across the save and load passes", () => {
    const once = sanitizeLessonSvg(
      '<svg viewBox="0 0 1 1"><defs><marker id="a" markerWidth="1" markerHeight="1" refX="0" refY="0" orient="auto"></marker></defs><line x1="0" y1="0" x2="1" y2="1" marker-end="url(#a)"></line></svg>'
    );
    expect(sanitizeLessonSvg(once)).toBe(once);
  });
});
