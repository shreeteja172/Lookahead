import type { Grammar, LRItem } from "./types";
import { EPS } from "./types";

/** Identity of an item's LR(0) core. */
export const coreKey = (item: Pick<LRItem, "prod" | "dot">): string => `${item.prod}.${item.dot}`;

/** Identity of an LR(1) item including its lookahead set. */
export const fullItemKey = (item: LRItem): string => `${item.prod}.${item.dot}[${item.lookaheads.join(",")}]`;

/** Symbol immediately after the dot, or null when the item is complete. */
export function symbolAfterDot(g: Grammar, item: Pick<LRItem, "prod" | "dot">): string | null {
  const rhs = g.productions[item.prod].rhs;
  return item.dot < rhs.length ? rhs[item.dot] : null;
}

export function isComplete(g: Grammar, item: Pick<LRItem, "prod" | "dot">): boolean {
  return item.dot >= g.productions[item.prod].rhs.length;
}

/**
 * Canonical key for a set of kernel items. Two states are the same state iff
 * their kernels are equal, so the key is order-independent.
 */
export function kernelKey(kernel: LRItem[], withLookaheads: boolean): string {
  return kernel
    .map((it) => (withLookaheads ? fullItemKey(it) : coreKey(it)))
    .sort()
    .join("|");
}

/** "E → E · + T" with optional ", +/$" lookaheads. */
export function formatItem(g: Grammar, item: LRItem, opts: { lookaheads?: boolean } = {}): string {
  const p = g.productions[item.prod];
  const parts = p.rhs.slice();
  parts.splice(item.dot, 0, "·");
  const body = p.rhs.length === 0 ? "·" : parts.join(" ");
  const la = opts.lookaheads !== false && item.lookaheads.length ? `, ${item.lookaheads.join(" / ")}` : "";
  return `${p.lhs} → ${body}${la}`;
}

export function itemParts(g: Grammar, item: LRItem): { lhs: string; before: string[]; after: string[] } {
  const p = g.productions[item.prod];
  return { lhs: p.lhs, before: p.rhs.slice(0, item.dot), after: p.rhs.slice(item.dot) };
}

export { EPS };
