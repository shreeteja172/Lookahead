import type {
  Automaton,
  AutomatonKind,
  ClosureStep,
  ConstructionEvent,
  FirstFollowResult,
  Grammar,
  LRItem,
  LRState,
  Transition,
} from "./types";
import { END } from "./types";
import { kernelKey } from "./items";
import { closureLR0, gotoKernel, transitionSymbols } from "./lr0-items";
import { closureLR1, normalizeKernelLR1 } from "./lr1-items";

export const DEFAULT_MAX_STATES = 4000;

export class StateExplosionError extends Error {
  constructor(public readonly limit: number) {
    super(`The canonical collection exceeded ${limit} states; construction was stopped to keep the app responsive.`);
  }
}

/**
 * Builds the canonical collection of item sets with a breadth-first worklist.
 *
 *   C := { CLOSURE({[S' → ·S]}) }            (LR(1): [S' → ·S, $])
 *   for each state I in C (in creation order)
 *     for each grammar symbol X after a dot in I (in item order)
 *       J := GOTO(I, X); add J to C if new; record the transition I –X→ J
 *
 * States are identified by their kernel (with lookaheads for LR(1)), so the
 * construction is deterministic and matches textbook numbering.
 */
export function buildCanonicalCollection(
  g: Grammar,
  kind: Extract<AutomatonKind, "LR0" | "LR1">,
  ff: FirstFollowResult,
  maxStates = DEFAULT_MAX_STATES,
): Automaton {
  const lr1 = kind === "LR1";
  const states: LRState[] = [];
  const transitions: Transition[] = [];
  const events: ConstructionEvent[] = [];
  const byKernel = new Map<string, number>();

  const close = (kernel: LRItem[]): { items: LRItem[]; steps: ClosureStep[] } =>
    lr1 ? closureLR1(g, kernel, ff) : closureLR0(g, kernel);

  const create = (kernel: LRItem[], via?: { from: number; symbol: string }): number => {
    if (states.length >= maxStates) throw new StateExplosionError(maxStates);
    const { items, steps } = close(kernel);
    const id = states.length;
    states.push({ id, items, transitions: new Map(), coreKey: kernelKey(kernel, false) });
    byKernel.set(kernelKey(kernel, lr1), id);
    events.push({ type: "create", state: id, via, kernel: kernel.map((k) => ({ ...k })), closure: steps });
    return id;
  };

  create([{ prod: 0, dot: 0, lookaheads: lr1 ? [END] : [], kernel: true }]);

  for (let s = 0; s < states.length; s++) {
    const state = states[s];
    for (const x of transitionSymbols(g, state.items)) {
      let kernel = gotoKernel(g, state.items, x);
      if (lr1) kernel = normalizeKernelLR1(g, kernel);
      const key = kernelKey(kernel, lr1);
      let target = byKernel.get(key);
      if (target === undefined) {
        target = create(kernel, { from: s, symbol: x });
      } else {
        events.push({ type: "goto-existing", from: s, symbol: x, to: target });
      }
      state.transitions.set(x, target);
      transitions.push({ from: s, symbol: x, to: target });
    }
  }

  return { kind, states, transitions, events };
}
