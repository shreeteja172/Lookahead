"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { Button, Kbd } from "@/components/ui/primitives";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "K"], label: "Search states, productions, table cells and pages" },
  { keys: ["Alt", "1 … 9"], label: "Jump to a module (Overview … Algorithm Explorer)" },
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
          {SITE.name} builds <b>SLR(1)</b>, <b>canonical LR(1)</b> and <b>LALR(1)</b> parsers from any context-free grammar you type,
          and shows every step of how they are constructed.
        </p>
        <p className="mt-2">
          Nothing is precomputed: every set, state, table cell and trace comes from the parsing engine running on your grammar.
        </p>
      </>
    ),
  },
  {
    title: "1 · Write a grammar",
    modules: ["/grammar"],
    body: (
      <>
        <p>
          One rule per line, <code className="font-mono text-terminal">A -&gt; α | β</code>, symbols separated by spaces, <code className="font-mono text-epsilon">ε</code> for
          empty. Symbols on the left of an arrow are nonterminals; everything else is a terminal.
        </p>
        <p className="mt-2">Errors and warnings point at the exact line. Or start from one of the verified sample grammars.</p>
      </>
    ),
  },
  {
    title: "2 · Inspect the construction",
    modules: ["/first-follow", "/automaton", "/tables"],
    body: (
      <p>
        FIRST/FOLLOW explains why each symbol is in each set. The automaton view renders the real item sets for LR(0), LR(1) and LALR(1).
        Click any table cell to see which item produced the action and why.
      </p>
    ),
  },
  {
    title: "3 · Parse some input",
    modules: ["/simulate", "/compare"],
    body: (
      <p>
        The simulator runs a table-driven shift-reduce parser with play/step controls, highlights the ACTION/GOTO entry it consults and
        builds the parse tree. The comparison lab runs the same input through all three parsers.
      </p>
    ),
  },
  {
    title: "4 · Understand conflicts",
    modules: ["/conflicts", "/algorithms"],
    body: (
      <p>
        The conflict analyzer shows the competing items, the lookahead involved, whether the conflict exists in SLR, CLR and/or LALR, and
        whether LALR state merging introduced it. The algorithm explorer replays every closure, GOTO, table insertion and merge.
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
    <Modal open={open} onClose={finish} className="max-w-xl">
      <div className="relative overflow-hidden">
        <div className="h-1 bg-panel-2">
          <motion.div className="h-full bg-accent" animate={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.15 }}
            className="px-6 pb-4 pt-6"
          >
            <div className="text-[11px] uppercase tracking-wider text-fg-subtle">
              Guided tour · {i + 1} / {STEPS.length}
            </div>
            <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
            <div className="mt-3 text-sm leading-relaxed text-fg-muted">{step.body}</div>
            {step.modules && (
              <div className="mt-4 flex flex-wrap gap-2">
                {step.modules.map((href) => {
                  const n = NAV.find((x) => x.href === href)!;
                  const Icon = n.icon;
                  return (
                    <span key={href} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel-2 px-2 py-1 text-xs">
                      <Icon className="size-3.5 text-accent" /> {n.label}
                    </span>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <div className="flex gap-1">
            {STEPS.map((_, k) => (
              <span key={k} className={cn("h-1.5 w-1.5 rounded-full", k === i ? "bg-accent" : "bg-border-strong")} />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={finish}>
              Skip
            </Button>
            {i > 0 && (
              <Button size="sm" onClick={() => setI(i - 1)}>
                <ChevronLeft /> Back
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => (i === STEPS.length - 1 ? finish() : setI(i + 1))}>
              {i === STEPS.length - 1 ? "Start exploring" : "Next"} <ArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
