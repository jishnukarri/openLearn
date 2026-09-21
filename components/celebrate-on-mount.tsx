"use client";

import { useEffect } from "react";
import { celebrate } from "@/lib/confetti";

export function CelebrateOnMount({ when }: { when: boolean }) {
  useEffect(() => {
    if (when) celebrate();
  }, [when]);

  return null;
}
