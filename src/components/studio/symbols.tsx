"use client";

import * as React from "react";
import { END, EPS, type Action, type Grammar, type LRItem, type ParserMethod, type Production } from "@/lib/engine";
import { cn } from "@/lib/utils";

export const METHOD_META: Record<ParserMethod, { label: string; long: string; color: string; tone: "slr" | "clr" | "lalr"; automaton: string }> = {
  SLR: { label: "SLR(1)", long: "Simple LR", color: "text-fg", tone: "slr", automaton: "LR(0)" },
  CLR: { label: "CLR(1)", long: "Canonical LR", color: "text-fg", tone: "clr", automaton: "LR(1)" },
  LALR: { label: "LALR(1)", long: "Look-Ahead LR", color: "text-fg", tone: "lalr", automaton: "LALR(1)" },
};

const GrammarCtx = React.createContext<{ nonterminals: Set<string> } | null>(null);

export function GrammarProvider({ grammar, children }: { grammar: Grammar | null; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ nonterminals: new Set(grammar?.nonterminals ?? []) }), [grammar]);
  return <GrammarCtx.Provider value={value}>{children}</GrammarCtx.Provider>;
}

export function symbolClass(sym: string, nonterminals: Set<string>): string {
  if (sym === END) return "text-fg-subtle";
  if (sym === EPS) return "text-fg-subtle italic";
  return nonterminals.has(sym) ? "text-nonterminal" : "text-terminal";
}

/** A grammar symbol, coloured by kind. */
export function Sym({ s, className }: { s: string; className?: string }) {
  const ctx = React.useContext(GrammarCtx);
  return <span className={cn("font-mono", symbolClass(s, ctx?.nonterminals ?? new Set()), className)}>{s}</span>;
}

export function SymSeq({ symbols, className }: { symbols: string[]; className?: string }) {
  if (symbols.length === 0) return <Sym s={EPS} className={className} />;
  return (
    <span className={cn("font-mono", className)}>
      {symbols.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && " "}
          <Sym s={s} />
        </React.Fragment>
      ))}
    </span>
  );
}

export function SymSet({ symbols, highlight }: { symbols: string[]; highlight?: Set<string> }) {
  return (
    <span className="font-mono">
      <span className="text-fg-subtle">{"{ "}</span>
      {symbols.map((s, i) => (
        <React.Fragment key={s}>
          {i > 0 && <span className="text-fg-subtle">, </span>}
          <Sym s={s} className={cn(highlight?.has(s) && "rounded bg-accent/25 px-0.5 ring-1 ring-accent/60")} />
        </React.Fragment>
      ))}
      <span className="text-fg-subtle">{" }"}</span>
    </span>
  );
}

export function ProductionText({ p, numbered, className }: { p: Production; numbered?: boolean; className?: string }) {
  return (
    <span className={cn("font-mono text-sm", className)}>
      {numbered && <span className="mr-2 inline-block w-6 text-right text-fg-subtle tabular-nums">{p.id}</span>}
      <Sym s={p.lhs} />
      <span className="mx-1.5 text-fg-subtle">→</span>
      <SymSeq symbols={p.rhs} />
    </span>
  );
}

/** LR item with the dot and (optionally) its lookahead set. */
export function ItemText({
  grammar,
  item,
  showLookaheads = true,
  className,
  highlightLookahead,
}: {
  grammar: Grammar;
  item: LRItem;
  showLookaheads?: boolean;
  className?: string;
  highlightLookahead?: string;
}) {
  const p = grammar.productions[item.prod];
  const before = p.rhs.slice(0, item.dot);
  const after = p.rhs.slice(item.dot);
  return (
    <span className={cn("font-mono text-[0.8125rem] leading-6", className)}>
      <Sym s={p.lhs} />
      <span className="mx-1 text-fg-subtle">→</span>
      {before.map((s, i) => (
        <React.Fragment key={`b${i}`}>
          <Sym s={s} />{" "}
        </React.Fragment>
      ))}
      <span className="font-bold text-accent">•</span>
      {after.map((s, i) => (
        <React.Fragment key={`a${i}`}>
          {" "}
          <Sym s={s} />
        </React.Fragment>
      ))}
      {showLookaheads && item.lookaheads.length > 0 && (
        <span className="ml-2 text-fg-subtle">
          ,{" "}
          {item.lookaheads.map((l, i) => (
            <React.Fragment key={l}>
              {i > 0 && <span className="text-fg-subtle">/</span>}
              <Sym s={l} className={cn(highlightLookahead === l && "rounded bg-danger-bg px-0.5 ring-1 ring-danger/40")} />
            </React.Fragment>
          ))}
        </span>
      )}
    </span>
  );
}

export function actionText(a: Action): string {
  return a.type === "shift" ? `s${a.state}` : a.type === "reduce" ? `r${a.prod}` : "acc";
}

export function ActionChip({ a, className }: { a: Action; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono font-semibold",
        a.type === "shift" ? "text-fg" : a.type === "reduce" ? "text-reduce" : "text-success",
        className,
      )}
    >
      {actionText(a)}
    </span>
  );
}

export function MethodLabel({ m, className }: { m: ParserMethod; className?: string }) {
  return <span className={cn("font-semibold", METHOD_META[m].color, className)}>{METHOD_META[m].label}</span>;
}
