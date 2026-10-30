"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "lookahead-collapsed-notes";

function readCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/**
 * A short explanation of the concept a page demonstrates. Teachers can
 * collapse it once the class has seen it; the choice is remembered per note.
 */
export function ConceptNote({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(() => !readCollapsed().has(id));
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      const set = readCollapsed();
      if (next) set.delete(id);
      else set.add(id);
      localStorage.setItem(KEY, JSON.stringify([...set]));
    } catch {}
  };
  return (
    <section className={cn("mb-6 rounded-lg border border-border bg-panel-2", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left cursor-pointer"
      >
        <span className="text-xs font-medium text-accent">Concept</span>
        <span className="text-sm font-medium text-fg">{title}</span>
        <ChevronDown className={cn("ml-auto size-4 text-fg-muted", open && "rotate-180")} />
      </button>
      {open && <div className="concept-body border-t border-border px-4 py-3 text-sm leading-relaxed text-fg-muted">{children}</div>}
    </section>
  );
}

/** Inline formula / notation, set in the mono face. */
export function Notation({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-panel px-1 py-px font-mono text-[0.8125rem] text-fg ring-1 ring-border">{children}</code>;
}
