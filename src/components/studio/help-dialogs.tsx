"use client";

import * as React from "react";
import { Modal } from "@/components/ui/overlay";
import { Button, Kbd } from "@/components/ui/primitives";
import { SITE } from "@/lib/site";
import { NAV } from "./nav";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "K"], label: "Search states, productions, table cells and pages" },
  { keys: ["Alt", "1 … 9"], label: "Jump to a page in sidebar order" },
  { keys: ["?"], label: "Show this shortcut list" },
  { keys: ["→", "←"], label: "Simulator / explorer: next and previous step" },
  { keys: ["Space"], label: "Simulator / explorer: play or pause" },
  { keys: ["Home", "End"], label: "Simulator / explorer: first and last step" },
  { keys: ["Ctrl", "Enter"], label: "Grammar editor: re-run analysis immediately" },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts">
      <ul className="divide-y divide-border px-4 py-2">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="text-fg-muted">{s.label}</span>
            <span className="flex shrink-0 gap-1">
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

const STEPS: { title: string; body: React.ReactNode; modules?: string[] }[] = [
  {
    title: `Welcome to ${SITE.name}`,
    body: (
      <>
        <p>
          {SITE.name} builds <b>SLR(1)</b>, <b>canonical LR(1)</b> and <b>LALR(1)</b> parsers from a context-free grammar and shows how each
          one is constructed.
        </p>
        <p className="mt-2">Every set, state, table entry and trace is computed from the grammar you enter — nothing is precomputed.</p>
      </>
    ),
  },
  {
    title: "Follow the numbered steps",
    modules: ["/grammar", "/first-follow", "/automaton", "/tables", "/simulate"],
    body: (
      <p>
        The sidebar lists the five steps of building an LR parser in teaching order: write the grammar, compute FIRST and FOLLOW, build the
        item-set automaton, fill the parsing table, then parse an input. Each page starts with a short note on the concept it shows.
      </p>
    ),
  },
  {
    title: "Explain why, not just what",
    modules: ["/compare", "/conflicts", "/algorithms"],
    body: (
      <p>
        Click any set member or table cell to see the rule that produced it. The analysis pages compare the three methods, explain each
        conflict, and replay every algorithm one step at a time.
      </p>
    ),
  },
  {
    title: "Presenting to a class",
    modules: ["/learn"],
    body: (
      <p>
        Use the text-size button in the top bar (Projector) for classroom screens, and the Concepts guide for a structured explanation of
        CFGs and LR parsing that uses the grammar currently loaded as its example.
      </p>
    ),
  },
];

export function Tutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = React.useState(0);
  const step = STEPS[i];
  const finish = () => {
    setI(0);
    onClose();
  };
  return (
    <Modal open={open} onClose={finish} className="max-w-lg">
      <div className="px-6 pb-5 pt-6">
        <div className="text-xs text-fg-muted">
          {i + 1} of {STEPS.length}
        </div>
        <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
        <div className="mt-3 text-sm leading-relaxed text-fg-muted">{step.body}</div>
        {step.modules && (
          <ul className="mt-4 space-y-1 text-sm">
            {step.modules.map((href) => {
              const n = NAV.find((x) => x.href === href)!;
              return (
                <li key={href} className="flex items-baseline gap-2">
                  <span className="w-4 text-right font-mono text-xs text-fg-muted">{n.step ?? "·"}</span>
                  <span className="font-medium">{n.label}</span>
                  <span className="text-xs text-fg-muted">— {n.description}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
        <Button variant="ghost" size="sm" onClick={finish} className="mr-auto">
          Skip tour
        </Button>
        {i > 0 && (
          <Button size="sm" onClick={() => setI(i - 1)}>
            Back
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={() => (i === STEPS.length - 1 ? finish() : setI(i + 1))}>
          {i === STEPS.length - 1 ? "Done" : "Next"}
        </Button>
      </div>
    </Modal>
  );
}
