"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Minus, X } from "lucide-react";
import { METHODS, simulate, sortSymbols, tableStats, tokenizeInput, type Analysis, type ParserMethod } from "@/lib/engine";
import { useAnalysis, useStudio } from "@/lib/studio/store";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { NeedsGrammar, PageHeader } from "@/components/studio/page-header";
import { METHOD_META, ProductionText, Sym, SymSet } from "@/components/studio/symbols";
import { NAV, NAV_GROUPS } from "@/components/studio/nav";
import { cn } from "@/lib/utils";

export function OverviewView() {
  const analysis = useAnalysis();
  const projectName = useStudio((s) => s.projectName);

  return (
    <>
      <PageHeader
        title={projectName}
        description="Build an LR parser for this grammar in five steps, or jump to the comparison and conflict analysis. Every result below is computed from the grammar."
        actions={
          <Link href="/grammar">
            <Button>Edit grammar</Button>
          </Link>
        }
      />
      {!analysis ? (
        <NeedsGrammar />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="grid content-start gap-6">
            <GrammarCard a={analysis} />
            <Classification a={analysis} />
          </div>
          <LearningPath a={analysis} />
        </div>
      )}
    </>
  );
}

function GrammarCard({ a }: { a: Analysis }) {
  const g = a.grammar;
  const nullable = [...a.ff.nullable].filter((n) => n !== g.augmentedStart);
  const issues = [...a.unreachable, ...a.unproductive];
  return (
    <Panel>
      <PanelHeader
        title="Grammar"
        description={`${g.productions.length - 1} productions · ${g.nonterminals.length - 1} nonterminals · ${g.terminals.length} terminals · start symbol ${g.start}`}
      />
      <div className="grid gap-1 px-4 py-3">
        {g.productions.slice(1).map((p) => (
          <ProductionText key={p.id} p={p} numbered className="text-[0.9375rem]" />
        ))}
      </div>
      <dl className="grid gap-2 border-t border-border px-4 py-3 text-sm">
        <Fact label="Terminals">
          {g.terminals.map((t) => (
            <Sym key={t} s={t} className="mr-2" />
          ))}
        </Fact>
        <Fact label="Nonterminals">
          {g.nonterminals.slice(1).map((n) => (
            <Sym key={n} s={n} className="mr-2" />
          ))}
        </Fact>
        <Fact label="Nullable">{nullable.length ? nullable.map((n) => <Sym key={n} s={n} className="mr-2" />) : <span className="text-fg-muted">none</span>}</Fact>
        {issues.length > 0 && (
          <Fact label="Useless symbols">
            <span className="text-warning">
              {a.unreachable.length > 0 && <>unreachable: {a.unreachable.join(", ")} </>}
              {a.unproductive.length > 0 && <>non-generating: {a.unproductive.join(", ")}</>}
            </span>
          </Fact>
        )}
      </dl>
    </Panel>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0 font-mono">{children}</dd>
    </div>
  );
}

const ORDER: { m: ParserMethod; name: string }[] = [
  { m: "SLR", name: "SLR(1)" },
  { m: "LALR", name: "LALR(1)" },
  { m: "CLR", name: "Canonical LR(1)" },
];

function verdict(free: Record<ParserMethod, boolean>): string {
  if (free.SLR) return "This grammar is SLR(1), so it is also LALR(1) and LR(1). All three parsers work.";
  if (free.LALR) return "This grammar is LALR(1) but not SLR(1): FOLLOW sets are too coarse for SLR, while propagated lookaheads are precise enough.";
  if (free.CLR) return "This grammar is LR(1) but not LALR(1): merging LR(1) states with equal cores creates conflicts.";
  return "This grammar is not LR(1): every construction has conflicts. It may be ambiguous, or need more than one token of lookahead.";
}

