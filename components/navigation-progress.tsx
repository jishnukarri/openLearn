"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type State = "idle" | "loading" | "complete";

export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<State>("idle");

  // When pathname changes the navigation finished, show the completion flash.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (state !== "idle") setState("complete");
  }

  useEffect(() => {
    if (state !== "complete") return;
    const t = setTimeout(() => setState("idle"), 400);
    return () => clearTimeout(t);
  }, [state]);

  // Intercept clicks on internal <a> tags to start the bar.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) return;
      if (anchor.getAttribute("target") === "_blank") return;
      // Only start if we're navigating away from the current path
      if (href !== pathname) {
        setState("loading");
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  if (state === "idle") return null;

  return <div className="nav-progress-bar" data-state={state} />;
}
