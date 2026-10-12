import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "./rich-text";

const html = (text: string) => renderToStaticMarkup(<RichText text={text} />);

describe("RichText maths", () => {
  it("typesets dollar-delimited formulas", () => {
    const out = html("Propene ($C_3H_6$) burns");
    expect(out).toContain("katex");
    expect(out).not.toContain("$");
  });

  it("typesets bare subscripted formulas", () => {
    const out = html("Water is H_2O and carbon dioxide is CO_2");
    expect(out.match(/class="katex-inline"/g)?.length).toBe(2);
  });

  it("supports \\( \\) delimiters", () => {
    expect(html("Use \\(x^2\\) here")).toContain("katex");
  });

  it("leaves currency as plain text", () => {
    expect(html("It costs $5 and $10 each")).toBe("It costs $5 and $10 each");
  });

  it("leaves ordinary capitalised words alone", () => {
    expect(html("The ability to do work")).not.toContain("katex");
  });

  it("still renders bold and italic", () => {
    expect(html("**bold** and *it*")).toContain("<strong>bold</strong>");
  });
});
