"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, GitMerge, Lightbulb, Network, Table2, TriangleAlert } from "lucide-react";
import { METHODS, type ConflictDiagnosis, type ParserMethod } from "@/lib/engine";
import { useAnalysis, useStudio } from "@/lib/studio/store";
import { Badge, Button, EmptyState, Panel, Segmented } from "@/components/ui/primitives";
import { NeedsGrammar, PageHeader } from "@/components/studio/page-header";
import { ActionChip, ItemText, METHOD_META, MethodLabel, Sym } from "@/components/studio/symbols";
import { cn } from "@/lib/utils";

type Filter = "ALL" | ParserMethod;

export function ConflictsView() {
  const a = useAnalysis();
  const focus = useStudio((s) => s.focus);
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [type, setType] = React.useState<"all" | "shift-reduce" | "reduce-reduce">("all");
  const [handled, setHandled] = React.useState<number | null>(null);
  const [highlight, setHighlight] = React.useState<string | null>(null);

  if (focus && focus.nonce !== handled && focus.symbol) {
    setHandled(focus.nonce);
    setFilter("ALL");
    setHighlight(`${focus.method}-${focus.state}-${focus.symbol}`);
  }
  React.useEffect(() => {
    if (highlight) document.getElementById(`conflict-${highlight}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight]);

  if (!a) {
    return (
      <>
        <PageHeader title="Conflict Analyzer" />
        <NeedsGrammar />
      </>
    );
  }
  const all = a.diagnoses;
  const shown = all.filter((d) => (filter === "ALL" || d.conflict.method === filter) && (type === "all" || d.conflict.type === type));
  const mergeInduced = all.filter((d) => d.introducedByMerge).length;

  return (
    <>
      <PageHeader
        title="Conflict Analyzer"
        description="Every conflicting ACTION cell, the items that compete for it, why the lookahead is there, and in which constructions the same conflict appears."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {METHODS.map((m) => {
          const n = a.tables[m].conflicts.length;
          return (
            <Panel key={m} className="flex items-center justify-between px-4 py-3">
              <div>
                <MethodLabel m={m} />
                <div className="text-xs text-fg-muted">
                  {a.tables[m].conflicts.filter((c) => c.type === "shift-reduce").length} S/R · {a.tables[m].conflicts.filter((c) => c.type === "reduce-reduce").length} R/R
                </div>
              </div>
              <span className={cn("font-mono text-2xl font-semibold", n ? "text-danger" : "text-success")}>{n}</span>
            </Panel>
          );
        })}
        <Panel className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="font-semibold text-accent">Introduced by merging</div>
            <div className="text-xs text-fg-muted">LALR conflicts absent from CLR</div>
          </div>
          <span className={cn("font-mono text-2xl font-semibold", mergeInduced ? "text-warning" : "text-fg-subtle")}>{mergeInduced}</span>
        </Panel>
      </div>

      {all.length === 0 ? (
        <Panel>
          <EmptyState icon={<CircleCheck className="text-success" />} title="No conflicts in any construction">
            The grammar is SLR(1), and therefore also LALR(1) and LR(1). Every ACTION cell of every table holds at most one action. Try the “Dangling
            else” or “LR(1) but not LALR(1)” samples in the Grammar Workbench to see the analyzer at work.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "ALL", label: `All (${all.length})` },
                ...METHODS.map((m) => ({ value: m as Filter, label: `${m} (${a.tables[m].conflicts.length})`, className: METHOD_META[m].color })),
              ]}
            />
            <Segmented
              size="sm"
              value={type}
              onChange={setType}
              options={[
                { value: "all", label: "any type" },
                { value: "shift-reduce", label: "shift-reduce" },
                { value: "reduce-reduce", label: "reduce-reduce" },
              ]}
            />
          </div>
          <div className="grid gap-3 2xl:grid-cols-2">
            {shown.map((d) => (
              <ConflictCard key={d.conflict.id} d={d} highlighted={highlight === d.conflict.id} />
            ))}
          </div>
          <p className="mt-4 text-xs text-fg-subtle">
            Explanations are derived from the generated items and sets. “Likely cause” recognises common structural patterns (ambiguous operators,
            optional suffixes, identical right-hand sides, FOLLOW over-approximation, LALR merging); it does not claim every conflict can be removed
            automatically.
          </p>
        </>
      )}
    </>
  );
}

function ConflictCard({ d, highlighted }: { d: ConflictDiagnosis; highlighted: boolean }) {
  const a = useAnalysis()!;
  const router = useRouter();
  const reveal = useStudio((s) => s.reveal);
  const c = d.conflict;
  const go = (href: string) => {
    reveal({ method: c.method, state: c.state, symbol: c.terminal });
    router.push(href);
  };
  return (
    <Panel id={`conflict-${c.id}`} className={cn("overflow-hidden", highlighted && "ring-2 ring-accent")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-danger-bg px-4 py-2.5">
        <TriangleAlert className="size-4 text-danger" />
        <MethodLabel m={c.method} />
        <span className="font-mono text-sm">
          state <span className="font-bold text-fg">I{c.state}</span> on <Sym s={c.terminal} className="font-bold" />
        </span>
        <Badge tone="danger">{c.type}</Badge>
        {d.introducedByMerge && (
          <Badge tone="warning">
            <GitMerge /> introduced by LALR merge
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[0.6875rem] text-fg-subtle">also in</span>
          {d.alsoIn.length === 0 ? (
            <span className="text-[0.6875rem] text-fg-subtle">— only {c.method}</span>
          ) : (
            [...new Set(d.alsoIn.map((x) => x.method))].map((m) => (
              <Badge key={m} tone={METHOD_META[m].tone}>
                {m} {d.alsoIn.filter((x) => x.method === m).map((x) => `I${x.state}`).join(",")}
              </Badge>
            ))
          )}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="space-y-1.5">
          {d.items.map((it, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md border border-border bg-panel-2/60 px-2.5 py-1">
              <ActionChip a={c.entries[i].action} className="w-10 text-sm" />
              <span className="w-14 text-xs text-fg-muted">{it.role}</span>
              <ItemText grammar={a.grammar} item={it.item} showLookaheads={c.method !== "SLR"} highlightLookahead={c.terminal} />
            </div>
          ))}
        </div>
        <div className="space-y-1.5 text-xs leading-relaxed text-fg-muted">
          {d.explanation.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {d.likelyCause && (
          <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning-bg p-2.5 text-xs leading-relaxed">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>
              <b className="text-warning">Likely cause.</b> <span className="text-fg-muted">{d.likelyCause}</span>
            </span>
          </div>
        )}
        {d.mergeOrigins && d.mergeOrigins.length > 0 && d.mergeOrigins[0].byState.length > 1 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full font-mono text-[0.75rem]">
              <thead className="bg-panel-2 text-[0.6875rem] text-fg-subtle">
                <tr>
                  <th className="px-2 py-1 text-left font-sans font-medium">
                    Is <Sym s={c.terminal} /> a lookahead of…
                  </th>
                  {d.mergeOrigins[0].byState.map((s) => (
                    <th key={s.state} className="px-2 py-1 font-sans font-medium">
                      CLR I{s.state}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.mergeOrigins.map((o, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1">{o.text}</td>
                    {o.byState.map((s) => (
                      <td key={s.state} className={cn("px-2 py-1 text-center", s.hasTerminal ? "text-reduce" : "text-fg-subtle")}>
                        {s.hasTerminal ? "yes" : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => go("/automaton")}>
            <Network /> Show state
          </Button>
          <Button size="sm" variant="ghost" onClick={() => go("/tables")}>
            <Table2 /> Show table cell
          </Button>
        </div>
      </div>
    </Panel>
  );
}
