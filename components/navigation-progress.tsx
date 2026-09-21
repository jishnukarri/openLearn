"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type State = "idle" | "loading" | "complete";

export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<State>("idle");
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When pathname changes the navigation finished, show the completion flash.
  useEffect(() => {
    if (state === "idle") return; // first render, don't flash
    setState("complete");
    if (completeTimer.current) clearTimeout(completeTimer.current);
    completeTimer.current = setTimeout(() => setState("idle"), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
        if (completeTimer.current) clearTimeout(completeTimer.current);
        setState("loading");
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  if (state === "idle") return null;

  return <div className="nav-progress-bar" data-state={state} />;
}
