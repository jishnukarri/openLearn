import { describe, expect, it } from "vitest";
import { sanitizeLessonHtml, sanitizeLessonSvg, normaliseSvg } from "./lesson-sanitize";

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
      '<svg viewBox="0 0 100 50"><circle cx="10" cy="10" r="5" fill="var(--color-primary)"></circle><text x="1" y="30">hi</text></svg>';
    expect(sanitizeLessonSvg(svg)).toBe(svg.replace("<text ", '<text fill="currentColor" '));
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

describe("svg normalisation", () => {
  const vbOf = (svg: string) => /viewBox="([^"]*)"/.exec(svg)![1].split(" ").map(Number);

  it("gives fill-less text currentColor and keeps explicit fills", () => {
    const out = sanitizeLessonSvg(
      '<svg viewBox="0 0 400 240"><text x="10" y="20">A</text><text x="10" y="40" fill="var(--color-primary)">B</text></svg>'
    );
    expect(out).toContain('<text fill="currentColor" x="10"');
    expect(out).toContain('fill="var(--color-primary)"');
  });

  it("grows the viewBox for labels running past the right edge", () => {
    const out = sanitizeLessonSvg(
      '<svg viewBox="0 0 400 240"><text x="300" y="20" font-size="14">Electric field lines around a positive charge</text></svg>'
    );
    expect(vbOf(out)[2]).toBeGreaterThan(400);
  });

  it("accounts for text-anchor middle/end on the left edge", () => {
    const out = sanitizeLessonSvg(
      '<svg viewBox="0 0 100 50"><text x="10" y="20" text-anchor="end" font-size="12">a long label here</text></svg>'
    );
    expect(vbOf(out)[0]).toBeLessThan(0);
  });

  it("drops fixed width/height, adds a viewBox when missing, and is idempotent", () => {
    const once = sanitizeLessonSvg('<svg width="300" height="150"><circle cx="5" cy="5" r="2"/></svg>');
    expect(once).not.toMatch(/\swidth=/);
    expect(vbOf(once)).toEqual([0, 0, 300, 150]);
    expect(normaliseSvg(once)).toBe(once);
  });
});
