import { describe, expect, it } from "vitest";
import { analyzeGrammar, SAMPLES } from "@/lib/engine";
import { layoutGraph } from "../automaton-layout";

/** Rough per-state box, varied by item count and longest item so heights and widths differ. */
function sizesFor(states: { id: number; items: { prod: number }[] }[], kernelOnly: boolean) {
  return new Map(
    states.map((s) => {
      const n = kernelOnly ? Math.max(1, Math.ceil(s.items.length / 3)) : s.items.length;
      return [String(s.id), { width: 100 + (s.id % 4) * 30, height: 34 + n * 24 }];
    }),
  );
}

describe("automaton layout", () => {
  it("returns top-left corners, not centres", () => {
    const a = analyzeGrammar("S -> C C\nC -> c C | d").analysis!;
    const sizes = sizesFor(a.lr0.states, false);
    const boxes = layoutGraph(a.lr0, sizes);
    // With a 24px margin nothing may start left of or above it; returning centres
    // instead of corners would push boxes past the margin by half their size.
    expect(Math.min(...[...boxes.values()].map((b) => b.x))).toBeGreaterThanOrEqual(24 - 1e-6);
    expect(Math.min(...[...boxes.values()].map((b) => b.y))).toBeGreaterThanOrEqual(24 - 1e-6);
    // The input sizes are not mutated by the layout engine.
    expect(Object.keys(sizes.get("0")!)).toEqual(["width", "height"]);
  });

  for (const sample of SAMPLES) {
    it(`never overlaps states: ${sample.title}`, () => {
      const a = analyzeGrammar(sample.source).analysis!;
      for (const automaton of [a.lr0, a.lr1, a.lalr]) {
        for (const kernelOnly of [false, true]) {
          const boxes = [...layoutGraph(automaton, sizesFor(automaton.states, kernelOnly)).entries()];
          for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
              const [ia, p] = boxes[i];
              const [ib, q] = boxes[j];
              const overlap = p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
              expect(overlap, `${automaton.kind} I${ia} overlaps I${ib}`).toBe(false);
            }
          }
        }
      }
    });
  }
});
