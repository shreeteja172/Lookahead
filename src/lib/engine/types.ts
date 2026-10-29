/**
 * Core data types for the LR parsing engine.
 *
 * The engine is framework-independent: nothing in `src/lib/engine` imports
 * React or browser APIs, so every algorithm can be unit-tested in isolation.
 *
 * Identity rules:
 *  - Productions are identified by their numeric `id` (0 is always the
 *    augmented production S' → S). The same numbering is shared by the SLR,
 *    CLR and LALR tables, the simulator and every UI view.
 *  - Parser states are identified by their numeric `id` inside an automaton.
 *  - Grammar symbols are plain strings; the reserved strings below are never
 *    valid user symbols.
 */

/** End-of-input marker. */
export const END = "$";
/** Internal epsilon marker used inside FIRST sets. */
export const EPS = "ε";

export type Severity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: Severity;
  /** 1-based source line, or 0 when the diagnostic is grammar-wide. */
  line: number;
  code: string;
  message: string;
  hint?: string;
}

export interface Production {
  /** Stable production number. 0 = augmented production. */
  id: number;
  lhs: string;
  /** Right-hand side symbols. An empty array means an ε-production. */
  rhs: string[];
  /** 1-based source line the production came from (0 for the augmented one). */
  line: number;
}

export interface Grammar {
  /** All productions; productions[0] is the augmented S' → S. */
  productions: Production[];
  /** Nonterminals in order of first definition, augmented start first. */
  nonterminals: string[];
  /** Terminals in order of first appearance (excludes `$`). */
  terminals: string[];
  /** User start symbol. */
  start: string;
  /** Fresh augmented start symbol (e.g. E'). */
  augmentedStart: string;
}

export interface GrammarParseResult {
  grammar: Grammar | null;
  diagnostics: Diagnostic[];
  /** Symbols declared through `%token`. */
  declaredTerminals: string[];
}

/* ------------------------------------------------------------------ */
/* FIRST / FOLLOW                                                       */
/* ------------------------------------------------------------------ */

export type SetKind = "NULLABLE" | "FIRST" | "FOLLOW";

export interface SetStep {
  index: number;
  pass: number;
  kind: SetKind;
  /** Nonterminal whose set changed. */
  target: string;
  /** Symbols added in this step (for NULLABLE: [ε]). */
  added: string[];
  /** Production responsible for the change. */
  productionId: number;
  /** Human-readable justification. */
  reason: string;
  /** Where the symbols came from, for dependency highlighting. */
  source:
    | { type: "terminal"; symbol: string }
    | { type: "first"; symbols: string[] }
    | { type: "follow"; symbol: string }
    | { type: "end" }
    | { type: "epsilon" };
}

export interface FirstFollowResult {
  nullable: Set<string>;
  /** FIRST for every symbol (terminals map to themselves). May contain EPS. */
  first: Map<string, Set<string>>;
  /** FOLLOW for every nonterminal (including augmented start). */
  follow: Map<string, Set<string>>;
  steps: SetStep[];
  passes: { nullable: number; first: number; follow: number };
}

/* ------------------------------------------------------------------ */
/* Items, states, automata                                              */
/* ------------------------------------------------------------------ */

export interface LRItem {
  prod: number;
  dot: number;
  /** Sorted lookahead set; empty for LR(0) items. */
  lookaheads: string[];
  /** True for kernel items (dot > 0, or the initial augmented item). */
  kernel: boolean;
}

export interface LRState {
  id: number;
  items: LRItem[];
  /** symbol → target state id, in insertion order. */
  transitions: Map<string, number>;
  /** For LALR states: the canonical LR(1) state ids merged into this one. */
  mergedFrom?: number[];
  /** Key of the LR(0) core (identical cores ⇔ same key). */
  coreKey: string;
}

export interface Transition {
  from: number;
  symbol: string;
  to: number;
}

export type AutomatonKind = "LR0" | "LR1" | "LALR1";

