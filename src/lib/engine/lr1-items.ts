import type { ClosureStep, FirstFollowResult, Grammar, LRItem } from "./types";
import { EPS } from "./types";
import { coreKey, formatItem, symbolAfterDot } from "./items";
import { firstOfSequence, sortSymbols } from "./first-follow";

/**
 * LR(1) CLOSURE(I): for every item [A → α·Bβ, a] in I, every production
 * B → γ and every terminal b ∈ FIRST(βa), add [B → ·γ, b].
 *
 * Items sharing a core are stored once with a lookahead *set*; when new
 * lookaheads reach an existing core they are propagated again through a
 * worklist, so the result is the full fixed point.
 */
export function closureLR1(
  g: Grammar,
  kernel: LRItem[],
  ff: FirstFollowResult,
): { items: LRItem[]; steps: ClosureStep[] } {
  const order = [...g.terminals];
  const isNT = new Set(g.nonterminals);
  const items: LRItem[] = kernel.map((k) => ({ ...k, lookaheads: k.lookaheads.slice(), kernel: true }));
  const sets: Set<string>[] = items.map((it) => new Set(it.lookaheads));
  const index = new Map(items.map((it, i) => [coreKey(it), i]));
  const steps: ClosureStep[] = [];

  const queue: { i: number; las: string[] }[] = items.map((it, i) => ({ i, las: it.lookaheads }));
  while (queue.length) {
    const { i, las } = queue.shift()!;
    const src = items[i];
    const b = symbolAfterDot(g, src);
    if (b === null || !isNT.has(b)) continue;
    const beta = g.productions[src.prod].rhs.slice(src.dot + 1);
    const fb = firstOfSequence(beta, ff.first, ff.nullable);
    const generated = new Set<string>();
    for (const a of fb) if (a !== EPS) generated.add(a);
    if (fb.has(EPS)) for (const a of las) generated.add(a);
    const betaText = beta.length ? beta.join(" ") : "ε";

    for (const p of g.productions) {
      if (p.lhs !== b) continue;
      const key = `${p.id}.0`;
      const existing = index.get(key);
      if (existing === undefined) {
        const lookaheads = sortSymbols(generated, order);
        const item: LRItem = { prod: p.id, dot: 0, lookaheads, kernel: false };
        index.set(key, items.length);
        items.push(item);
        sets.push(new Set(lookaheads));
        steps.push({
          item: { ...item, lookaheads: lookaheads.slice() },
          fromIndex: i,
          reason: `From ${formatItem(g, { ...src, lookaheads: sortSymbols(las, order) })}: the dot is before ${b}; lookaheads = FIRST(${betaText} a) for a ∈ {${sortSymbols(las, order).join(", ")}} = {${lookaheads.join(", ")}}.`,
        });
        queue.push({ i: items.length - 1, las: lookaheads });
      } else {
        const set = sets[existing];
        const fresh = [...generated].filter((a) => !set.has(a));
        if (fresh.length === 0) continue;
        fresh.forEach((a) => set.add(a));
        items[existing].lookaheads = sortSymbols(set, order);
        const freshSorted = sortSymbols(fresh, order);
        steps.push({
          item: { ...items[existing], lookaheads: items[existing].lookaheads.slice() },
          fromIndex: i,
          newLookaheads: freshSorted,
          reason: `${formatItem(g, { ...items[existing], lookaheads: [] })} is already present; ${formatItem(g, { ...src, lookaheads: sortSymbols(las, order) })} contributes new lookaheads {${freshSorted.join(", ")}}.`,
        });
        queue.push({ i: existing, las: fresh });
      }
    }
  }
  return { items, steps };
}

/** Merges duplicate cores in a GOTO kernel (possible when several items advance to the same core). */
export function normalizeKernelLR1(g: Grammar, kernel: LRItem[]): LRItem[] {
  const order = [...g.terminals];
  const map = new Map<string, LRItem>();
  for (const k of kernel) {
    const key = coreKey(k);
    const prev = map.get(key);
    if (prev) prev.lookaheads = sortSymbols(new Set([...prev.lookaheads, ...k.lookaheads]), order);
    else map.set(key, { ...k, lookaheads: sortSymbols(new Set(k.lookaheads), order) });
  }
  return [...map.values()];
}
