"use client";

import * as React from "react";
import { ArrowRight, Footprints, ListChecks, Sigma } from "lucide-react";
import { END, EPS, formatProduction, sortSymbols, type SetStep } from "@/lib/engine";
import { useAnalysis } from "@/lib/studio/store";
import { Badge, Panel, PanelHeader, Segmented } from "@/components/ui/primitives";
import { NeedsGrammar, PageHeader } from "@/components/studio/page-header";
import { ProductionText, Sym, SymSet } from "@/components/studio/symbols";
import { StepperControls, useStepper } from "@/components/studio/stepper";
import { cn } from "@/lib/utils";

type Selection = { kind: "FIRST" | "FOLLOW" | "NULLABLE"; nt: string } | null;

export function FirstFollowView() {
  const a = useAnalysis();
  const [mode, setMode] = React.useState<"final" | "steps">("final");
  return (
    <>
      <PageHeader
        title="FIRST / FOLLOW"
        description="Computed by fixed-point iteration over the augmented grammar. Click any set to see exactly why each symbol is in it, or replay the algorithm step by step."
        actions={
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "final", label: "Final sets" },
              { value: "steps", label: "Step-by-step" },
            ]}
          />
        }
      />
      {!a ? <NeedsGrammar /> : mode === "final" ? <FinalSets /> : <FirstFollowReplay />}
    </>
  );
}

