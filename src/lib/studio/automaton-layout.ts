import { graphlib, layout } from "@dagrejs/dagre";
import type { Automaton } from "@/lib/engine";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Layered left-to-right layout from measured node sizes; edge labels get their own space. */
export function layoutGraph(automaton: Automaton, sizes: Map<string, { width: number; height: number }>): Map<string, Box> {
  const g = new graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: "LR", nodesep: 36, ranksep: 110, edgesep: 18, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  // dagre writes x/y/rank into the label object, so give it a copy.
  for (const [id, size] of sizes) g.setNode(id, { width: size.width, height: size.height });
  for (const t of automaton.transitions) {
    if (t.from !== t.to) g.setEdge(String(t.from), String(t.to), { width: 24, height: 18, labelpos: "c" }, t.symbol);
  }
  layout(g);
  const out = new Map<string, Box>();
  for (const [id, size] of sizes) {
    const n = g.node(id);
    // dagre reports centres; React Flow positions are top-left corners.
    out.set(id, { x: n.x - size.width / 2, y: n.y - size.height / 2, width: size.width, height: size.height });
  }
  return out;
}
