"use client";

import * as React from "react";
import { Eye, EyeOff, Maximize2, Minimize2, Search, X } from "lucide-react";
import { formatItem, type ParserMethod } from "@/lib/engine";
import { useAnalysis, useStudio } from "@/lib/studio/store";
import { Badge, Button, Input, Panel, Segmented } from "@/components/ui/primitives";
import { NeedsGrammar, PageHeader, StepNav } from "@/components/studio/page-header";
import { ConceptNote, Notation } from "@/components/studio/concept-note";
import { StateDetails } from "@/components/studio/state-details";
import { METHOD_META } from "@/components/studio/symbols";
import { useFullscreen } from "@/lib/studio/use-fullscreen";
import { cn } from "@/lib/utils";
import { AutomatonGraph } from "./automaton-graph";

export const METHOD_OPTIONS = (["SLR", "CLR", "LALR"] as ParserMethod[]).map((m) => ({
  value: m,
  label: (
    <span>
      {METHOD_META[m].label}
      <span className="ml-1 hidden text-[0.625rem] text-fg-subtle sm:inline">{METHOD_META[m].automaton}</span>
    </span>
  ),
  className: METHOD_META[m].color,
}));

export function AutomatonView() {
  const a = useAnalysis();
  const method = useStudio((s) => s.method);
  const setMethod = useStudio((s) => s.setMethod);
  const focus = useStudio((s) => s.focus);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [showAll, setShowAll] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [centerOn, setCenterOn] = React.useState<{ id: number; nonce: number } | null>(null);
  const [handledFocus, setHandledFocus] = React.useState<number | null>(null);
  const { ref: fullscreenRef, active: isFullscreen, overlay: fullscreenOverlay, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>();

  // A reveal() request from another view (command palette, conflicts, tables).
  if (focus && focus.nonce !== handledFocus && focus.state !== undefined) {
    setHandledFocus(focus.nonce);
    setSelected(focus.state);
    setCenterOn({ id: focus.state, nonce: focus.nonce });
  }

  const automaton = a?.tables[method].automaton;
  const conflictStates = React.useMemo(() => new Set(a?.tables[method].conflicts.map((c) => c.state) ?? []), [a, method]);

  const matches = React.useMemo(() => {
    const out = new Set<number>();
    const q = query.trim().toLowerCase();
    if (!q || !a || !automaton) return out;
    const num = q.replace(/^i/, "");
    for (const st of automaton.states) {
      if (/^\d+$/.test(num) && String(st.id) === num) out.add(st.id);
      else if (st.items.some((it) => formatItem(a.grammar, it).toLowerCase().replace(/·/g, ".").includes(q.replace(/·/g, ".")))) out.add(st.id);
    }
    return out;
  }, [query, a, automaton]);

  if (!a || !automaton) {
    return (
      <>
        <PageHeader step={3} title="LR automaton" />
        <NeedsGrammar />
      </>
    );
  }
  const sel = selected !== null && selected < automaton.states.length ? selected : null;
  const select = (id: number | null) => {
    setSelected(id);
    if (id !== null) setCenterOn({ id, nonce: Date.now() });
  };

  return (
    <>
      <PageHeader
        step={3}
        title="LR automaton"
        description="Each box is a parser state (a set of items); each arrow is a GOTO transition on the symbol it is labelled with. Click a state to inspect it."
        actions={
          <Segmented
            value={method}
            onChange={(m) => {
              setMethod(m);
              setSelected(null);
            }}
            options={METHOD_OPTIONS}
          />
        }
      />
      <ConceptNote id="automaton" title="Items, CLOSURE and GOTO">
        <p>
          An <b>item</b> such as <Notation>E → E • + T</Notation> is a production with a dot marking how much of it has been recognised. LR(1) items add a
          lookahead: <Notation>[E → E • + T, $]</Notation>.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <b>CLOSURE</b>: whenever the dot is before a nonterminal B, add every <Notation>B → • γ</Notation> (shown as closure items).
          </li>
          <li>
            <b>GOTO(I, X)</b>: move the dot over X in the items of I that allow it, then take the closure. That set is the next state.
          </li>
        </ul>
        <p className="mt-2">
          SLR uses the LR(0) collection; CLR uses LR(1) items, which often needs more states; LALR merges LR(1) states that have the same items
          once lookaheads are ignored.
        </p>
      </ConceptNote>
      <div
        ref={fullscreenRef}
        className={cn(
          "grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]",
          // Full screen: graph and inspector fill the screen side by side.
          isFullscreen && "h-dvh grid-rows-[minmax(0,1fr)] bg-bg p-4",
          fullscreenOverlay && "fixed inset-0 z-50",
        )}
      >
        <Panel className={cn("flex min-h-[480px] flex-col overflow-hidden", isFullscreen ? "h-full min-h-0" : "h-[70vh]")}>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2 top-2 size-4 text-fg-subtle" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matches.size) select([...matches][0]);
                }}
                placeholder="Search: 5, I5, T → T ., lookahead…"
                className="pl-8"
              />
              {query && (
                <button className="absolute right-2 top-2 text-fg-subtle hover:text-fg cursor-pointer" onClick={() => setQuery("")} aria-label="Clear search">
                  <X className="size-4" />
                </button>
              )}
            </div>
            {query && <span className="text-xs text-fg-muted">{matches.size} match{matches.size === 1 ? "" : "es"}</span>}
            <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)} title="Toggle closure items">
              {showAll ? <EyeOff /> : <Eye />} {showAll ? "Kernel only" : "All items"}
            </Button>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-fg-muted">
              <Badge tone={METHOD_META[method].tone}>{automaton.states.length} states</Badge>
              <Badge>{automaton.transitions.length} transitions</Badge>
              {conflictStates.size > 0 && <Badge tone="danger">{conflictStates.size} conflict states</Badge>}
              <Button size="sm" variant="outline" onClick={toggleFullscreen} title={isFullscreen ? "Exit full screen (Esc)" : "Show the automaton full screen"}>
                {isFullscreen ? <Minimize2 /> : <Maximize2 />} {isFullscreen ? "Exit full screen" : "Full screen"}
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <AutomatonGraph
              automaton={automaton}
              grammar={a.grammar}
              conflictStates={conflictStates}
              selected={sel}
              matches={matches}
              onSelect={(id) => setSelected(id)}
              showAll={showAll}
              lookaheads={method !== "SLR"}
              centerOn={centerOn}
              fullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />
          </div>
        </Panel>
        <Panel className={cn("min-h-[200px] overflow-y-auto p-4", isFullscreen ? "hidden h-full lg:block" : "max-h-[70vh]")}>
          {sel === null ? (
            <div className="space-y-3 text-sm text-fg-muted">
              <p className="font-medium text-fg">Select a state</p>
              <p>
                Click a node to inspect its kernel and closure items, transitions and ACTION row. The selected state&apos;s incoming and outgoing
                transitions are highlighted.
              </p>
              <ul className="space-y-1 text-xs">
                <li>
                  <Badge tone="accent">start</Badge> initial state I0 = CLOSURE({"{"}
                  {formatItem(a.grammar, automaton.states[0].items[0])}
                  {"}"})
                </li>
                <li>
                  <Badge tone="success">accept</Badge> contains {a.grammar.augmentedStart} → {a.grammar.start} •
                </li>
                <li>
                  <Badge tone="danger">conflict</Badge> state has a conflicting ACTION cell
                </li>
              </ul>
              <div className="flex flex-wrap gap-1 pt-2">
                {[...conflictStates].map((id) => (
                  <Button key={id} size="sm" variant="danger" onClick={() => select(id)}>
                    I{id}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <StateDetails analysis={a} method={method} stateId={sel} onSelect={select} />
          )}
        </Panel>
      </div>
      <StepNav step={3} />
    </>
  );
}
