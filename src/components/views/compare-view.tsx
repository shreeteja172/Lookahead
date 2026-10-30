"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, GitCompare, Info, OctagonAlert, Rows3, Scale } from "lucide-react";
import {
  compareParsers,
  formatAction,
  METHODS,
  tokenizeInput,
  type CellDiff,
  type ParserMethod,
  type SimResult,
} from "@/lib/engine";
import { useAnalysis, useStudio } from "@/lib/studio/store";
import { Badge, Input, Panel, PanelHeader, Segmented } from "@/components/ui/primitives";
import { NeedsGrammar, PageHeader } from "@/components/studio/page-header";
import { METHOD_META, MethodLabel, Sym } from "@/components/studio/symbols";
import { cn } from "@/lib/utils";

export function CompareView() {
  const a = useAnalysis();
  const input = useStudio((s) => s.input);
  const setInput = useStudio((s) => s.setInput);
  const policy = useStudio((s) => s.policy);
  const tok = React.useMemo(() => (a ? tokenizeInput(input, a.grammar.terminals) : null), [a, input]);
  const cmp = React.useMemo(() => (a && tok ? compareParsers(a, tok.errors.length ? null : tok.tokens, policy) : null), [a, tok, policy]);

  if (!a || !cmp || !tok) {
    return (
      <>
        <PageHeader title="Compare parsers" />
        <NeedsGrammar />
      </>
    );
  }
  const maxStates = Math.max(...METHODS.map((m) => cmp.stats[m].states));

  return (
    <>
      <PageHeader
        title="Compare parsers"
        description="The same grammar and the same input, run through all three constructions. Each parser executes against its own generated table."
      />
      <div className="mb-4 flex gap-2 rounded-xl border border-border bg-panel p-3 text-xs text-fg-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" />
        <p>
          Two different questions: <b className="text-fg">is the grammar conflict-free</b> under a method (a property of the table, independent of any input),
          and <b className="text-fg">is this particular input accepted</b> by the resulting parser. A parser with conflicts can still accept inputs that never
          reach a conflicting cell; a conflict-free parser rejects every string outside the language.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Panel>
          <PanelHeader icon={<Scale />} title="Grammar level — table construction" />
          <div className="grid gap-px overflow-hidden bg-border md:grid-cols-3">
            {METHODS.map((m) => {
              const s = cmp.stats[m];
              return (
                <div key={m} className="bg-panel p-4">
                  <div className="flex items-center justify-between">
                    <MethodLabel m={m} className="text-base" />
                    {s.conflictFree ? (
                      <Badge tone="success">
                        <CircleCheck /> conflict-free
                      </Badge>
                    ) : (
                      <Badge tone="danger">
                        <CircleX /> not {METHOD_META[m].label}
                      </Badge>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-fg-subtle">States</dt>
                    <dd className="font-mono">{s.states}</dd>
                    <dt className="text-fg-subtle">ACTION entries</dt>
                    <dd className="font-mono">{s.actionEntries}</dd>
                    <dt className="text-fg-subtle">GOTO entries</dt>
                    <dd className="font-mono">{s.gotoEntries}</dd>
                    <dt className="text-fg-subtle">Shift-reduce</dt>
                    <dd className={cn("font-mono", s.shiftReduce && "text-danger")}>{s.shiftReduce}</dd>
                    <dt className="text-fg-subtle">Reduce-reduce</dt>
                    <dd className={cn("font-mono", s.reduceReduce && "text-danger")}>{s.reduceReduce}</dd>
                  </dl>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-panel-2" title="State count relative to the largest automaton">
                    <div className="h-full rounded-full bg-fg-subtle" style={{ width: `${(s.states / maxStates) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            icon={<Rows3 />}
            title="Input level — parsing traces"
            actions={
              <Input value={input} onChange={(e) => setInput(e.target.value)} className="w-full font-mono sm:w-72" placeholder="input tokens" spellCheck={false} />
            }
          />
          {tok.errors.length ? (
            <div className="p-4 text-sm text-danger">{tok.errors[0].message}</div>
          ) : (
            cmp.sims && cmp.trace && <TraceComparison sims={cmp.sims} firstDivergence={cmp.trace.firstDivergence} consumed={cmp.trace.consumed} total={tok.tokens.length} />
          )}
        </Panel>

        <TableDiffs slrVsLalr={cmp.slrVsLalr} clrVsLalr={cmp.clrVsLalr} />
      </div>
    </>
  );
}

function TraceComparison({
  sims,
  firstDivergence,
  consumed,
  total,
}: {
  sims: Record<ParserMethod, SimResult>;
  firstDivergence: number | null;
  consumed: Record<ParserMethod, number>;
  total: number;
}) {
  const rows = Math.max(...METHODS.map((m) => sims[m].steps.length));
  return (
    <>
      <div className="grid gap-px bg-border md:grid-cols-3">
        {METHODS.map((m) => {
          const r = sims[m];
          const ok = r.outcome === "accepted";
          return (
            <div key={m} className="bg-panel p-3">
              <div className="flex items-center gap-2">
                <MethodLabel m={m} />
                <span className={cn("flex items-center gap-1 text-sm font-medium", ok ? "text-success" : "text-danger")}>
                  {ok ? <CircleCheck className="size-4" /> : r.outcome === "conflict" ? <OctagonAlert className="size-4" /> : <CircleX className="size-4" />}
                  {r.outcome}
                </span>
              </div>
              <div className="mt-1 text-xs text-fg-muted">
                {r.steps.length} steps · consumed {Math.min(consumed[m], total)} / {total} tokens
              </div>
              <p className="mt-1 text-xs text-fg-subtle">{r.message}</p>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border px-4 py-2 text-xs text-fg-muted">
        {firstDivergence === null ? (
          "All three parsers perform exactly the same sequence of shifts and reductions on this input (state numbers aside)."
        ) : (
          <>
            The traces first differ at <b className="text-fg">step {firstDivergence + 1}</b> (highlighted). {divergenceReason(sims)}
          </>
        )}
      </div>
      <div className="max-h-[420px] overflow-auto border-t border-border">
        <table className="w-full border-separate border-spacing-0 font-mono text-[0.75rem]">
          <thead className="sticky top-0 bg-panel-2 text-left text-[0.6875rem] text-fg-subtle">
            <tr>
              <th className="border-b border-border px-3 py-1.5 font-sans font-medium">#</th>
              {METHODS.map((m) => (
                <th key={m} className="border-b border-border px-3 py-1.5 font-sans font-medium">
                  <MethodLabel m={m} /> <span className="font-normal">state · lookahead → action</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => (
              <tr key={i} className={cn(i === firstDivergence && "bg-warning-bg")}>
                <td className="border-b border-border/60 px-3 py-1 text-fg-subtle">{i + 1}</td>
                {METHODS.map((m) => {
                  const s = sims[m].steps[i];
                  return (
                    <td key={m} className="border-b border-border/60 px-3 py-1 whitespace-nowrap">
                      {s ? (
                        <>
                          <span className="text-fg">{s.actionCell.state}</span> · <Sym s={s.actionCell.terminal} /> →{" "}
                          <span
                            className={cn(
                              s.kind === "shift" ? "text-fg" : s.kind === "reduce" ? "text-reduce" : s.kind === "accept" ? "text-success" : "text-danger",
                            )}
                          >
                            {s.actions.length ? s.actions.map(formatAction).join("/") : "error"}
                          </span>
                        </>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TableDiffs({ slrVsLalr, clrVsLalr }: { slrVsLalr: CellDiff[]; clrVsLalr: CellDiff[] }) {
  const [which, setWhich] = React.useState<"slr" | "clr">("slr");
  const reveal = useStudio((s) => s.reveal);
  const router = useRouter();
  const diffs = which === "slr" ? slrVsLalr : clrVsLalr;
  const left: ParserMethod = which === "slr" ? "SLR" : "CLR";
  const go = (method: ParserMethod, state: number, symbol: string) => {
    reveal({ method, state, symbol });
    router.push("/tables");
  };
  return (
    <Panel>
      <PanelHeader
        icon={<GitCompare />}
        title="Table differences"
        description={
          which === "slr"
            ? "SLR and LALR share the LR(0) cores, so states correspond one-to-one; they differ only in where reductions are placed (FOLLOW sets vs. propagated lookaheads)."
            : "Every CLR state maps to the LALR state that absorbed it. Shift targets are translated into LALR numbering before comparing."
        }
        actions={
          <Segmented
            size="sm"
            value={which}
            onChange={setWhich}
            options={[
              { value: "slr", label: `SLR ↔ LALR (${slrVsLalr.length})` },
              { value: "clr", label: `CLR ↔ LALR (${clrVsLalr.length})` },
            ]}
          />
        }
      />
      {diffs.length === 0 ? (
        <div className="p-6 text-center text-sm text-fg-muted">
          No differences: the {left} and LALR tables are identical{which === "clr" ? " after renumbering" : ""}.
        </div>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full border-separate border-spacing-0 font-mono text-[0.78125rem]">
            <thead className="sticky top-0 bg-panel-2 text-left text-[0.6875rem] text-fg-subtle">
              <tr>
                <th className="border-b border-border px-3 py-1.5 font-sans font-medium">{left} state</th>
                <th className="border-b border-border px-3 py-1.5 font-sans font-medium">LALR state</th>
                <th className="border-b border-border px-3 py-1.5 font-sans font-medium">Lookahead</th>
                <th className="border-b border-border px-3 py-1.5 font-sans font-medium">{left}</th>
                <th className="border-b border-border px-3 py-1.5 font-sans font-medium">LALR</th>
                <th className="border-b border-border px-3 py-1.5 font-sans font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map((d, i) => (
                <tr key={i} className="hover:bg-panel-2">
                  <td className="border-b border-border/60 px-3 py-1">
                    <button className="text-fg hover:underline cursor-pointer" onClick={() => go(left, d.leftState, d.symbol)}>
                      {d.leftState}
                    </button>
                  </td>
                  <td className="border-b border-border/60 px-3 py-1">
                    <button className="text-fg hover:underline cursor-pointer" onClick={() => go("LALR", d.rightState, d.symbol)}>
                      {d.rightState}
                    </button>
                  </td>
                  <td className="border-b border-border/60 px-3 py-1">
                    <Sym s={d.symbol} />
                  </td>
                  <td className={cn("border-b border-border/60 px-3 py-1", d.left.length > 1 && "text-danger")}>{d.left.join("/") || "—"}</td>
                  <td className={cn("border-b border-border/60 px-3 py-1", d.right.length > 1 && "text-danger")}>{d.right.join("/") || "—"}</td>
                  <td className="border-b border-border/60 px-3 py-1 font-sans text-xs text-fg-muted">{explainDiff(d, left)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function divergenceReason(sims: Record<ParserMethod, SimResult>): string {
  const stuck = METHODS.filter((m) => sims[m].outcome === "conflict");
  if (stuck.length) {
    const ok = METHODS.filter((m) => sims[m].outcome !== "conflict");
    return `${stuck.join(" and ")} reached a conflicting ACTION cell${ok.length ? `, while ${ok.join(" and ")} had a single action there` : ""}.`;
  }
  if (METHODS.every((m) => sims[m].outcome === "rejected")) {
    return "All three reject the input, but CLR detects the error as soon as it is visible, while SLR/LALR may perform extra reductions first (none of them ever shifts an erroneous token).";
  }
  return "The parsers reach different outcomes on this input.";
}

function explainDiff(d: CellDiff, left: ParserMethod): string {
  const extra = d.left.filter((x) => !d.right.includes(x));
  const missing = d.right.filter((x) => !d.left.includes(x));
  if (left === "SLR") {
    if (extra.length && !missing.length) return `SLR adds ${extra.join(", ")} because the lookahead is in FOLLOW, though it cannot follow in this state.`;
    return "Placement of reductions differs.";
  }
  if (!d.left.length) return `Error in CLR; LALR inherits ${missing.join(", ")} from a merged sibling state (error detected later).`;
  if (missing.length && d.right.length > 1) return "Merging united lookaheads and created a conflict here.";
  return "Lookahead sets were united by merging.";
}
