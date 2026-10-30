"use client";

import * as React from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { graphlib, layout } from "@dagrejs/dagre";
import { Maximize2 } from "lucide-react";
import type { Automaton, Grammar, LRState } from "@/lib/engine";
import { formatItem } from "@/lib/engine";
import { ItemText } from "@/components/studio/symbols";
import { cn } from "@/lib/utils";

export interface StateNodeData extends Record<string, unknown> {
  state: LRState;
  grammar: Grammar;
  showAll: boolean;
  lookaheads: boolean;
  conflict: boolean;
  initial: boolean;
  accepting: boolean;
  selected: boolean;
  dimmed: boolean;
  match: boolean;
  label: string;
}

type StateNode = Node<StateNodeData, "state">;

const ITEM_H = 22;
const HEADER_H = 30;

function nodeSize(state: LRState, g: Grammar, showAll: boolean, lookaheads: boolean) {
  const items = showAll ? state.items : state.items.filter((i) => i.kernel);
  const longest = Math.max(10, ...items.map((i) => formatItem(g, i, { lookaheads }).length));
  return { width: Math.min(460, 40 + longest * 7.4), height: HEADER_H + 14 + items.length * ITEM_H };
}

function StateNodeView({ data }: NodeProps<StateNode>) {
  const { state, grammar, showAll } = data;
  const items = showAll ? state.items : state.items.filter((i) => i.kernel);
  const hidden = state.items.length - items.length;
  return (
    <div
      className={cn(
        "rounded-[10px] border bg-panel text-left shadow-sm transition-[opacity,box-shadow,border-color]",
        data.conflict ? "border-danger" : data.accepting ? "border-success/70" : "border-border-strong",
        data.selected && "ring-2 ring-accent shadow-lg",
        data.match && !data.selected && "ring-2 ring-warning",
        data.dimmed && "opacity-35",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-t-[9px] border-b px-2.5",
          data.conflict ? "border-danger/40 bg-danger-bg" : "border-border bg-panel-2",
        )}
        style={{ height: HEADER_H }}
      >
        <span className="font-mono text-[13px] font-bold text-fg">{data.label}</span>
        {data.initial && <span className="rounded bg-accent/20 px-1 text-[10px] font-medium text-accent">start</span>}
        {data.accepting && <span className="rounded bg-success/20 px-1 text-[10px] font-medium text-success">accept</span>}
        {data.conflict && <span className="rounded bg-danger/20 px-1 text-[10px] font-medium text-danger">conflict</span>}
        {state.mergedFrom && state.mergedFrom.length > 1 && (
          <span className="ml-auto font-mono text-[10px] text-accent">⟵ {state.mergedFrom.join(",")}</span>
        )}
      </div>
      <div className="px-2.5 py-[7px]">
        {items.map((it, i) => (
          <div key={i} className={cn("whitespace-nowrap", !it.kernel && "opacity-70")} style={{ height: ITEM_H }}>
            <ItemText grammar={grammar} item={it} showLookaheads={data.lookaheads} className="text-[12px] leading-[22px]" />
          </div>
        ))}
        {hidden > 0 && <div className="text-[10px] text-fg-subtle">+{hidden} closure item{hidden > 1 ? "s" : ""}</div>}
      </div>
    </div>
  );
}

interface TransitionEdgeData extends Record<string, unknown> {
  symbol: string;
  terminal: boolean;
  highlighted: boolean;
  dimmed: boolean;
  loopHeight?: number;
}

function TransitionEdge(props: EdgeProps<Edge<TransitionEdgeData>>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, source, target } = props;
  let path: string;
  let lx: number;
  let ly: number;
  if (source === target) {
    const h = (data?.loopHeight ?? 60) / 2 + 26;
    path = `M ${sourceX} ${sourceY} C ${sourceX + 50} ${sourceY - h}, ${targetX - 50} ${targetY - h}, ${targetX} ${targetY}`;
    lx = (sourceX + targetX) / 2;
    ly = sourceY - h * 0.78;
  } else {
    [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  }
  const color = data?.highlighted ? "var(--accent)" : data?.terminal ? "color-mix(in srgb, var(--terminal) 55%, var(--border-strong))" : "color-mix(in srgb, var(--nonterminal) 55%, var(--border-strong))";
  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{ stroke: color, strokeWidth: data?.highlighted ? 2.2 : 1.3, opacity: data?.dimmed ? 0.15 : 1 }}
      />
      <EdgeLabelRenderer>
        <div
          className={cn(
            "pointer-events-none absolute rounded border bg-panel px-1 font-mono text-[11px] font-semibold",
            data?.terminal ? "text-terminal" : "text-nonterminal",
            data?.highlighted ? "border-accent" : "border-border",
          )}
          style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, opacity: data?.dimmed ? 0.2 : 1 }}
        >
          {data?.symbol}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { state: StateNodeView };
const edgeTypes = { transition: TransitionEdge };

