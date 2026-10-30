"use client";

import * as React from "react";
import { ArrowRight, CircleDot, Footprints, GitMerge, Plus, Repeat, Table2 } from "lucide-react";
import {
  coreKey,
  formatAction,
  type Analysis,
  type Automaton,
  type ClosureStep,
  type LRItem,
  type ParserMethod,
} from "@/lib/engine";
import { useAnalysis, useStudio } from "@/lib/studio/store";
import { Badge, Panel, PanelHeader, Segmented } from "@/components/ui/primitives";
import { NeedsGrammar, PageHeader } from "@/components/studio/page-header";
import { ItemText, METHOD_META, Sym } from "@/components/studio/symbols";
import { StepperControls, useStepper } from "@/components/studio/stepper";
import { cn } from "@/lib/utils";
import { FirstFollowReplay } from "./first-follow-view";
import { METHOD_OPTIONS } from "./automaton-view";

type Phase = "sets" | "lr0" | "lr1" | "table" | "merge";

export function AlgorithmsView() {
  const a = useAnalysis();
  const [phase, setPhase] = React.useState<Phase>("lr0");
  return (
    <>
      <PageHeader
        title="Step-through algorithms"
        description="Replay each construction one step at a time. Every step comes from the engine's own log of what it did and why."
        actions={
          <Segmented
            value={phase}
            onChange={setPhase}
            options={[
              { value: "sets", label: "FIRST/FOLLOW" },
              { value: "lr0", label: "LR(0) items" },
              { value: "lr1", label: "LR(1) items" },
              { value: "table", label: "Table filling" },
              { value: "merge", label: "LALR merge" },
            ]}
          />
        }
      />
      {!a ? (
        <NeedsGrammar />
      ) : phase === "sets" ? (
        <FirstFollowReplay />
      ) : phase === "lr0" ? (
        <CollectionReplay key="lr0" analysis={a} automaton={a.lr0} lr1={false} />
      ) : phase === "lr1" ? (
        <CollectionReplay key="lr1" analysis={a} automaton={a.lr1} lr1 />
      ) : phase === "table" ? (
        <TableReplay analysis={a} />
      ) : (
        <MergeReplay analysis={a} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Canonical collection                                                 */
/* ------------------------------------------------------------------ */

type CStep =
  | { kind: "create"; state: number; via?: { from: number; symbol: string }; kernel: LRItem[] }
  | { kind: "closure"; state: number; step: ClosureStep; n: number; of: number }
  | { kind: "existing"; from: number; symbol: string; to: number };

function flatten(automaton: Automaton): CStep[] {
  const out: CStep[] = [];
  for (const e of automaton.events) {
    if (e.type === "create") {
      out.push({ kind: "create", state: e.state, via: e.via, kernel: e.kernel });
      e.closure.forEach((step, n) => out.push({ kind: "closure", state: e.state, step, n, of: e.closure.length }));
    } else out.push({ kind: "existing", from: e.from, symbol: e.symbol, to: e.to });
  }
  return out;
}

function CollectionReplay({ analysis, automaton, lr1 }: { analysis: Analysis; automaton: Automaton; lr1: boolean }) {
  const g = analysis.grammar;
  const steps = React.useMemo(() => flatten(automaton), [automaton]);
  const s = useStepper(steps.length, { speedMs: 600 });
  const cur = steps[s.index];

  // State currently in focus and its items as built so far.
  const focusState = cur.kind === "existing" ? cur.to : cur.state;
  const built = React.useMemo(() => {
    const items = new Map<string, LRItem>();
    let createdAt = -1;
    for (let i = 0; i <= s.index; i++) {
      const st = steps[i];
      if (st.kind === "create" && st.state === focusState) {
        createdAt = i;
        st.kernel.forEach((k) => items.set(coreKey(k), { ...k }));
      } else if (st.kind === "closure" && st.state === focusState && createdAt !== -1) {
        items.set(coreKey(st.step.item), { ...st.step.item });
      }
    }
    if (createdAt === -1 || cur.kind === "existing") {
      // Existing state: show the finished state.
      return automaton.states[focusState].items;
    }
    return [...items.values()];
  }, [s.index, steps, focusState, automaton, cur.kind]);

  const created = React.useMemo(() => {
    const ids: number[] = [];
    const edges: { from: number; symbol: string; to: number }[] = [];
    for (let i = 0; i <= s.index; i++) {
      const st = steps[i];
      if (st.kind === "create") {
        ids.push(st.state);
        if (st.via) edges.push({ from: st.via.from, symbol: st.via.symbol, to: st.state });
      } else if (st.kind === "existing") edges.push(st);
    }
    return { ids, edges };
  }, [s.index, steps]);

  const newestKey = cur.kind === "closure" ? coreKey(cur.step.item) : null;
  const sourceKey = cur.kind === "closure" ? coreKey(built[cur.step.fromIndex] ?? { prod: -1, dot: -1 }) : null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <Panel className="px-4 py-3">
        <StepperControls s={s} />
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            icon={<CircleDot />}
            title={
              <>
                State <span className="font-mono text-fg">I{focusState}</span>
                {cur.kind === "closure" && (
                  <span className="ml-2 text-xs font-normal text-fg-muted">
                    closure step {cur.n + 1} / {cur.of}
                  </span>
                )}
              </>
            }
            description={lr1 ? "LR(1) items: [A → α • β, lookaheads]" : "LR(0) items: A → α • β"}
          />
          <div className="p-4">
            {built.map((it, i) => {
              const k = coreKey(it);
              return (
                <div
                  key={k}
                  className={cn(
                    "flex items-center gap-2 rounded px-2 transition-colors",
                    k === newestKey && "bg-highlight-bg ring-1 ring-accent/60",
                    k === sourceKey && "bg-panel-2 ring-1 ring-border-strong",
                  )}
                >
                  <span className="w-5 text-right font-mono text-[0.625rem] text-fg-subtle">{i}</span>
                  <ItemText grammar={g} item={it} showLookaheads={lr1} />
                  {it.kernel ? <Badge className="ml-auto">kernel</Badge> : k === newestKey ? <Badge tone="accent" className="ml-auto">new</Badge> : null}
                  {k === sourceKey && <Badge tone="lalr" className="ml-auto">source</Badge>}
                </div>
              );
            })}
          </div>
        </Panel>
        <div className="grid content-start gap-4">
          <Panel>
            <PanelHeader icon={<Footprints />} title="What happened" />
            <div className="p-4 text-sm">
              {cur.kind === "create" && (
                <>
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <Plus className="size-4 text-accent" /> New state I{cur.state}
                  </div>
                  <p className="text-xs text-fg-muted">
                    {cur.via ? (
                      <>
                        GOTO(I{cur.via.from}, <Sym s={cur.via.symbol} />) moves the dot over {cur.via.symbol} in every item of I{cur.via.from} that has{" "}
                        {cur.via.symbol} after the dot. The resulting kernel is not equal to any existing state&apos;s kernel
                        {lr1 ? " (including lookaheads)" : ""}, so a new state is created and its closure computed next.
                      </>
                    ) : (
                      <>The initial state is the closure of the augmented item{lr1 ? " with lookahead $" : ""}.</>
                    )}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {cur.kernel.map((k, i) => (
                      <div key={i}>
                        <ItemText grammar={g} item={k} showLookaheads={lr1} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {cur.kind === "closure" && (
                <>
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <ArrowRight className="size-4 text-accent" />
                    {cur.step.newLookaheads ? "Lookaheads propagated" : "Closure adds an item"}
                  </div>
                  <p className="text-xs leading-relaxed text-fg-muted">{cur.step.reason}</p>
                </>
              )}
              {cur.kind === "existing" && (
                <>
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <Repeat className="size-4 text-accent" /> Transition to an existing state
                  </div>
                  <p className="text-xs text-fg-muted">
                    GOTO(I{cur.from}, <Sym s={cur.symbol} />) produces a kernel identical to I{cur.to}&apos;s, so no new state is created — only the
                    transition I{cur.from} –{cur.symbol}→ I{cur.to} is recorded.
                  </p>
                </>
              )}
            </div>
          </Panel>
          <Panel>
            <PanelHeader title={`States so far (${created.ids.length} / ${automaton.states.length})`} description={`${created.edges.length} transitions recorded`} />
            <div className="flex flex-wrap gap-1.5 p-4">
              {created.ids.map((id) => (
                <span
                  key={id}
                  className={cn(
                    "rounded-md border px-2 py-0.5 font-mono text-xs",
                    id === focusState ? "border-accent bg-highlight-bg text-fg" : "border-border bg-panel-2 text-fg-muted",
                  )}
                >
                  I{id}
                </span>
              ))}
            </div>
            <div className="max-h-40 overflow-y-auto border-t border-border px-4 py-2 font-mono text-[0.6875rem] text-fg-muted">
              {created.edges
                .slice()
                .reverse()
                .map((e, i) => (
                  <div key={i} className={cn(i === 0 && "text-fg")}>
                    I{e.from} –<Sym s={e.symbol} />→ I{e.to}
                  </div>
                ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table insertion                                                      */
/* ------------------------------------------------------------------ */

function TableReplay({ analysis }: { analysis: Analysis }) {
  const method = useStudio((st) => st.method);
  const setMethod = useStudio((st) => st.setMethod);
  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <Segmented value={method} onChange={setMethod} options={METHOD_OPTIONS} />
      </div>
      <TableReplayInner key={method} analysis={analysis} method={method} />
    </div>
  );
}

function TableReplayInner({ analysis, method }: { analysis: Analysis; method: ParserMethod }) {
  const t = analysis.tables[method];
  const g = analysis.grammar;
  const ins = t.insertions;
  const s = useStepper(ins.length, { speedMs: 350 });
  const cur = ins[s.index];
  const rowRef = React.useRef<HTMLTableSectionElement>(null);

  const filled = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (let i = 0; i <= s.index; i++) {
      const x = ins[i];
      const key = `${x.state}|${x.symbol}`;
      const text = x.entry ? formatAction(x.entry.action) : String(x.gotoTarget);
      m.set(key, [...(m.get(key) ?? []), text]);
    }
    return m;
  }, [s.index, ins]);

  React.useEffect(() => {
    rowRef.current?.querySelector(`[data-row="${cur.state}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cur.state]);

  const st = t.automaton.states[cur.state];
  return (
    <>
      <Panel className="px-4 py-3">
        <StepperControls s={s} label={<>insertion {s.index + 1} / {ins.length}</>} />
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel className="max-h-[60vh] overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 font-mono text-[0.78125rem]">
            <thead className="sticky top-0 z-10 bg-panel-2">
              <tr>
                <th className="sticky left-0 border-b border-r border-border bg-panel-2 px-2 py-1 text-[0.6875rem] text-fg-subtle">I</th>
                {[...t.terminals, ...t.nonterminals].map((x) => (
                  <th key={x} className={cn("min-w-11 border-b border-border px-2 py-1", x === cur.symbol && "bg-accent/15")}>
                    <Sym s={x} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody ref={rowRef}>
              {t.automaton.states.map((row) => (
                <tr key={row.id} data-row={row.id} className={cn(row.id === cur.state && "bg-highlight-bg/50")}>
                  <td className="sticky left-0 border-b border-r border-border bg-panel px-2 py-0.5 text-right font-semibold text-fg">{row.id}</td>
                  {[...t.terminals, ...t.nonterminals].map((x) => {
                    const v = filled.get(`${row.id}|${x}`);
                    const now = row.id === cur.state && x === cur.symbol;
                    return (
                      <td
                        key={x}
                        className={cn(
                          "border-b border-border/60 px-2 py-0.5 text-center",
                          v && v.length > 1 && "bg-danger-bg text-danger",
                          now && "outline-2 -outline-offset-2 outline-accent",
                        )}
                      >
                        {v?.map((a, k) => (
                          <span
                            key={k}
                            className={cn(a.startsWith("s") ? "text-fg" : a.startsWith("r") ? "text-reduce" : a === "acc" ? "text-success" : "text-fg")}
                          >
                            {k > 0 && "/"}
                            {a}
                          </span>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel>
          <PanelHeader icon={<Table2 />} title="Why this entry" />
          <div className="space-y-3 p-4 text-sm">
            <div className="font-mono">
              {cur.entry ? "ACTION" : "GOTO"}[<span className="text-fg">{cur.state}</span>, <Sym s={cur.symbol} />] ={" "}
              <b>{cur.entry ? formatAction(cur.entry.action) : cur.gotoTarget}</b>
              {(filled.get(`${cur.state}|${cur.symbol}`)?.length ?? 0) > 1 && (
                <Badge tone="danger" className="ml-2">
                  conflict
                </Badge>
              )}
            </div>
            {cur.entry ? (
              <>
                <div className="rounded-md border border-border bg-panel-2/60 px-2 py-1">
                  <ItemText grammar={g} item={st.items[cur.entry.itemIndex]} showLookaheads={method !== "SLR"} highlightLookahead={cur.symbol} />
                </div>
                <p className="text-xs leading-relaxed text-fg-muted">{cur.entry.reason}</p>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-fg-muted">
                State {cur.state} has a transition on nonterminal <Sym s={cur.symbol} /> to state {cur.gotoTarget}; it is used after a reduction to{" "}
                {cur.symbol} exposes state {cur.state}.
              </p>
            )}
            <div className="text-[0.6875rem] text-fg-subtle">
              Rule ({METHOD_META[method].label}):{" "}
              {method === "SLR" ? "reduce items use FOLLOW(A)" : method === "CLR" ? "reduce items use their own LR(1) lookaheads" : "reduce items use lookaheads united across merged CLR states"}
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* LALR merging                                                         */
/* ------------------------------------------------------------------ */

function MergeReplay({ analysis }: { analysis: Analysis }) {
  const g = analysis.grammar;
  const groups = analysis.mergeGroups;
  // Start on the first core that actually merges several CLR states.
  const s = useStepper(groups.length, { speedMs: 1400, initial: Math.max(0, groups.findIndex((x) => x.clrStates.length > 1)) });
  const group = groups[s.index];
  const merged = analysis.lalr.states[group.lalrState];
  const conflicts = analysis.tables.LALR.conflicts.filter((c) => c.state === group.lalrState);
  const totalMerged = groups.filter((x) => x.clrStates.length > 1).length;

  return (
    <div className="grid grid-cols-1 gap-4">
      <Panel className="px-4 py-3">
        <StepperControls s={s} label={<>core {s.index + 1} / {groups.length}</>} />
      </Panel>
      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        <GitMerge className="size-4 text-accent" />
        {analysis.lr1.states.length} CLR states are partitioned into {groups.length} groups by LR(0) core; {totalMerged} group
        {totalMerged === 1 ? " has" : "s have"} more than one member.
        <div className="ml-auto flex flex-wrap gap-1">
          {groups.map((x, i) => (
            <button
              key={i}
              onClick={() => (s.pause(), s.go(i))}
              className={cn(
                "rounded border px-1.5 font-mono cursor-pointer",
                i === s.index ? "border-accent bg-highlight-bg text-fg" : x.clrStates.length > 1 ? "border-border-strong text-accent" : "border-border text-fg-subtle",
              )}
            >
              {x.clrStates.join("+")}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title={
              <>
                CLR state{group.clrStates.length > 1 ? "s" : ""} {group.clrStates.map((x) => `I${x}`).join(", ")}
              </>
            }
            description={group.clrStates.length > 1 ? "Same core, different lookaheads" : "Unique core — copied unchanged"}
          />
          <div className="grid gap-px bg-border" style={{ gridTemplateColumns: `repeat(${Math.min(group.clrStates.length, 3)}, minmax(0, 1fr))` }}>
            {group.clrStates.map((id) => (
              <div key={id} className="bg-panel p-3">
                <div className="mb-1 font-mono text-xs font-bold text-fg">CLR I{id}</div>
                {analysis.lr1.states[id].items.map((it, i) => (
                  <div key={i} className="whitespace-nowrap">
                    <ItemText grammar={g} item={it} className="text-[0.75rem]" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader
            icon={<GitMerge />}
            title={
              <>
                ⇒ LALR state <span className="font-mono text-accent">I{group.lalrState}</span>
              </>
            }
            description="Each item's lookahead set is the union over the merged states."
          />
          <div className="p-3">
            {merged.items.map((it, i) => {
              const origin = group.lookaheadOrigins[i];
              return (
                <div key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <ItemText grammar={g} item={it} className="text-[0.75rem]" />
                  {group.clrStates.length > 1 && (
                    <span className="font-mono text-[0.625rem] text-fg-subtle">
                      = {group.clrStates.map((c) => `{${origin.byState[c].join(",")}}`).join(" ∪ ")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t border-border px-4 py-3 text-xs">
            {conflicts.length === 0 ? (
              <span className="text-success">No conflict in the merged state.</span>
            ) : (
              <span className="text-danger">
                {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} in the merged state:{" "}
                {conflicts.map((c) => `${c.type} on ${c.terminal}`).join(", ")}
                {analysis.diagnoses.some((d) => d.conflict.method === "LALR" && d.conflict.state === group.lalrState && d.introducedByMerge) &&
                  " — introduced by this merge."}
              </span>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
