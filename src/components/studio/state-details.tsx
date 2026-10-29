"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, GitMerge, TriangleAlert } from "lucide-react";
import type { Analysis, ParserMethod } from "@/lib/engine";
import { Badge } from "@/components/ui/primitives";
import { ActionChip, ItemText, Sym } from "./symbols";
import { cn } from "@/lib/utils";

/** Full description of one parser state: items, transitions, actions, merge origin. */
export function StateDetails({
  analysis,
  method,
  stateId,
  onSelect,
  highlightItems,
}: {
  analysis: Analysis;
  method: ParserMethod;
  stateId: number;
  onSelect?: (id: number) => void;
  highlightItems?: Set<number>;
}) {
  const g = analysis.grammar;
  const table = analysis.tables[method];
  const st = table.automaton.states[stateId];
  if (!st) return null;
  const showLA = method !== "SLR";
  const kernel = st.items.map((it, i) => ({ it, i })).filter((x) => x.it.kernel);
  const closure = st.items.map((it, i) => ({ it, i })).filter((x) => !x.it.kernel);
  const incoming = table.automaton.transitions.filter((t) => t.to === stateId);
  const conflicts = table.conflicts.filter((c) => c.state === stateId);
  const group = method === "LALR" ? analysis.mergeGroups[stateId] : null;

  const Link = ({ id }: { id: number }) => (
    <button
      type="button"
      onClick={() => onSelect?.(id)}
      className="rounded px-1 font-mono font-semibold text-state hover:bg-panel-2 cursor-pointer"
    >
      I{id}
    </button>
  );

  const itemRow = ({ it, i }: { it: (typeof st.items)[number]; i: number }) => (
    <div
      key={i}
      className={cn(
        "flex items-center gap-2 rounded px-1.5",
        highlightItems?.has(i) && "bg-conflict-bg ring-1 ring-conflict/40",
      )}
    >
      <span className="w-5 shrink-0 text-right font-mono text-[10px] text-fg-subtle">{i}</span>
      <ItemText grammar={g} item={it} showLookaheads={showLA} />
    </div>
  );

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-lg font-bold text-state">I{stateId}</span>
        {stateId === 0 && <Badge tone="accent">initial</Badge>}
        {st.items.some((i) => i.prod === 0 && i.dot === 1) && <Badge tone="success">accepting</Badge>}
        {conflicts.length > 0 && (
          <Badge tone="danger">
            <TriangleAlert /> {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""}
          </Badge>
        )}
        <span className="ml-auto text-xs text-fg-subtle">{st.items.length} items</span>
      </div>

      {group && group.clrStates.length > 1 && (
        <div className="rounded-lg border border-lalr/30 bg-lalr/5 p-2.5 text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-lalr">
            <GitMerge className="size-3.5" /> Merged from CLR states {group.clrStates.join(", ")}
          </div>
          <div className="text-fg-muted">These canonical LR(1) states share the same LR(0) core; their lookahead sets were united.</div>
        </div>
      )}

      <section>
        <h4 className="mb-1 text-[11px] uppercase tracking-wider text-fg-subtle">Kernel items</h4>
        {kernel.map(itemRow)}
      </section>
      {closure.length > 0 && (
        <section>
          <h4 className="mb-1 text-[11px] uppercase tracking-wider text-fg-subtle">Closure items</h4>
          {closure.map(itemRow)}
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <div>
          <h4 className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wider text-fg-subtle">
            <ArrowRight className="size-3" /> GOTO out
          </h4>
          {st.transitions.size === 0 && <div className="text-xs text-fg-subtle">none</div>}
          {[...st.transitions].map(([sym, to]) => (
            <div key={sym} className="flex items-center gap-1.5 text-xs">
              <Sym s={sym} /> <span className="text-fg-subtle">→</span> <Link id={to} />
            </div>
          ))}
        </div>
        <div>
          <h4 className="mb-1 flex items-center gap-1 text-[11px] uppercase tracking-wider text-fg-subtle">
            <ArrowLeft className="size-3" /> Reached from
          </h4>
          {incoming.length === 0 && <div className="text-xs text-fg-subtle">start state</div>}
          {incoming.map((t) => (
            <div key={`${t.from}-${t.symbol}`} className="flex items-center gap-1.5 text-xs">
              <Link id={t.from} /> <span className="text-fg-subtle">on</span> <Sym s={t.symbol} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="mb-1 text-[11px] uppercase tracking-wider text-fg-subtle">{method} ACTION row</h4>
        <div className="flex flex-wrap gap-1.5">
          {table.terminals
            .filter((t) => table.action[stateId].has(t))
            .map((t) => {
              const es = table.action[stateId].get(t)!;
              return (
                <span
                  key={t}
                  className={cn(
                    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs",
                    es.length > 1 ? "border-conflict/50 bg-conflict-bg" : "border-border bg-panel-2",
                  )}
                >
                  <Sym s={t} />:
                  {es.map((e, k) => (
                    <React.Fragment key={k}>
                      {k > 0 && <span className="text-conflict">/</span>}
                      <ActionChip a={e.action} />
                    </React.Fragment>
                  ))}
                </span>
              );
            })}
          {table.action[stateId].size === 0 && <span className="text-xs text-fg-subtle">no actions (error on every terminal)</span>}
        </div>
      </section>
    </div>
  );
}
