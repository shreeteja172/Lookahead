"use client";

import * as React from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/** Shared step-through state with keyboard support (←/→, space, Home/End). */
export function useStepper(total: number, opts: { initial?: number; speedMs?: number } = {}) {
  const [index, setIndex] = React.useState(opts.initial ?? 0);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(opts.speedMs ?? 700);
  const last = Math.max(0, total - 1);
  const clamped = Math.min(index, last);

  React.useEffect(() => {
    if (!playing) return;
    if (clamped >= last) {
      const t = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, last)), speed);
    return () => clearTimeout(t);
  }, [playing, clamped, last, speed]);

  const api = React.useMemo(
    () => ({
      index: clamped,
      total,
      playing,
      speed,
      setSpeed,
      go: (i: number) => setIndex(Math.max(0, Math.min(i, last))),
      next: () => setIndex((i) => Math.min(Math.min(i, last) + 1, last)),
      prev: () => setIndex((i) => Math.max(Math.min(i, last) - 1, 0)),
      first: () => {
        setPlaying(false);
        setIndex(0);
      },
      end: () => {
        setPlaying(false);
        setIndex(last);
      },
      toggle: () => {
        if (clamped >= last) setIndex(0);
        setPlaying((p) => !p);
      },
      pause: () => setPlaying(false),
    }),
    [clamped, total, playing, speed, last],
  );

  const ref = React.useRef(api);
  React.useEffect(() => {
    ref.current = api;
  }, [api]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const a = ref.current;
      const handlers: Record<string, () => void> = {
        ArrowRight: () => {
          a.pause();
          a.next();
        },
        ArrowLeft: () => {
          a.pause();
          a.prev();
        },
        " ": a.toggle,
        Home: a.first,
        End: a.end,
      };
      const h = handlers[e.key];
      if (h) {
        e.preventDefault();
        h();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return api;
}

export type Stepper = ReturnType<typeof useStepper>;

export function StepperControls({ s, label, showSpeed = true }: { s: Stepper; label?: React.ReactNode; showSpeed?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-panel-2 p-0.5">
        <Button variant="ghost" size="icon-sm" onClick={s.first} title="First step (Home)" aria-label="First step">
          <SkipBack />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => (s.pause(), s.prev())} title="Previous step (←)" aria-label="Previous step">
          <StepBack />
        </Button>
        <Button variant="primary" size="icon-sm" onClick={s.toggle} title="Play / pause (Space)" aria-label={s.playing ? "Pause" : "Play"}>
          {s.playing ? <Pause /> : <Play />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => (s.pause(), s.next())} title="Next step (→)" aria-label="Next step">
          <StepForward />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={s.end} title="Last step (End)" aria-label="Last step">
          <SkipForward />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={s.first} title="Reset" aria-label="Reset">
          <RotateCcw />
        </Button>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, s.total - 1)}
        value={s.index}
        onChange={(e) => (s.pause(), s.go(Number(e.target.value)))}
        className="h-1 w-32 cursor-pointer accent-[var(--accent)] sm:w-48"
        aria-label="Step"
      />
      <span className="font-mono text-xs tabular-nums text-fg-muted">
        {label ?? (
          <>
            step {s.total ? s.index + 1 : 0} / {s.total}
          </>
        )}
      </span>
      {showSpeed && (
        <label className="ml-auto flex items-center gap-1.5 text-xs text-fg-subtle">
          speed
          <input
            type="range"
            min={100}
            max={1600}
            step={100}
            value={1700 - s.speed}
            onChange={(e) => s.setSpeed(1700 - Number(e.target.value))}
            className="h-1 w-20 cursor-pointer accent-[var(--accent)]"
            aria-label="Playback speed"
          />
        </label>
      )}
    </div>
  );
}