export interface AutomatonGraphProps {
  automaton: Automaton;
  grammar: Grammar;
  conflictStates: Set<number>;
  selected: number | null;
  matches: Set<number>;
  onSelect: (id: number | null) => void;
  showAll: boolean;
  lookaheads: boolean;
  centerOn: { id: number; nonce: number } | null;
}

function GraphInner(props: AutomatonGraphProps) {
  const { automaton, grammar, conflictStates, selected, matches, onSelect, showAll, lookaheads, centerOn } = props;
  const rf = useReactFlow();
  const isNT = React.useMemo(() => new Set(grammar.nonterminals), [grammar]);

  // Layout depends only on structure and node sizes, not on selection.
  const positioned = React.useMemo(() => {
    const g = new graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 90, marginx: 20, marginy: 20 });
    g.setDefaultEdgeLabel(() => ({}));
    const sizes = automaton.states.map((s) => nodeSize(s, grammar, showAll, lookaheads));
    automaton.states.forEach((s, i) => g.setNode(String(s.id), sizes[i]));
    for (const t of automaton.transitions) if (t.from !== t.to) g.setEdge(String(t.from), String(t.to));
    layout(g);
    return automaton.states.map((s, i) => {
      const n = g.node(String(s.id));
      return { id: s.id, x: n.x - sizes[i].width / 2, y: n.y - sizes[i].height / 2, ...sizes[i] };
    });
  }, [automaton, grammar, showAll, lookaheads]);

  const accepting = React.useMemo(
    () => new Set(automaton.states.filter((s) => s.items.some((i) => i.prod === 0 && i.dot === 1)).map((s) => s.id)),
    [automaton],
  );

  const neighbours = React.useMemo(() => {
    if (selected === null) return null;
    const set = new Set<number>([selected]);
    for (const t of automaton.transitions) {
      if (t.from === selected) set.add(t.to);
      if (t.to === selected) set.add(t.from);
    }
    return set;
  }, [automaton, selected]);

  const nodes: StateNode[] = React.useMemo(
    () =>
      positioned.map((p) => {
        const state = automaton.states[p.id];
        return {
          id: String(p.id),
          type: "state",
          position: { x: p.x, y: p.y },
          width: p.width,
          height: p.height,
          data: {
            state,
            grammar,
            showAll,
            lookaheads,
            conflict: conflictStates.has(p.id),
            initial: p.id === 0,
            accepting: accepting.has(p.id),
            selected: selected === p.id,
            dimmed: neighbours !== null && !neighbours.has(p.id),
            match: matches.has(p.id),
            label: `I${p.id}`,
          },
        };
      }),
    [positioned, automaton, grammar, showAll, lookaheads, conflictStates, accepting, selected, neighbours, matches],
  );

  const edges: Edge<TransitionEdgeData>[] = React.useMemo(
    () =>
      automaton.transitions.map((t) => {
        const hl = selected !== null && (t.from === selected || t.to === selected);
        return {
          id: `${t.from}-${t.symbol}-${t.to}`,
          source: String(t.from),
          target: String(t.to),
          type: "transition",
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: hl ? "var(--accent)" : "var(--border-strong)" },
          data: {
            symbol: t.symbol,
            terminal: !isNT.has(t.symbol),
            highlighted: hl,
            dimmed: selected !== null && !hl,
            loopHeight: positioned[t.from]?.height,
          },
          zIndex: hl ? 10 : 0,
        };
      }),
    [automaton, selected, isNT, positioned],
  );

  React.useEffect(() => {
    if (!centerOn) return;
    const p = positioned[centerOn.id];
    if (!p) return;
    rf.setCenter(p.x + p.width / 2, p.y + p.height / 2, { zoom: Math.max(rf.getZoom(), 0.9), duration: 450 });
  }, [centerOn, positioned, rf]);

  React.useEffect(() => {
    const t = setTimeout(() => rf.fitView({ padding: 0.12, duration: 300 }), 50);
    return () => clearTimeout(t);
  }, [automaton, showAll, lookaheads, rf]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_, n) => onSelect(Number(n.id))}
      onPaneClick={() => onSelect(null)}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.08}
      maxZoom={2}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={22} size={1} color="var(--border)" />
      <Controls showInteractive={false} position="bottom-left">
        <button
          type="button"
          className="react-flow__controls-button"
          title="Reset view"
          aria-label="Reset view"
          onClick={() => {
            onSelect(null);
            rf.fitView({ padding: 0.12, duration: 300 });
          }}
        >
          <Maximize2 className="size-3" />
        </button>
      </Controls>
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => ((n.data as StateNodeData).conflict ? "var(--conflict)" : (n.data as StateNodeData).selected ? "var(--accent)" : "var(--border-strong)")}
        className="!hidden md:!block"
        style={{ width: 150, height: 100 }}
      />
    </ReactFlow>
  );
}

export function AutomatonGraph(props: AutomatonGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
