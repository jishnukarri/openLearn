"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable. Silent no-op on
// browsers without SW support or over plain HTTP (Chrome requires HTTPS or
// localhost), never blocks or errors the page either way.
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