export interface ClosureStep {
  /** Item added (with lookaheads if LR(1)). */
  item: LRItem;
  /** Index (in the growing item list) of the item that caused the addition. */
  fromIndex: number;
  /** Lookaheads newly added to an already-present core (LR(1) only). */
  newLookaheads?: string[];
  reason: string;
}

export type ConstructionEvent =
  | {
      type: "create";
      state: number;
      /** How the state was reached; absent for the initial state. */
      via?: { from: number; symbol: string };
      kernel: LRItem[];
      closure: ClosureStep[];
    }
  | { type: "goto-existing"; from: number; symbol: string; to: number };

export interface Automaton {
  kind: AutomatonKind;
  states: LRState[];
  transitions: Transition[];
  /** Ordered log of how the canonical collection was built. */
  events: ConstructionEvent[];
}

export interface MergeGroup {
  lalrState: number;
  clrStates: number[];
  coreKey: string;
  /** Per item core: lookaheads contributed by each CLR state. */
  lookaheadOrigins: { prod: number; dot: number; byState: Record<number, string[]> }[];
}

/* ------------------------------------------------------------------ */
/* Tables                                                               */
/* ------------------------------------------------------------------ */

export type ParserMethod = "SLR" | "CLR" | "LALR";

export type Action =
  | { type: "shift"; state: number }
  | { type: "reduce"; prod: number }
  | { type: "accept" };

export interface ActionEntry {
  action: Action;
  /** Index of the responsible item within the state's item list. */
  itemIndex: number;
  /** Why the action was inserted. */
  reason: string;
}

export type ConflictType = "shift-reduce" | "reduce-reduce";

export interface Conflict {
  id: string;
  method: ParserMethod;
  state: number;
  terminal: string;
  type: ConflictType;
  entries: ActionEntry[];
}

export interface ParseTable {
  method: ParserMethod;
  automaton: Automaton;
  /** Column order for ACTION (terminals + `$`). */
  terminals: string[];
  /** Column order for GOTO (user nonterminals, augmented start excluded). */
  nonterminals: string[];
  /** action[state][terminal] → entries (length > 1 means a conflict). */
  action: Map<string, ActionEntry[]>[];
  /** goto[state][nonterminal] → target state. */
  goto: Map<string, number>[];
  conflicts: Conflict[];
  /** Ordered log of table insertions for the algorithm explorer. */
  insertions: { state: number; symbol: string; entry: ActionEntry | null; gotoTarget?: number }[];
}

/* ------------------------------------------------------------------ */
/* Simulation                                                           */
/* ------------------------------------------------------------------ */

export type ConflictPolicy = "halt" | "prefer-shift";

export interface ParseTreeNode {
  id: number;
  symbol: string;
  /** Terminal lexeme for leaves; undefined for nonterminal nodes. */
  token?: string;
  children: ParseTreeNode[];
  /** Production used to build this node (nonterminals only). */
  prod?: number;
}

export interface StackEntry {
  state: number;
  /** Symbol that was pushed with this state (absent for the bottom state). */
  symbol?: string;
}

export type StepKind = "shift" | "reduce" | "accept" | "error" | "conflict";

export interface SimStep {
  index: number;
  stack: StackEntry[];
  /** Remaining input including the trailing `$`. */
  remaining: string[];
  kind: StepKind;
  /** ACTION cell consulted. */
  actionCell: { state: number; terminal: string };
  /** GOTO cell consulted after a reduction. */
  gotoCell?: { state: number; nonterminal: string; target: number | null };
  /** The action applied (or the competing actions for conflicts). */
  actions: Action[];
  description: string;
}

export type SimOutcome = "accepted" | "rejected" | "conflict" | "step-limit" | "invalid-input";

export interface SimResult {
  method: ParserMethod;
  tokens: string[];
  steps: SimStep[];
  outcome: SimOutcome;
  message: string;
  tree: ParseTreeNode | null;
}

export interface TokenizeResult {
  tokens: string[];
  errors: { token: string; position: number; message: string }[];
}