function FinalSets() {
  const a = useAnalysis()!;
  const g = a.grammar;
  const [sel, setSel] = React.useState<Selection>({ kind: "FOLLOW", nt: g.start });
  const justification = sel ? a.ff.steps.filter((s) => s.kind === sel.kind && s.target === sel.nt) : [];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Panel className="overflow-hidden">
        <PanelHeader
          icon={<Sigma />}
          title="Sets per nonterminal"
          description={`Converged after ${a.ff.passes.nullable} / ${a.ff.passes.first} / ${a.ff.passes.follow} passes (nullable / FIRST / FOLLOW).`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-fg-subtle">
                <th className="px-4 py-2 font-medium">Nonterminal</th>
                <th className="px-3 py-2 font-medium">Nullable</th>
                <th className="px-3 py-2 font-medium">FIRST</th>
                <th className="px-3 py-2 font-medium">FOLLOW</th>
              </tr>
            </thead>
            <tbody>
              {g.nonterminals.map((nt) => {
                const cell = (kind: "FIRST" | "FOLLOW" | "NULLABLE", content: React.ReactNode) => (
                  <td className="px-1.5 py-1">
                    <button
                      type="button"
                      onClick={() => setSel({ kind, nt })}
                      className={cn(
                        "w-full rounded-md px-2 py-1 text-left cursor-pointer transition-colors",
                        sel?.kind === kind && sel.nt === nt ? "bg-highlight-bg ring-1 ring-accent/50" : "hover:bg-panel-2",
                      )}
                    >
                      {content}
                    </button>
                  </td>
                );
                return (
                  <tr key={nt} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-1.5">
                      <Sym s={nt} className="font-semibold" />
                      {nt === g.augmentedStart && <span className="ml-2 text-[11px] text-fg-subtle">augmented</span>}
                    </td>
                    {cell(
                      "NULLABLE",
                      a.ff.nullable.has(nt) ? <Badge tone="info">yes</Badge> : <span className="text-xs text-fg-subtle">no</span>,
                    )}
                    {cell("FIRST", <SymSet symbols={sortSymbols(a.ff.first.get(nt)!, g.terminals)} />)}
                    {cell("FOLLOW", <SymSet symbols={sortSymbols(a.ff.follow.get(nt)!, g.terminals)} />)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-4 py-3 text-xs text-fg-muted">
          FIRST of a terminal is the terminal itself: {g.terminals.map((t) => (
            <span key={t} className="mr-2 font-mono">
              FIRST(<Sym s={t} />) = {"{"}
              <Sym s={t} />
              {"}"}
            </span>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          icon={<ListChecks />}
          title={
            sel ? (
              <>
                Why: {sel.kind === "NULLABLE" ? "nullable" : sel.kind}(<Sym s={sel.nt} />)
              </>
            ) : (
              "Derivation"
            )
          }
          description="Every addition, in the order the algorithm made it."
        />
        <div className="max-h-[560px] overflow-y-auto p-3">
          {justification.length === 0 ? (
            <div className="p-4 text-center text-sm text-fg-muted">
              {sel?.kind === "NULLABLE" ? (
                <>
                  <Sym s={sel.nt} /> is not nullable: no production for it has an all-nullable body.
                </>
              ) : (
                "This set is empty — no production contributes to it."
              )}
            </div>
          ) : (
            <ol className="space-y-2">
              {justification.map((s) => (
                <StepCard key={s.index} step={s} />
              ))}
            </ol>
          )}
        </div>
      </Panel>
    </div>
  );
}

function StepCard({ step, active }: { step: SetStep; active?: boolean }) {
  const a = useAnalysis()!;
  const p = a.grammar.productions[step.productionId];
  return (
    <li className={cn("rounded-lg border p-3", active ? "border-accent/60 bg-highlight-bg" : "border-border bg-panel-2/50")}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={step.kind === "FIRST" ? "accent" : step.kind === "FOLLOW" ? "lalr" : "info"}>{step.kind}</Badge>
        <span className="font-mono">
          <Sym s={step.target} />
        </span>
        <ArrowRight className="size-3 text-fg-subtle" />
        <span>
          adds <SymSet symbols={step.added} />
        </span>
        <span className="ml-auto text-fg-subtle">pass {step.pass}</span>
      </div>
      <div className="mt-1.5 text-xs text-fg-muted">{step.reason}</div>
      {step.productionId !== 0 || step.kind !== "FOLLOW" ? (
        <div className="mt-1.5">
          <ProductionText p={p} numbered className="text-xs" />
        </div>
      ) : null}
    </li>
  );
}

export function FirstFollowReplay() {
  const a = useAnalysis()!;
  const g = a.grammar;
  const steps = a.ff.steps;
  const s = useStepper(steps.length + 1, { speedMs: 900 });
  // Index 0 = initial state (all empty); index k = after step k-1.
  const current = s.index > 0 ? steps[s.index - 1] : null;

  const sets = React.useMemo(() => {
    const nullable = new Set<string>();
    const first = new Map(g.nonterminals.map((n) => [n, new Set<string>()]));
    const follow = new Map(g.nonterminals.map((n) => [n, new Set<string>()]));
    for (const st of steps.slice(0, s.index)) {
      if (st.kind === "NULLABLE") nullable.add(st.target);
      if (st.kind === "FIRST") st.added.forEach((x) => first.get(st.target)!.add(x));
      if (st.kind === "FOLLOW") st.added.forEach((x) => follow.get(st.target)!.add(x));
    }
    return { nullable, first, follow };
  }, [steps, s.index, g.nonterminals]);

  const phase = current?.kind ?? "NULLABLE";
  const sourceSymbols = new Set<string>();
  if (current?.source.type === "first") current.source.symbols.forEach((x) => sourceSymbols.add(x));
  if (current?.source.type === "follow") sourceSymbols.add(current.source.symbol);

  return (
    <div className="grid grid-cols-1 gap-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <StepperControls s={s} label={<>step {s.index} / {steps.length}</>} />
        </div>
        <div className="flex items-center gap-1 border-t border-border px-4 py-2 text-xs">
          {(["NULLABLE", "FIRST", "FOLLOW"] as const).map((k, i) => (
            <React.Fragment key={k}>
              {i > 0 && <ArrowRight className="size-3 text-fg-subtle" />}
              <span className={cn("rounded px-2 py-0.5", phase === k ? "bg-accent/20 text-accent" : "text-fg-subtle")}>
                {k === "NULLABLE" ? "1. Nullable" : k === "FIRST" ? "2. FIRST" : "3. FOLLOW"}
              </span>
            </React.Fragment>
          ))}
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-fg-subtle">
                <th className="px-4 py-2 font-medium">Nonterminal</th>
                <th className="px-3 py-2 font-medium">Nullable</th>
                <th className="px-3 py-2 font-medium">FIRST</th>
                <th className="px-3 py-2 font-medium">FOLLOW</th>
              </tr>
            </thead>
            <tbody>
              {g.nonterminals.map((nt) => {
                const isTarget = current?.target === nt;
                const isSource = sourceSymbols.has(nt);
                const hl = (k: SetStep["kind"]) => (isTarget && current?.kind === k ? new Set(current.added) : undefined);
                return (
                  <tr
                    key={nt}
                    className={cn("border-b border-border/60 last:border-0 transition-colors", isTarget && "bg-highlight-bg", isSource && !isTarget && "bg-lalr/5")}
                  >
                    <td className="px-4 py-2">
                      <Sym s={nt} className="font-semibold" />
                      {isSource && !isTarget && <span className="ml-2 text-[10px] text-lalr">source</span>}
                    </td>
                    <td className="px-3 py-2">
                      {sets.nullable.has(nt) ? (
                        <Badge tone="info" className={cn(isTarget && current?.kind === "NULLABLE" && "ring-1 ring-accent")}>
                          yes
                        </Badge>
                      ) : (
                        <span className="text-xs text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <SymSet symbols={sortSymbols(sets.first.get(nt)!, g.terminals)} highlight={hl("FIRST")} />
                    </td>
                    <td className="px-3 py-2">
                      <SymSet symbols={sortSymbols(sets.follow.get(nt)!, g.terminals)} highlight={hl("FOLLOW")} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
        <Panel>
          <PanelHeader icon={<Footprints />} title="What changed and why" />
          <div className="p-3">
            {current ? (
              <ol>
                <StepCard step={current} active />
              </ol>
            ) : (
              <div className="space-y-2 p-2 text-sm text-fg-muted">
                <p>All sets start empty. The algorithm then makes three fixed-point passes:</p>
                <ol className="list-decimal space-y-1 pl-5 text-xs">
                  <li>
                    <b>Nullable</b>: A is nullable if some A → X₁…Xₙ has every Xᵢ nullable (or n = 0).
                  </li>
                  <li>
                    <b>FIRST</b>: for A → X₁…Xₙ add FIRST(Xᵢ) ∖ {"{"}
                    <span className="text-epsilon">{EPS}</span>
                    {"}"} while X₁…Xᵢ₋₁ are nullable; add {EPS} if all are.
                  </li>
                  <li>
                    <b>FOLLOW</b>: <span className="font-mono text-end">{END}</span> ∈ FOLLOW(S′); for A → αBβ add FIRST(β) ∖ {"{"}
                    {EPS}
                    {"}"} to FOLLOW(B), and FOLLOW(A) if β is nullable.
                  </li>
                </ol>
                <p className="text-xs">Each pass repeats until nothing changes. Press → to start.</p>
              </div>
            )}
          </div>
          {current && (
            <div className="border-t border-border px-4 py-3 text-xs text-fg-muted">
              Production {current.productionId}: <span className="font-mono">{formatProduction(g.productions[current.productionId])}</span>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
