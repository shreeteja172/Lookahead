"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleCheck, CircleX, Gauge, Info, Layers, TriangleAlert, X } from "lucide-react";
import { formatProduction, METHODS, tableStats, type ParserMethod } from "@/lib/engine";
import { useAnalysis, useStudio } from "@/lib/studio/store";
import { Badge, Panel, PanelHeader, Stat } from "@/components/ui/primitives";
import { NeedsGrammar, PageHeader } from "@/components/studio/page-header";
import { METHOD_META, ProductionText, Sym } from "@/components/studio/symbols";
import { NAV } from "@/components/studio/nav";
import { cn } from "@/lib/utils";

export function OverviewView() {
  const analysis = useAnalysis();
  const projectName = useStudio((s) => s.projectName);
  const diagnostics = useStudio((s) => s.result.parse.diagnostics);

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          <>
            Parser capability report for <span className="text-fg">{projectName}</span>. Every number here is computed from the generated
            automata and tables.
          </>
        }
      />
      {!analysis ? (
        <NeedsGrammar />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            {METHODS.map((m) => (
              <MethodCard key={m} m={m} />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <CapabilityReport />
            <GrammarSummary warnings={diagnostics.filter((d) => d.severity !== "error").length} />
          </div>
          <Modules />
        </div>
      )}
    </>
  );
}

function MethodCard({ m }: { m: ParserMethod }) {
  const analysis = useAnalysis()!;
  const t = analysis.tables[m];
  const s = tableStats(t);
  const meta = METHOD_META[m];
  return (
    <Panel className="relative overflow-hidden">
      <div className={cn("absolute inset-x-0 top-0 h-0.5", m === "SLR" ? "bg-slr" : m === "CLR" ? "bg-clr" : "bg-lalr")} />
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div>
          <div className={cn("text-lg font-semibold", meta.color)}>{meta.label}</div>
          <div className="text-xs text-fg-subtle">
            {meta.long} · {meta.automaton} automaton
          </div>
        </div>
        {s.conflictFree ? (
          <Badge tone="success">
            <Check /> conflict-free
          </Badge>
        ) : (
          <Badge tone="danger">
            <X /> {t.conflicts.length} conflict{t.conflicts.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-4 gap-3 px-4 py-4">
        <Stat label="States" value={s.states} />
        <Stat label="Action" value={s.actionEntries} />
        <Stat label="Goto" value={s.gotoEntries} />
        <Stat label="S/R · R/R" value={`${s.shiftReduce}·${s.reduceReduce}`} tone={s.conflictFree ? "default" : "danger"} />
      </div>
      <div className="flex gap-3 border-t border-border px-4 py-2.5 text-xs">
        <Link href="/tables" onClick={() => useStudio.getState().setMethod(m)} className="text-fg-muted hover:text-fg">
          Table →
        </Link>
        <Link href="/automaton" onClick={() => useStudio.getState().setMethod(m)} className="text-fg-muted hover:text-fg">
          Automaton →
        </Link>
        {!s.conflictFree && (
          <Link href="/conflicts" className="text-danger hover:underline">
            Diagnose →
          </Link>
        )}
      </div>
    </Panel>
  );
}

function CapabilityReport() {
  const a = useAnalysis()!;
  const free = (m: ParserMethod) => a.tables[m].conflicts.length === 0;
  const mergeInduced = a.diagnoses.filter((d) => d.conflict.method === "LALR" && d.introducedByMerge);
  const cls = free("SLR") ? "SLR" : free("LALR") ? "LALR" : free("CLR") ? "CLR" : "none";

  const verdicts: { label: string; ok: boolean; detail: string }[] = [
    {
      label: "SLR(1)",
      ok: free("SLR"),
      detail: free("SLR") ? "LR(0) automaton + FOLLOW sets produce a deterministic table." : `${a.tables.SLR.conflicts.length} conflicting cell(s) in the SLR table.`,
    },
    {
      label: "LALR(1)",
      ok: free("LALR"),
      detail: free("LALR")
        ? `Merging ${a.lr1.states.length} LR(1) states into ${a.lalr.states.length} kept the table deterministic.`
        : `${a.tables.LALR.conflicts.length} conflicting cell(s) after merging.`,
    },
    {
      label: "LR(1)",
      ok: free("CLR"),
      detail: free("CLR") ? `The canonical LR(1) table (${a.lr1.states.length} states) is deterministic.` : `${a.tables.CLR.conflicts.length} conflict(s) even with full LR(1) lookahead.`,
    },
  ];

  return (
    <Panel>
      <PanelHeader icon={<Gauge />} title="Grammar capability analyzer" description="Which constructions handle this grammar without conflicts" />
      <div className="grid gap-5 p-4 md:grid-cols-[1fr_220px]">
        <div className="space-y-2.5">
          {verdicts.map((v) => (
            <div key={v.label} className="flex items-start gap-2.5">
              {v.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-danger" />}
              <div className="text-sm">
                <span className="font-medium">
                  {v.ok ? "Conflict-free" : "Has conflicts"} under {v.label}
                </span>
                <div className="text-xs text-fg-muted">{v.detail}</div>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-2.5">
            {mergeInduced.length ? (
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            ) : (
              <Layers className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            )}
            <div className="text-sm">
              <span className="font-medium">
                {mergeInduced.length ? `LALR merging introduced ${mergeInduced.length} conflict(s)` : "LALR merging introduced no new conflicts"}
              </span>
              <div className="text-xs text-fg-muted">
                {mergeInduced.length
                  ? `In LALR state${mergeInduced.length > 1 ? "s" : ""} ${[...new Set(mergeInduced.map((d) => d.conflict.state))].join(", ")} — none of the merged CLR states conflicted on its own.`
                  : `${a.mergeGroups.filter((g) => g.clrStates.length > 1).length} groups of CLR states with identical cores were merged.`}
              </div>
            </div>
          </div>
          <p className="mt-3 flex gap-2 rounded-lg border border-border bg-panel-2 p-3 text-xs leading-relaxed text-fg-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              This classification comes from the tables generated by the implemented algorithms, not from heuristics. A conflict-free table
              proves the grammar is in that class, and LR(1) grammars are unambiguous. A conflict does <i>not</i> by itself prove ambiguity: the
              grammar may simply need more lookahead than the method provides.
            </span>
          </p>
        </div>
        <ClassDiagram cls={cls} />
      </div>
    </Panel>
  );
}

/** Nested grammar classes SLR(1) ⊂ LALR(1) ⊂ LR(1) with the grammar's position. */
function ClassDiagram({ cls }: { cls: "SLR" | "LALR" | "CLR" | "none" }) {
  const ring = (key: string, label: string, inset: number, color: string) => (
    <div
      className={cn("absolute rounded-xl border-2 transition-colors", cls === key ? "bg-highlight-bg" : "")}
      style={{ inset, borderColor: `var(--${color})` }}
    >
      <span className="absolute left-2 top-1 text-[0.625rem] font-semibold" style={{ color: `var(--${color})` }}>
        {label}
      </span>
    </div>
  );
  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-[220px] rounded-xl border border-dashed border-border-strong">
        <span className="absolute left-2 top-1 text-[0.625rem] text-fg-subtle">CFG</span>
        {ring("CLR", "LR(1)", 18, "clr")}
        {ring("LALR", "LALR(1)", 46, "lalr")}
        {ring("SLR", "SLR(1)", 74, "slr")}
        <div
          className="absolute size-3.5 -translate-x-1/2 rounded-full bg-accent pulse-ring"
          style={
            cls === "SLR"
              ? { left: "50%", top: "58%" }
              : cls === "LALR"
                ? { left: "50%", top: "calc(100% - 66px)" }
                : cls === "CLR"
                  ? { left: "50%", top: "calc(100% - 38px)" }
                  : { left: "50%", top: "calc(100% - 13px)" }
          }
          title="This grammar"
        />
      </div>
      <div className="mt-2 text-center text-xs text-fg-muted">
        {cls === "none" ? "Not LR(1): conflicts in every construction" : `Smallest class: ${cls === "CLR" ? "LR(1)" : `${cls}(1)`}`}
      </div>
    </div>
  );
}

function GrammarSummary({ warnings }: { warnings: number }) {
  const a = useAnalysis()!;
  const g = a.grammar;
  const nullableProds = a.nullableProductions.filter((id) => id !== 0);
  return (
    <Panel>
      <PanelHeader
        title="Grammar facts"
        description={`${g.productions.length - 1} productions · ${g.nonterminals.length - 1} nonterminals · ${g.terminals.length} terminals`}
        actions={warnings > 0 && <Badge tone="warning">{warnings} warning{warnings > 1 ? "s" : ""}</Badge>}
      />
      <dl className="grid gap-3 p-4 text-sm">
        <Row label="Start symbol">
          <Sym s={g.start} /> <span className="text-fg-subtle">(augmented: </span>
          <ProductionText p={g.productions[0]} className="text-xs" />
          <span className="text-fg-subtle">)</span>
        </Row>
        <Row label="Nullable">
          {[...a.ff.nullable].filter((n) => n !== g.augmentedStart).length ? (
            [...a.ff.nullable]
              .filter((n) => n !== g.augmentedStart)
              .map((n) => <Sym key={n} s={n} className="mr-2" />)
          ) : (
            <span className="text-fg-subtle">none</span>
          )}
        </Row>
        <Row label="Nullable productions">
          {nullableProds.length ? (
            <span className="flex flex-col">
              {nullableProds.map((id) => (
                <ProductionText key={id} p={g.productions[id]} numbered className="text-xs" />
              ))}
            </span>
          ) : (
            <span className="text-fg-subtle">none</span>
          )}
        </Row>
        <Row label="Unreachable">
          {a.unreachable.length || a.unreachableTerminals.length ? (
            [...a.unreachable, ...a.unreachableTerminals].map((n) => <Sym key={n} s={n} className="mr-2" />)
          ) : (
            <span className="text-fg-subtle">none</span>
          )}
        </Row>
        <Row label="Unproductive">
          {a.unproductive.length ? a.unproductive.map((n) => <Sym key={n} s={n} className="mr-2" />) : <span className="text-fg-subtle">none</span>}
        </Row>
        <Row label="Built in">
          <span className="font-mono text-xs text-fg-muted">
            {Object.values(a.timings)
              .reduce((x, y) => x + y, 0)
              .toFixed(1)}{" "}
            ms
          </span>
          <span className="ml-2 text-xs text-fg-subtle" title={Object.entries(a.timings).map(([k, v]) => `${k}: ${v.toFixed(2)} ms`).join("\n")}>
            (FIRST/FOLLOW, LR(0), LR(1), LALR, tables, conflicts)
          </span>
        </Row>
      </dl>
      <div className="border-t border-border px-4 py-3">
        <div className="font-medium mb-1.5 text-xs text-fg-muted">Productions</div>
        <div className="grid max-h-52 gap-0.5 overflow-y-auto">
          {g.productions.map((p) => (
            <ProductionText key={p.id} p={p} numbered className="text-[0.8125rem]" />
          ))}
        </div>
      </div>
      <span className="sr-only">{g.productions.map(formatProduction).join("; ")}</span>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-baseline gap-2">
      <dt className="text-xs text-fg-subtle">{label}</dt>
      <dd className="min-w-0 font-mono">{children}</dd>
    </div>
  );
}

function Modules() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {NAV.slice(1).map((n) => {
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            className="group flex items-start gap-3 rounded-xl border border-border bg-panel p-3.5 transition-colors hover:border-border-strong hover:bg-panel-2"
          >
            <Icon className="mt-0.5 size-4 text-accent" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{n.label}</div>
              <div className="text-xs text-fg-muted">{n.description}</div>
            </div>
            <ArrowRight className="size-4 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        );
      })}
    </div>
  );
}
