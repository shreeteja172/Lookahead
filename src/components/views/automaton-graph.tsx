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
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import { Maximize2, Minimize2, RotateCcw } from "lucide-react";
import type { Automaton, Grammar, LRState } from "@/lib/engine";
import { ItemText } from "@/components/studio/symbols";
import { layoutGraph, type Box } from "@/lib/studio/automaton-layout";
import { useStudio } from "@/lib/studio/store";
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

/* Node content is sized by the browser, never estimated: the layout below measures it. */
function StateNodeView({ data }: NodeProps<StateNode>) {
  const { state, grammar, showAll } = data;
  const items = showAll ? state.items : state.items.filter((i) => i.kernel);
  const hidden = state.items.length - items.length;
  return (
    <div
      className={cn(
        "w-max rounded-md border bg-panel text-left transition-opacity",
        data.conflict ? "border-danger" : data.accepting ? "border-success/70" : "border-border-strong",
        data.selected && "ring-2 ring-accent",
        data.match && !data.selected && "ring-2 ring-warning",
        data.dimmed && "opacity-35",
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <div
        className={cn(
          "flex h-8 items-center gap-2 whitespace-nowrap rounded-t-[5px] border-b px-2.5",
          data.conflict ? "border-danger/40 bg-danger-bg" : "border-border bg-panel-2",
        )}
      >
        <span className="font-mono text-[0.8125rem] font-semibold text-fg">{data.label}</span>
        {data.initial && <span className="text-[0.6875rem] text-fg-muted">start</span>}
        {data.accepting && <span className="text-[0.6875rem] text-success">accept</span>}
        {data.conflict && <span className="text-[0.6875rem] font-medium text-danger">conflict</span>}
        {state.mergedFrom && state.mergedFrom.length > 1 && (
          <span className="ml-auto pl-2 font-mono text-[0.6875rem] text-fg-muted">merged {state.mergedFrom.join(", ")}</span>
        )}
      </div>
      <div className="px-2.5 py-1.5">
        {items.map((it, i) => (
          <div key={i} className={cn("whitespace-nowrap", !it.kernel && "opacity-70")}>
            <ItemText grammar={grammar} item={it} showLookaheads={data.lookaheads} className="text-[0.75rem] leading-6" />
          </div>
        ))}
        {hidden > 0 && (
          <div className="whitespace-nowrap text-[0.6875rem] leading-5 text-fg-muted">
            +{hidden} closure item{hidden > 1 ? "s" : ""}
          </div>
        )}
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
    // Self-loop drawn over the top of the node.
    const h = (data?.loopHeight ?? 60) / 2 + 28;
    path = `M ${sourceX} ${sourceY} C ${sourceX + 56} ${sourceY - h}, ${targetX - 56} ${targetY - h}, ${targetX} ${targetY}`;
    lx = (sourceX + targetX) / 2;
    ly = sourceY - h * 0.76;
  } else {
    [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  }
  const color = data?.highlighted
    ? "var(--accent)"
    : data?.terminal
      ? "color-mix(in srgb, var(--terminal) 55%, var(--border-strong))"
      : "color-mix(in srgb, var(--nonterminal) 55%, var(--border-strong))";
  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={{ stroke: color, strokeWidth: data?.highlighted ? 2.2 : 1.3, opacity: data?.dimmed ? 0.15 : 1 }} />
      <EdgeLabelRenderer>
        <div
          className={cn(
            "pointer-events-none absolute rounded border bg-panel px-1 font-mono text-[0.6875rem] font-semibold",
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
  /** The graph is shown full screen: there is no page to scroll, so scrolling pans. */
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

function GraphInner(props: AutomatonGraphProps) {
  const { automaton, grammar, conflictStates, selected, matches, onSelect, showAll, lookaheads, centerOn, fullscreen, onToggleFullscreen } = props;
  const rf = useReactFlow();
  // The instance object can change identity between renders; effects use this ref.
  const rfRef = React.useRef(rf);
  React.useEffect(() => {
    rfRef.current = rf;
  }, [rf]);
  const isNT = React.useMemo(() => new Set(grammar.nonterminals), [grammar]);

  // Real node sizes. React Flow reports them through `dimensions` changes in
  // onNodesChange (ResizeObserver); they must be written back onto the nodes,
  // otherwise React Flow treats the nodes as unmeasured and keeps them hidden.
  const [measured, setMeasured] = React.useState<Map<string, { width: number; height: number }>>(() => new Map());
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Safety net for windows that are not painting (ResizeObserver does not fire
  // there): shortly after the content can have changed, read sizes from the DOM
  // and correct any that are missing or stale.
  const scale = useStudio((st) => st.scale);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setMeasured((prev) => {
        let next: Map<string, { width: number; height: number }> | null = null;
        for (const s of automaton.states) {
          const id = String(s.id);
          const el = containerRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
          if (!el?.offsetWidth) continue;
          const old = prev.get(id);
          if (old && Math.round(old.width) === el.offsetWidth && Math.round(old.height) === el.offsetHeight) continue;
          next ??= new Map(prev);
          next.set(id, { width: el.offsetWidth, height: el.offsetHeight });
        }
        return next ?? prev;
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [automaton, showAll, lookaheads, scale, measured.size]);

  // Re-lay out whenever any state's measured size changes (content, lookaheads, text size).
  const signature = automaton.states.every((s) => measured.has(String(s.id)))
    ? automaton.states.map((s) => {
        const m = measured.get(String(s.id))!;
        return `${Math.round(m.width)}x${Math.round(m.height)}`;
      }).join(",")
    : "";

  const layoutMap = React.useMemo(() => {
    if (!signature) return null;
    const sizes = new Map<string, { width: number; height: number }>();
    signature.split(",").forEach((wh, i) => {
      const [width, height] = wh.split("x").map(Number);
      sizes.set(String(automaton.states[i].id), { width, height });
    });
    return layoutGraph(automaton, sizes);
  }, [signature, automaton]);

  // Positions moved by dragging, valid only for the layout they were made on.
  const [dragged, setDragged] = React.useState<{ base: Map<string, Box>; pos: Map<string, { x: number; y: number }> } | null>(null);
  const map = React.useMemo(() => {
    if (!layoutMap) return null;
    if (dragged?.base !== layoutMap) return layoutMap;
    const merged = new Map(layoutMap);
    for (const [id, p] of dragged.pos) {
      const b = merged.get(id);
      if (b) merged.set(id, { ...b, ...p });
    }
    return merged;
  }, [layoutMap, dragged]);

  // Entering or leaving full screen resizes the canvas; fit the graph to the new size.
  React.useEffect(() => {
    const t = setTimeout(() => rfRef.current.fitView({ padding: 0.08, duration: 250 }), 150);
    return () => clearTimeout(t);
  }, [fullscreen]);

  React.useEffect(() => {
    if (!layoutMap) return;
    const t = setTimeout(() => rfRef.current.fitView({ padding: 0.1, duration: 250 }), 30);
    return () => clearTimeout(t);
  }, [layoutMap]);

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
      automaton.states.map((state) => {
        const box = map?.get(String(state.id));
        return {
          id: String(state.id),
          type: "state",
          position: box ? { x: box.x, y: box.y } : { x: 0, y: 0 },
          measured: measured.get(String(state.id)),
          // Hidden (but still measurable) until the measured layout is ready.
          style: box ? undefined : { visibility: "hidden" as const },
          data: {
            state,
            grammar,
            showAll,
            lookaheads,
            conflict: conflictStates.has(state.id),
            initial: state.id === 0,
            accepting: accepting.has(state.id),
            selected: selected === state.id,
            dimmed: neighbours !== null && !neighbours.has(state.id),
            match: matches.has(state.id),
            label: `I${state.id}`,
          },
        };
      }),
    [map, measured, automaton, grammar, showAll, lookaheads, conflictStates, accepting, selected, neighbours, matches],
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
          hidden: !map,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: hl ? "var(--accent)" : "var(--border-strong)" },
          data: {
            symbol: t.symbol,
            terminal: !isNT.has(t.symbol),
            highlighted: hl,
            dimmed: selected !== null && !hl,
            loopHeight: map?.get(String(t.from))?.height,
          },
          zIndex: hl ? 10 : 0,
        };
      }),
    [automaton, selected, isNT, map],
  );

  // Size reports update the layout; drags move a state within the current layout.
  const onNodesChange = React.useCallback(
    (changes: NodeChange<StateNode>[]) => {
      const dims = changes.filter((c) => c.type === "dimensions" && c.dimensions);
      if (dims.length) {
        setMeasured((prev) => {
          let next: Map<string, { width: number; height: number }> | null = null;
          for (const c of dims) {
            if (c.type !== "dimensions" || !c.dimensions) continue;
            const old = prev.get(c.id);
            if (old && Math.round(old.width) === Math.round(c.dimensions.width) && Math.round(old.height) === Math.round(c.dimensions.height)) continue;
            next ??= new Map(prev);
            next.set(c.id, c.dimensions);
          }
          return next ?? prev;
        });
      }
      const moves = changes.filter((c) => c.type === "position" && c.position);
      if (moves.length && layoutMap) {
        setDragged((prev) => {
          const pos = new Map(prev?.base === layoutMap ? prev.pos : []);
          for (const c of moves) if (c.type === "position" && c.position) pos.set(c.id, c.position);
          return { base: layoutMap, pos };
        });
      }
    },
    [layoutMap],
  );

  React.useEffect(() => {
    if (!centerOn || !map) return;
    const b = map.get(String(centerOn.id));
    if (!b) return;
    rfRef.current.setCenter(b.x + b.width / 2, b.y + b.height / 2, { zoom: Math.max(rfRef.current.getZoom(), 0.9), duration: 400 });
    // Only re-center on an explicit request, not when the layout map changes through dragging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerOn]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, n) => onSelect(Number(n.id))}
        onPaneClick={() => onSelect(null)}
        nodesDraggable
        // A plain scroll scrolls the page; pinch (trackpad) or Ctrl + scroll zooms.
        // In full screen a two-finger scroll pans the canvas instead.
        zoomOnScroll={false}
        zoomOnPinch
        panOnScroll={fullscreen}
        preventScrolling={fullscreen}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.08}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} color="var(--border)" />
        <Controls showInteractive={false} position="bottom-left">
          <button
            type="button"
            className="react-flow__controls-button"
            title="Re-arrange states and fit"
            aria-label="Re-arrange states and fit"
            onClick={() => {
              onSelect(null);
              setDragged(null);
              rf.fitView({ padding: 0.1, duration: 250 });
            }}
          >
            <RotateCcw className="size-3" />
          </button>
          <button
            type="button"
            className="react-flow__controls-button"
            title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            onClick={onToggleFullscreen}
          >
            {fullscreen ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
          </button>
        </Controls>
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) =>
            (n.data as StateNodeData).conflict ? "var(--danger)" : (n.data as StateNodeData).selected ? "var(--accent)" : "var(--border-strong)"
          }
          className="!hidden md:!block"
          style={{ width: 150, height: 100 }}
        />
      </ReactFlow>
    </div>
  );
}

export function AutomatonGraph(props: AutomatonGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
