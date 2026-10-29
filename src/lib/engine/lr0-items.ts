import type { ClosureStep, Grammar, LRItem } from "./types";
import { coreKey, formatItem, symbolAfterDot } from "./items";

/**
 * LR(0) CLOSURE(I): repeatedly, for every item A → α·Bβ in I and every
 * production B → γ, add B → ·γ. Items are appended in discovery order, which
 * reproduces the textbook (Dragon book) item ordering and state numbering.
 */
export function closureLR0(g: Grammar, kernel: LRItem[]): { items: LRItem[]; steps: ClosureStep[] } {
  const items: LRItem[] = kernel.map((k) => ({ ...k, lookaheads: [], kernel: true }));
  const present = new Set(items.map(coreKey));
  const steps: ClosureStep[] = [];
  const isNT = new Set(g.nonterminals);

  for (let i = 0; i < items.length; i++) {
    const b = symbolAfterDot(g, items[i]);
    if (b === null || !isNT.has(b)) continue;
    for (const p of g.productions) {
      if (p.lhs !== b) continue;
      const item: LRItem = { prod: p.id, dot: 0, lookaheads: [], kernel: false };
      const key = coreKey(item);
      if (present.has(key)) continue;
      present.add(key);
      items.push(item);
      steps.push({
        item,
        fromIndex: i,
        reason: `The dot in ${formatItem(g, items[i])} is before nonterminal ${b}, so every ${b}-production is added with the dot at the start.`,
      });
    }
  }
  return { items, steps };
}

/** Kernel of GOTO(I, X): items of I with X after the dot, dot advanced over X. */
export function gotoKernel(g: Grammar, items: LRItem[], symbol: string): LRItem[] {
  const out: LRItem[] = [];
  for (const it of items) {
    if (symbolAfterDot(g, it) === symbol) {
      out.push({ prod: it.prod, dot: it.dot + 1, lookaheads: it.lookaheads.slice(), kernel: true });
    }
  }
  return out;
}

/** Symbols that appear immediately after a dot, in item order (deduplicated). */
export function transitionSymbols(g: Grammar, items: LRItem[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const s = symbolAfterDot(g, it);
    if (s !== null && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}
