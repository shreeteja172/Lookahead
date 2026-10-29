"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, FileJson, FileSpreadsheet, Info, Search, Table2, TriangleAlert, X } from "lucide-react";
import { formatItem, formatProduction, symbolAfterDot, type ParseTable } from "@/lib/engine";
import { useAnalysis, useStudio } from "@/lib/studio/store";
import { cellText, tableToCSV, tableToJSON } from "@/lib/studio/export";
import { Badge, Button, Input, Panel, PanelHeader, Segmented, Select } from "@/components/ui/primitives";
import { NeedsGrammar, PageHeader } from "@/components/studio/page-header";
import { ActionChip, ItemText, METHOD_META, ProductionText, Sym } from "@/components/studio/symbols";
import { StateDetails } from "@/components/studio/state-details";
import { cn, downloadText, slugify } from "@/lib/utils";
import { METHOD_OPTIONS } from "./automaton-view";

type Sort = "state" | "state-desc" | "conflicts" | "entries";

export function TablesView() {
  const a = useAnalysis();
  const method = useStudio((s) => s.method);
  const setMethod = useStudio((s) => s.setMethod);
  const projectName = useStudio((s) => s.projectName);
  const focus = useStudio((s) => s.focus);
  const [cell, setCell] = React.useState<{ state: number; symbol: string } | null>(null);
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<Sort>("state");
  const [handled, setHandled] = React.useState<number | null>(null);

  if (focus && focus.nonce !== handled && focus.state !== undefined) {
    setHandled(focus.nonce);
    setCell({ state: focus.state, symbol: focus.symbol ?? "" });
  }

  React.useEffect(() => {
    if (!cell) return;
    document.getElementById(`row-${cell.state}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [cell]);

  if (!a) {
    return (
      <>
        <PageHeader title="Parsing Tables" />
        <NeedsGrammar />
      </>
    );
  }
  const t = a.tables[method];
  const sel = cell && cell.state < t.automaton.states.length ? cell : null;
  const conflictCells = new Set(t.conflicts.map((c) => `${c.state}|${c.terminal}`));
  const q = query.trim().toLowerCase();

  let rows = t.automaton.states.map((s) => s.id);
  if (q) {
    rows = rows.filter((id) => {
      if (String(id) === q.replace(/^i/, "")) return true;
      const cells = [...t.terminals, ...t.nonterminals].map((x) => cellText(t, id, x).toLowerCase());
      return cells.some((c) => c && (c === q || c.split("/").includes(q))) || (q === "conflict" && t.conflicts.some((c) => c.state === id));
    });
  }
  const entries = (id: number) => [...t.action[id].values()].reduce((n, e) => n + e.length, 0) + t.goto[id].size;
  const nConf = (id: number) => t.conflicts.filter((c) => c.state === id).length;
  rows = [...rows].sort((x, y) =>
    sort === "state-desc" ? y - x : sort === "conflicts" ? nConf(y) - nConf(x) || x - y : sort === "entries" ? entries(y) - entries(x) || x - y : x - y,
  );

  return (
    <>
      <PageHeader
        title="Parsing Tables"
        description="ACTION and GOTO generated from the automaton. sN = shift and go to state N, rN = reduce by production N, acc = accept, blank = error. Click any cell to see why it is there."
        actions={<Segmented value={method} onChange={(m) => (setMethod(m), setCell(null))} options={METHOD_OPTIONS} />}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-w-0 content-start gap-4">
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <div className="relative w-full max-w-[240px]">
                <Search className="pointer-events-none absolute left-2 top-2 size-4 text-fg-subtle" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter: state, s4, r3, conflict" className="pl-8" />
                {query && (
                  <button className="absolute right-2 top-2 text-fg-subtle hover:text-fg cursor-pointer" onClick={() => setQuery("")} aria-label="Clear filter">
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-fg-muted">
                <ArrowDownUp className="size-3.5" />
                <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-7 text-xs">
                  <option value="state">State ↑</option>
                  <option value="state-desc">State ↓</option>
                  <option value="conflicts">Conflicts first</option>
                  <option value="entries">Most entries</option>
                </Select>
              </label>
              <span className="text-xs text-fg-subtle">
                {rows.length} / {t.automaton.states.length} rows
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                {t.conflicts.length > 0 ? (
                  <Badge tone="danger">
                    <TriangleAlert /> {t.conflicts.length} conflicting cells
                  </Badge>
                ) : (
                  <Badge tone="success">no conflicts</Badge>
                )}
                <Button size="sm" variant="ghost" onClick={() => downloadText(`${slugify(projectName)}-${method.toLowerCase()}.csv`, tableToCSV(t), "text/csv")}>
                  <FileSpreadsheet /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadText(`${slugify(projectName)}-${method.toLowerCase()}.json`, JSON.stringify(tableToJSON(a, t), null, 2), "application/json")}
                >
                  <FileJson /> JSON
                </Button>
              </div>
            </div>
            <div className="max-h-[62vh] overflow-auto">
              <table className="w-max min-w-full border-separate border-spacing-0 font-mono text-[13px]">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-panel-2 text-[11px] uppercase tracking-wider text-fg-subtle">
                    <th className="sticky left-0 z-10 border-b border-r border-border bg-panel-2 px-3 py-1.5" rowSpan={2}>
                      State
                    </th>
                    <th colSpan={t.terminals.length} className="border-b border-r border-border px-2 py-1.5 font-sans font-medium">
                      ACTION
                    </th>
                    <th colSpan={t.nonterminals.length} className="border-b border-border px-2 py-1.5 font-sans font-medium">
                      GOTO
                    </th>
                  </tr>
                  <tr className="bg-panel-2">
                    {t.terminals.map((x, i) => (
                      <th key={x} className={cn("min-w-14 border-b border-border px-2 py-1.5 font-semibold", i === t.terminals.length - 1 && "border-r")}>
                        <Sym s={x} />
                      </th>
                    ))}
                    {t.nonterminals.map((x) => (
                      <th key={x} className="min-w-12 border-b border-border px-2 py-1.5 font-semibold">
                        <Sym s={x} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((id) => {
                    const st = t.automaton.states[id];
                    const rowSel = sel?.state === id;
                    return (
                      <tr key={id} id={`row-${id}`} className={cn("group", rowSel && "bg-highlight-bg/40")}>
                        <td
                          className={cn(
                            "sticky left-0 z-10 border-b border-r border-border bg-panel px-3 py-1 text-right font-semibold text-state group-hover:bg-panel-2",
                            rowSel && "bg-panel-2",
                          )}
                        >
                          {id}
                          {method === "LALR" && st.mergedFrom && st.mergedFrom.length > 1 && (
                            <span className="ml-1 text-[10px] font-normal text-lalr">({st.mergedFrom.join(",")})</span>
                          )}
                        </td>
                        {t.terminals.map((x, i) => {
                          const es = t.action[id].get(x);
                          const isConf = conflictCells.has(`${id}|${x}`);
                          const isSel = sel?.state === id && sel.symbol === x;
                          return (
                            <td
                              key={x}
                              onClick={() => es && setCell({ state: id, symbol: x })}
                              className={cn(
                                "border-b border-border/70 px-2 py-1 text-center",
                                i === t.terminals.length - 1 && "border-r border-r-border",
                                es && "cursor-pointer hover:bg-panel-2",
                                isConf && "bg-conflict-bg",
                                isSel && "outline-2 -outline-offset-2 outline-accent",
                              )}
                            >
                              {es?.map((e, k) => (
                                <React.Fragment key={k}>
                                  {k > 0 && <span className="text-conflict">/</span>}
                                  <ActionChip a={e.action} />
                                </React.Fragment>
                              ))}
                            </td>
                          );
                        })}
                        {t.nonterminals.map((x) => {
                          const g = t.goto[id].get(x);
                          const isSel = sel?.state === id && sel.symbol === x;
                          return (
                            <td
                              key={x}
                              onClick={() => g !== undefined && setCell({ state: id, symbol: x })}
                              className={cn(
                                "border-b border-border/70 px-2 py-1 text-center text-state",
                                g !== undefined && "cursor-pointer hover:bg-panel-2",
                                isSel && "outline-2 -outline-offset-2 outline-accent",
                              )}
                            >
                              {g}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && <div className="p-8 text-center text-sm text-fg-muted">No rows match “{query}”.</div>}
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Production numbering" description="Shared by the SLR, CLR and LALR tables, the simulator and all explanations." />
            <div className="grid gap-x-6 gap-y-0.5 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
              {a.grammar.productions.map((p) => (
                <ProductionText key={p.id} p={p} numbered className="text-[13px]" />
              ))}
            </div>
          </Panel>
        </div>
        <Panel className="max-h-[calc(62vh+52px)] overflow-y-auto xl:sticky xl:top-0">
          {sel ? (
            <CellExplanation table={t} state={sel.state} symbol={sel.symbol} onSelectState={(s) => setCell({ state: s, symbol: "" })} />
          ) : (
            <div className="space-y-3 p-4 text-sm text-fg-muted">
              <div className="flex items-center gap-2 font-medium text-fg">
                <Table2 className="size-4" /> How {METHOD_META[method].label} fills the table
              </div>
              <ul className="list-disc space-y-1.5 pl-4 text-xs">
                <li>
                  Item <span className="font-mono">A → α • a β</span> with GOTO(I, a) = J ⇒ <span className="font-mono text-shift">ACTION[I, a] = sJ</span>
                </li>
                <li>
                  Item <span className="font-mono">A → α •</span> ⇒ <span className="font-mono text-reduce">rN</span> on{" "}
                  {method === "SLR" ? (
                    <>every a ∈ FOLLOW(A)</>
                  ) : (
                    <>each lookahead of the item{method === "LALR" ? " (merged from CLR states)" : ""}</>
                  )}
                </li>
                <li>
                  Item <span className="font-mono">S′ → S •</span> ⇒ <span className="font-mono text-accept">ACTION[I, $] = acc</span>
                </li>
                <li>GOTO(I, A) = J for nonterminal A ⇒ GOTO[I, A] = J</li>
                <li>Two different actions in one cell are a conflict and are kept, not hidden.</li>
              </ul>
              <p className="flex gap-2 text-xs">
                <Info className="mt-0.5 size-3.5 shrink-0" /> Click a cell to see the item that produced it.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function CellExplanation({
  table,
  state,
  symbol,
  onSelectState,
}: {
  table: ParseTable;
  state: number;
  symbol: string;
  onSelectState: (s: number) => void;
}) {
  const a = useAnalysis()!;
  const g = a.grammar;
  const st = table.automaton.states[state];
  const entries = table.action[state].get(symbol);
  const gotoTarget = table.goto[state].get(symbol);
  const reveal = useStudio((s) => s.reveal);
  const router = useRouter();
  const highlight = new Set<number>();
  entries?.forEach((e) => highlight.add(e.itemIndex));
  if (gotoTarget !== undefined) st.items.forEach((it, i) => symbolAfterDot(g, it) === symbol && highlight.add(i));
  const conflict = table.conflicts.find((c) => c.state === state && c.terminal === symbol);

  return (
    <div>
      {symbol && (entries || gotoTarget !== undefined) && (
        <div className="border-b border-border p-4">
          <div className="mb-2 flex items-center gap-2 font-mono text-sm">
            {entries ? "ACTION" : "GOTO"}[<span className="text-state">{state}</span>, <Sym s={symbol} />] =
            {entries ? (
              entries.map((e, k) => (
                <React.Fragment key={k}>
                  {k > 0 && <span className="text-conflict">/</span>}
                  <ActionChip a={e.action} />
                </React.Fragment>
              ))
            ) : (
              <span className="font-semibold text-state">{gotoTarget}</span>
            )}
            {conflict && <Badge tone="danger">{conflict.type}</Badge>}
          </div>
          <div className="space-y-2.5">
            {entries?.map((e, k) => (
              <div key={k} className="rounded-lg border border-border bg-panel-2/60 p-2.5 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <ActionChip a={e.action} className="text-sm" />
                  <span className="text-fg-subtle">from item</span>
                </div>
                <ItemText grammar={g} item={st.items[e.itemIndex]} showLookaheads={table.method !== "SLR"} highlightLookahead={symbol} />
                <p className="mt-1.5 text-fg-muted">{e.reason}</p>
                {e.action.type === "reduce" && (
                  <p className="mt-1 text-fg-subtle">
                    Pops {g.productions[e.action.prod].rhs.length} state(s), then consults GOTO[·, {g.productions[e.action.prod].lhs}].
                  </p>
                )}
              </div>
            ))}
            {gotoTarget !== undefined && (
              <p className="text-xs text-fg-muted">
                State {state} has items with the dot before <Sym s={symbol} /> (highlighted below). Advancing the dot over {symbol} gives the kernel of state{" "}
                {gotoTarget}, so after reducing to {symbol} with state {state} exposed, the parser goes to state {gotoTarget}.
              </p>
            )}
            {conflict && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  reveal({ method: table.method, state, symbol });
                  router.push("/conflicts");
                }}
                className="mt-1"
              >
                <TriangleAlert /> Open in Conflict Analyzer
              </Button>
            )}
          </div>
          <div className="mt-2 text-[11px] text-fg-subtle">
            {entries?.map((e) => (e.action.type === "reduce" ? `r${e.action.prod}: ${formatProduction(g.productions[e.action.prod])}` : "")).filter(Boolean).join(" · ")}
          </div>
        </div>
      )}
      <div className="p-4">
        <StateDetails analysis={a} method={table.method} stateId={state} onSelect={onSelectState} highlightItems={highlight} />
      </div>
      <span className="sr-only">{st.items.map((i) => formatItem(g, i)).join("; ")}</span>
    </div>
  );
}
