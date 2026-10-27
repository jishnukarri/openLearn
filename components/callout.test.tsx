import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Info } from "lucide-react";
import { Callout } from "./callout";

describe("Callout", () => {
  it("defaults to a status region with ink text", () => {
    const out = renderToStaticMarkup(<Callout tone="success">Done</Callout>);
    expect(out).toContain('role="status"');
    expect(out).toContain("text-success-ink");
  });

  it("supports alert and no role, title, icon and action", () => {
    const alert = renderToStaticMarkup(<Callout tone="error" role="alert">Bad</Callout>);
    expect(alert).toContain('role="alert"');
    const plain = renderToStaticMarkup(
      <Callout role="none" live="polite" icon={Info} title="T" action={<button>Go</button>}>x</Callout>,
    );
    expect(plain).not.toContain("role=");
    expect(plain).toContain('aria-live="polite"');
    expect(plain).toContain("<svg");
    expect(plain).toContain(">T<");
    expect(plain).toContain("<button>Go</button>");
  });
});
