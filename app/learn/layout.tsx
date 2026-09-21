"use client";

import { useEffect } from "react";

// Hides the app navbar for the duration of any /learn route so the lesson
// takes the full screen. The class is cleaned up on unmount (route change).
export default function LearnLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("lesson-mode");
    return () => {
      document.body.classList.remove("lesson-mode");
    };
  }, []);

  return <>{children}</>;
}