function Classification({ a }: { a: Analysis }) {
  const free = Object.fromEntries(METHODS.map((m) => [m, a.tables[m].conflicts.length === 0])) as Record<ParserMethod, boolean>;
  const mergeInduced = a.diagnoses.filter((d) => d.conflict.method === "LALR" && d.introducedByMerge).length;
  return (
    <Panel>
      <PanelHeader title="Which parsers can handle it?" />
      <p className="px-4 pt-3 text-[0.9375rem] leading-relaxed">{verdict(free)}</p>
      <div className="overflow-x-auto px-4 py-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-fg-muted">
              <th className="py-1.5 pr-3 font-medium">Method</th>
              <th className="py-1.5 pr-3 font-medium">Automaton</th>
              <th className="py-1.5 pr-3 text-right font-medium">States</th>
              <th className="py-1.5 pr-3 text-right font-medium">Conflicts</th>
              <th className="py-1.5 font-medium">Deterministic</th>
            </tr>
          </thead>
          <tbody>
            {ORDER.map(({ m, name }) => {
              const s = tableStats(a.tables[m]);
              return (
                <tr key={m} className="border-b border-border/70 last:border-0">
                  <td className="py-2 pr-3 font-medium">{name}</td>
                  <td className="py-2 pr-3 text-fg-muted">{METHOD_META[m].automaton} items</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{s.states}</td>
                  <td className={cn("py-2 pr-3 text-right font-mono tabular-nums", !s.conflictFree && "text-danger")}>
                    {s.conflictFree ? 0 : `${s.shiftReduce} S/R, ${s.reduceReduce} R/R`}
                  </td>
                  <td className="py-2">
                    {s.conflictFree ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <Check className="size-4" /> yes
                      </span>
                    ) : (
                      <Link href="/conflicts" className="inline-flex items-center gap-1 text-danger hover:underline">
                        <X className="size-4" /> no — see why
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-1.5 border-t border-border px-4 py-3 text-xs leading-relaxed text-fg-muted">
        <p>
          Every SLR(1) grammar is LALR(1), and every LALR(1) grammar is LR(1). LALR merges the {a.lr1.states.length} canonical LR(1) states into{" "}
          {a.lalr.states.length}
          {mergeInduced > 0 ? `, which introduced ${mergeInduced} conflict${mergeInduced > 1 ? "s" : ""} here.` : "."}
        </p>
        <p>
          A conflict-free table proves the grammar belongs to that class. A conflict does not by itself prove the grammar is ambiguous — it may
          need more lookahead than the method provides.
        </p>
      </div>
    </Panel>
  );
}

function LearningPath({ a }: { a: Analysis }) {
  const input = useStudio((s) => s.input);
  const method = useStudio((s) => s.method);
  const g = a.grammar;
  const steps = NAV.filter((n) => n.step);

  const run = React.useMemo(() => {
    const tok = tokenizeInput(input, g.terminals);
    if (tok.errors.length) return { text: tok.errors[0].message, ok: false };
    const r = simulate(g, a.tables[method], tok.tokens);
    return { text: `“${input.trim() || "ε"}” is ${r.outcome} by the ${METHOD_META[method].label} parser (${r.steps.length} steps).`, ok: r.outcome === "accepted" };
  }, [input, method, g, a]);

  const results: Record<number, React.ReactNode> = {
    1: `${g.productions.length - 1} productions, augmented with ${g.augmentedStart} → ${g.start} as production 0.`,
    2: (
      <>
        FOLLOW(<Sym s={g.start} />) = <SymSet symbols={sortSymbols(a.ff.follow.get(g.start)!, g.terminals)} />
      </>
    ),
    3: `${a.lr0.states.length} LR(0) states, ${a.lr1.states.length} LR(1) states, ${a.lalr.states.length} LALR(1) states.`,
    4: METHODS.every((m) => a.tables[m].conflicts.length === 0)
      ? "All three tables are conflict-free."
      : `Conflicts — SLR: ${a.tables.SLR.conflicts.length}, LALR: ${a.tables.LALR.conflicts.length}, CLR: ${a.tables.CLR.conflicts.length}.`,
    5: run.text,
  };
  const learn: Record<number, string> = {
    1: "Terminals, nonterminals, productions and the augmented start symbol.",
    2: "Which terminals can begin, and which can follow, each nonterminal.",
    3: "LR items, CLOSURE and GOTO — the states a parser can be in.",
    4: "How shift, reduce and accept entries are derived from the items.",
    5: "The stack-based shift-reduce loop and the parse tree it builds.",
  };

  return (
    <Panel>
      <PanelHeader title="Building the parser, step by step" description="Each step uses the result of the one before it." />
      <ol>
        {steps.map((n, i) => (
          <li key={n.href} className={cn("relative flex gap-4 px-4 py-4", i > 0 && "border-t border-border")}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong font-mono text-sm">{n.step}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[0.9375rem] font-semibold">{n.label}</h3>
                <Link href={n.href} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                  Open <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <p className="text-sm text-fg-muted">{learn[n.step!]}</p>
              <p className={cn("mt-1.5 text-sm", n.step === 5 && !run.ok && "text-danger")}>
                <Minus className="mr-1 inline size-3 text-fg-subtle" />
                {results[n.step!]}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-border px-4 py-4">
        <h3 className="mb-2 text-sm font-semibold">Go further</h3>
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {[...NAV_GROUPS[0].items.slice(1), ...NAV_GROUPS[2].items].map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="text-accent hover:underline">
                {n.label}
              </Link>
              <span className="text-fg-muted"> — {n.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
