import type {
  Automaton,
  FirstFollowResult,
  Grammar,
  GrammarParseResult,
  MergeGroup,
  ParseTable,
  ParserMethod,
} from "./types";
import { parseGrammar, type ParseOptions } from "./grammar-parser";
import { computeFirstFollow } from "./first-follow";
import { buildCanonicalCollection, StateExplosionError } from "./automaton";
import { buildLALRFromCLR } from "./lalr-generator";
import { buildParseTable } from "./table-builder";
import { diagnoseConflicts, type ConflictDiagnosis } from "./conflict-analyzer";
import { findUnproductive, findUnreachable, findUnreachableTerminals } from "./grammar-validator";

export const METHODS: ParserMethod[] = ["SLR", "CLR", "LALR"];

export interface Analysis {
  grammar: Grammar;
  ff: FirstFollowResult;
  lr0: Automaton;
  lr1: Automaton;
  lalr: Automaton;
  mergeGroups: MergeGroup[];
  tables: Record<ParserMethod, ParseTable>;
  diagnoses: ConflictDiagnosis[];
  unreachable: string[];
  unreachableTerminals: string[];
  unproductive: string[];
  nullableProductions: number[];
  timings: Record<string, number>;
}

export interface AnalyzeResult {
  parse: GrammarParseResult;
  analysis: Analysis | null;
  error: string | null;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Runs the full pipeline on an already-parsed grammar. */
export function analyzeParsedGrammar(grammar: Grammar, maxStates?: number): Analysis {
  const timings: Record<string, number> = {};
  const time = <T>(label: string, fn: () => T): T => {
    const t0 = now();
    const r = fn();
    timings[label] = now() - t0;
    return r;
  };

  const ff = time("firstFollow", () => computeFirstFollow(grammar));
  const lr0 = time("lr0", () => buildCanonicalCollection(grammar, "LR0", ff, maxStates));
  const lr1 = time("lr1", () => buildCanonicalCollection(grammar, "LR1", ff, maxStates));
  const { automaton: lalr, groups } = time("lalr", () => buildLALRFromCLR(grammar, lr1));
  const tables = time("tables", () => ({
    SLR: buildParseTable("SLR", grammar, lr0, ff),
    CLR: buildParseTable("CLR", grammar, lr1, ff),
    LALR: buildParseTable("LALR", grammar, lalr, ff),
  }));
  const diagnoses = time("conflicts", () => diagnoseConflicts(grammar, ff, tables, groups));

  return {
    grammar,
    ff,
    lr0,
    lr1,
    lalr,
    mergeGroups: groups,
    tables,
    diagnoses,
    unreachable: findUnreachable(grammar),
    unreachableTerminals: findUnreachableTerminals(grammar),
    unproductive: findUnproductive(grammar).filter((n) => n !== grammar.augmentedStart),
    nullableProductions: grammar.productions.filter((p) => p.rhs.every((s) => ff.nullable.has(s))).map((p) => p.id),
    timings,
  };
}

/** Parses, validates and analyses grammar source text. */
export function analyzeGrammar(source: string, options: ParseOptions & { maxStates?: number } = {}): AnalyzeResult {
  const parse = parseGrammar(source, options);
  if (!parse.grammar) return { parse, analysis: null, error: null };
  try {
    return { parse, analysis: analyzeParsedGrammar(parse.grammar, options.maxStates), error: null };
  } catch (e) {
    if (e instanceof StateExplosionError) return { parse, analysis: null, error: e.message };
    throw e;
  }
}
