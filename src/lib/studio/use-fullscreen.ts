"use client";

import * as React from "react";

/**
 * Full-screen toggle for one element. Uses the Fullscreen API when the browser
 * allows it, otherwise falls back to a fixed overlay that covers the window.
 * Escape leaves either mode.
 */
export function useFullscreen<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [native, setNative] = React.useState(false);
  const [overlay, setOverlay] = React.useState(false);

  React.useEffect(() => {
    const onChange = () => setNative(!!ref.current && document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  React.useEffect(() => {
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOverlay(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay]);

  const toggle = React.useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    if (overlay) {
      setOverlay(false);
      return;
    }
    const el = ref.current;
    if (el?.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // Not allowed (e.g. inside an iframe): use the overlay instead.
      }
    }
    setOverlay(true);
  }, [overlay]);

  return { ref, active: native || overlay, overlay, toggle };
}
