"use client";

import * as React from "react";
import type { Grammar, SimStep } from "@/lib/engine";
import { EPS } from "@/lib/engine";
import { symbolClass } from "./symbols";

export interface TreeNode {
  id: number;
  symbol: string;
  children: TreeNode[];
  fresh?: boolean;
}

/**
 * Rebuilds the parse forest after `count` trace steps: shifts push leaves,
 * reductions replace the top |rhs| trees by a new parent. This mirrors the
 * parser's symbol stack, so the tree grows bottom-up exactly like LR parsing.
 */
export function forestAfter(grammar: Grammar, steps: SimStep[], count: number): TreeNode[] {
  const stack: TreeNode[] = [];
  let id = 0;
  for (let i = 0; i < Math.min(count, steps.length); i++) {
    const s = steps[i];
    const a = s.actions[0];
    const isLast = i === count - 1;
    if (s.kind === "shift") {
      stack.push({ id: id++, symbol: s.remaining[0], children: [], fresh: isLast });
    } else if (s.kind === "reduce" && a?.type === "reduce") {
      const p = grammar.productions[a.prod];
      const kids = p.rhs.length ? stack.splice(stack.length - p.rhs.length) : [{ id: id++, symbol: EPS, children: [] }];
      stack.push({ id: id++, symbol: p.lhs, children: kids, fresh: isLast });
    }
  }
  return stack;
}

const DX = 54;
const DY = 52;

interface Placed {
  node: TreeNode;
  x: number;
  y: number;
  children: Placed[];
}

function place(node: TreeNode, depth: number, next: { x: number }): Placed {
  if (node.children.length === 0) {
    const p = { node, x: next.x, y: depth, children: [] };
    next.x += 1;
    return p;
  }
  const children = node.children.map((c) => place(c, depth + 1, next));
  const x = (children[0].x + children[children.length - 1].x) / 2;
  return { node, x, y: depth, children };
}

function height(n: TreeNode): number {
  return 1 + Math.max(0, ...n.children.map(height));
}

export function ParseForest({ forest, grammar }: { forest: TreeNode[]; grammar: Grammar }) {
  const nts = React.useMemo(() => new Set(grammar.nonterminals), [grammar]);
  if (forest.length === 0) {
    return <div className="p-6 text-center text-xs text-fg-subtle">The parse tree grows here as tokens are shifted and handles reduced.</div>;
  }
  const maxH = Math.max(...forest.map(height));
  // Align all roots on the bottom: shorter trees start lower, like the symbol stack.
  const next = { x: 0 };
  const placed = forest.map((t) => place(t, maxH - height(t), next));
  const width = Math.max(1, next.x) * DX + 20;
  const h = maxH * DY + 10;

  const edges: React.ReactNode[] = [];
  const nodes: React.ReactNode[] = [];
  const walk = (p: Placed) => {
    const cx = 10 + p.x * DX + DX / 2;
    const cy = 22 + p.y * DY;
    for (const c of p.children) {
      edges.push(
        <line key={`${p.node.id}-${c.node.id}`} x1={cx} y1={cy + 10} x2={10 + c.x * DX + DX / 2} y2={22 + c.y * DY - 11} stroke="var(--border-strong)" strokeWidth={1.2} />,
      );
      walk(c);
    }
    const label = p.node.symbol;
    nodes.push(
      <g key={p.node.id} transform={`translate(${cx}, ${cy})`}>
        <rect
          x={-Math.max(16, label.length * 4.4 + 8)}
          y={-11}
          width={Math.max(32, label.length * 8.8 + 16)}
          height={22}
          rx={6}
          fill={p.node.fresh ? "var(--highlight-bg)" : "var(--panel-2)"}
          stroke={p.node.fresh ? "var(--accent)" : "var(--border)"}
        />
        <text textAnchor="middle" dominantBaseline="central" className={`font-mono text-[12px] ${symbolClass(label, nts)}`} fill="currentColor">
          {label}
        </text>
      </g>,
    );
  };
  placed.forEach(walk);

  return (
    <div className="overflow-auto">
      <svg width={width} height={h} className="mx-auto block">
        {edges}
        {nodes}
      </svg>
    </div>
  );
}
