"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CircleCheck, CircleX, Copy, FileJson, FileSpreadsheet, ListTree, OctagonAlert, Play, TriangleAlert } from "lucide-react";
import {
  END,
  formatProduction,
  simulate,
  tokenizeInput,
  type Analysis,
  type ConflictPolicy,
  type ParserMethod,
  type SimResult,
  type SimStep,
} from "@/lib/engine";
import { useAnalysis, useStudio } from "@/lib/studio/store";
import { traceToCSV, traceToText } from "@/lib/studio/export";
import { Badge, Button, Input, Panel, PanelHeader, Segmented, Select } from "@/components/ui/primitives";
import { NeedsGrammar, PageHeader } from "@/components/studio/page-header";
import { ActionChip, METHOD_META, Sym } from "@/components/studio/symbols";
import { StepperControls, useStepper } from "@/components/studio/stepper";
import { forestAfter, ParseForest } from "@/components/studio/parse-tree";
import { cn, copyText, downloadText, slugify } from "@/lib/utils";
import { METHOD_OPTIONS } from "./automaton-view";

export function SimulateView() {
  const a = useAnalysis();
  const input = useStudio((s) => s.input);
  const setInput = useStudio((s) => s.setInput);
  const method = useStudio((s) => s.method);
  const setMethod = useStudio((s) => s.setMethod);
  const policy = useStudio((s) => s.policy);
  const setPolicy = useStudio((s) => s.setPolicy);

  const tokenized = React.useMemo(() => (a ? tokenizeInput(input, a.grammar.terminals) : null), [a, input]);
  const result = React.useMemo<SimResult | null>(() => {
    if (!a || !tokenized || tokenized.errors.length) return null;
    return simulate(a.grammar, a.tables[method], tokenized.tokens, { policy });
  }, [a, tokenized, method, policy]);

  if (!a) {
    return (
      <>
        <PageHeader title="Simulation Studio" />
        <NeedsGrammar />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Simulation Studio"
        description="Runs the table-driven shift-reduce algorithm against the selected generated table. Each row shows the configuration before the action is applied."
        actions={<Segmented value={method} onChange={setMethod} options={METHOD_OPTIONS} />}
      />
      <Panel className="mb-4">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-xs font-medium text-fg-muted">Input</span>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Tokens separated by spaces, e.g. ${a.grammar.terminals.slice(0, 3).join(" ")}`}
              className="font-mono"
              spellCheck={false}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-fg-muted" title="What to do when an ACTION cell holds more than one action">
            On conflict
            <Select value={policy} onChange={(e) => setPolicy(e.target.value as ConflictPolicy)} className="h-8 text-xs">
              <option value="halt">halt (report)</option>
              <option value="prefer-shift">prefer shift (yacc-style)</option>
            </Select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2 text-xs">
          <span className="mr-1 text-fg-subtle">Tokens:</span>
          {tokenized && tokenized.errors.length === 0 && tokenized.tokens.length === 0 && <span className="text-fg-subtle italic">empty input (only $)</span>}
          {tokenized?.tokens.map((t, i) => (
            <span key={i} className="rounded border border-border bg-panel-2 px-1.5 py-0.5">
              <Sym s={t} />
            </span>
          ))}
          {tokenized && tokenized.errors.length === 0 && (
            <span className="rounded border border-border bg-panel-2 px-1.5 py-0.5">
              <Sym s={END} />
            </span>
          )}
          {tokenized?.errors.map((e, i) => (
            <span key={i} className="flex items-center gap-1 text-conflict">
              <CircleX className="size-3.5" /> {e.message} Terminals: {a.grammar.terminals.join(" ")}
            </span>
          ))}
        </div>
      </Panel>
      {result && <Run key={`${method}|${policy}|${result.tokens.join(" ")}`} analysis={a} result={result} method={method} />}
    </>
  );
}

function Run({ analysis, result, method }: { analysis: Analysis; result: SimResult; method: ParserMethod }) {
  const g = analysis.grammar;
  const table = analysis.tables[method];
  const projectName = useStudio((s) => s.projectName);
  const s = useStepper(result.steps.length, { speedMs: 650 });
  const step = result.steps[s.index];
  const atEnd = s.index === result.steps.length - 1;
  const forest = React.useMemo(() => forestAfter(g, result.steps, s.index + (atEnd && result.outcome === "accepted" ? 1 : 0)), [g, result, s.index, atEnd]);
  const traceRef = React.useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const row = traceRef.current?.querySelector(`[data-step="${s.index}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [s.index]);

  if (!step) return null;
  const conflictFree = table.conflicts.length === 0;

  return (
    <div className="grid grid-cols-1 gap-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <StepperControls s={s} />
        </div>
        {!conflictFree && (
          <div className="flex items-center gap-2 border-t border-border bg-warning/5 px-4 py-2 text-xs text-warning">
            <TriangleAlert className="size-3.5" /> The {METHOD_META[method].label} table has {table.conflicts.length} conflicting cell(s). Parsing
            is deterministic only until one of them is consulted.
          </div>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PanelHeader
            title="Parsing trace"
            description={`${result.steps.length} steps · ${METHOD_META[method].label} table`}
            actions={
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Copy trace as text"
                  onClick={async () => {
                    if (await copyText(traceToText(result))) {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    }
                  }}
                >
                  {copied ? <Check className="text-accept" /> : <Copy />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => downloadText(`${slugify(projectName)}-${method.toLowerCase()}-trace.csv`, traceToCSV(result), "text/csv")}>
                  <FileSpreadsheet /> CSV
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadText(`${slugify(projectName)}-${method.toLowerCase()}-trace.json`, JSON.stringify(result, null, 2), "application/json")}
                >
                  <FileJson /> JSON
                </Button>
              </>
            }
          />
          <div ref={traceRef} className="max-h-[52vh] overflow-auto">
            <table className="w-full border-separate border-spacing-0 font-mono text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-panel-2 text-left text-[11px] uppercase tracking-wider text-fg-subtle">
                <tr>
                  <th className="border-b border-border px-3 py-1.5 font-sans font-medium">#</th>
                  <th className="border-b border-border px-3 py-1.5 font-sans font-medium">Stack</th>
                  <th className="border-b border-border px-3 py-1.5 text-right font-sans font-medium">Input</th>
                  <th className="border-b border-border px-3 py-1.5 font-sans font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {result.steps.map((st, i) => (
                  <tr
                    key={i}
                    data-step={i}
                    onClick={() => (s.pause(), s.go(i))}
                    className={cn(
                      "cursor-pointer transition-colors",
                      i === s.index ? "bg-highlight-bg" : i > s.index ? "opacity-35 hover:opacity-70" : "hover:bg-panel-2",
                    )}
                  >
                    <td className="border-b border-border/60 px-3 py-1 text-fg-subtle tabular-nums">{i + 1}</td>
                    <td className="border-b border-border/60 px-3 py-1 whitespace-nowrap">
                      <StackText step={st} />
                    </td>
                    <td className="border-b border-border/60 px-3 py-1 text-right whitespace-nowrap">
                      {st.remaining.map((t, k) => (
                        <React.Fragment key={k}>
                          {k > 0 && " "}
                          <Sym s={t} className={cn(k === 0 && "underline decoration-accent decoration-2 underline-offset-4")} />
                        </React.Fragment>
                      ))}
                    </td>
                    <td className="border-b border-border/60 px-3 py-1 whitespace-nowrap">
                      <StepAction step={st} analysis={analysis} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Outcome result={result} visible={atEnd} />
        </Panel>

        <div className="grid content-start gap-4">
          <Panel>
            <PanelHeader title="Current configuration" description={`Step ${s.index + 1}: state ${step.actionCell.state}, lookahead ${step.actionCell.terminal}`} />
            <div className="space-y-4 p-4">
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wider text-fg-subtle">Stack (bottom → top)</div>
                <div className="flex flex-wrap items-end gap-1">
                  <AnimatePresence initial={false}>
                    {step.stack.map((e, i) => (
                      <motion.div
                        key={`${i}-${e.state}-${e.symbol}`}
                        layout
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          "flex min-w-9 flex-col items-center rounded-md border px-1.5 py-1",
                          i === step.stack.length - 1 ? "border-accent bg-highlight-bg" : "border-border bg-panel-2",
                        )}
                      >
                        <span className="font-mono text-[12px]">{e.symbol ? <Sym s={e.symbol} /> : <span className="text-fg-subtle">⊥</span>}</span>
                        <span className="font-mono text-[11px] font-bold text-state">{e.state}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wider text-fg-subtle">Remaining input</div>
                <div className="flex flex-wrap gap-1">
                  {step.remaining.map((t, i) => (
                    <span
                      key={i}
                      className={cn(
                        "rounded-md border px-2 py-1 font-mono text-[12px]",
                        i === 0 ? "border-accent bg-highlight-bg" : "border-border bg-panel-2 opacity-70",
                      )}
                    >
                      <Sym s={t} />
                    </span>
                  ))}
                </div>
              </div>
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  step.kind === "accept"
                    ? "border-accept/40 bg-accept-bg"
                    : step.kind === "error" || step.kind === "conflict"
                      ? "border-conflict/40 bg-conflict-bg"
                      : "border-border bg-panel-2/60",
                )}
              >
                <div className="mb-1 flex items-center gap-2 font-mono text-xs">
                  ACTION[<span className="text-state">{step.actionCell.state}</span>, <Sym s={step.actionCell.terminal} />] =
                  {step.actions.length ? step.actions.map((x, k) => (
                    <React.Fragment key={k}>
                      {k > 0 && <span className="text-conflict">/</span>}
                      <ActionChip a={x} />
                    </React.Fragment>
                  )) : <span className="text-conflict">error</span>}
                </div>
                <p className="text-xs text-fg-muted">{step.description}</p>
                {step.kind === "reduce" && step.actions[0]?.type === "reduce" && (
                  <p className="mt-1.5 font-mono text-xs">
                    handle: <span className="text-reduce">{formatProduction(g.productions[step.actions[0].prod])}</span>
                  </p>
                )}
              </div>
              <TableLookup analysis={analysis} method={method} step={step} />
            </div>
          </Panel>
          <Panel>
            <PanelHeader icon={<ListTree />} title="Parse tree" description="Built bottom-up: shifts add leaves, reductions add a parent over the handle." />
            <div className="p-3">
              <ParseForest forest={forest} grammar={g} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function StackText({ step }: { step: SimStep }) {
  return (
    <>
      {step.stack.map((e, i) => (
        <React.Fragment key={i}>
          {i > 0 && " "}
          {e.symbol && (
            <>
              <Sym s={e.symbol} />{" "}
            </>
          )}
          <span className="text-state">{e.state}</span>
        </React.Fragment>
      ))}
    </>
  );
}

function StepAction({ step, analysis }: { step: SimStep; analysis: Analysis }) {
  if (step.kind === "error") return <span className="font-semibold text-conflict">error</span>;
  if (step.kind === "conflict")
    return (
      <span className="text-conflict">
        conflict {step.actions.map((a, i) => (
          <React.Fragment key={i}>
            {i > 0 && "/"}
            <ActionChip a={a} />
          </React.Fragment>
        ))}
      </span>
    );
  const a = step.actions[0];
  if (a.type === "accept") return <span className="font-semibold text-accept">accept</span>;
  if (a.type === "shift") return <span>shift <ActionChip a={a} /></span>;
  return (
    <span>
      reduce <ActionChip a={a} /> <span className="text-fg-subtle">{formatProduction(analysis.grammar.productions[a.prod])}</span>
    </span>
  );
}

function Outcome({ result, visible }: { result: SimResult; visible: boolean }) {
  const ok = result.outcome === "accepted";
  const Icon = ok ? CircleCheck : result.outcome === "conflict" ? OctagonAlert : CircleX;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={cn("border-t px-4 py-3 text-sm", ok ? "border-accept/30 bg-accept-bg" : "border-conflict/30 bg-conflict-bg")}
        >
          <div className={cn("flex items-center gap-2 font-semibold", ok ? "text-accept" : "text-conflict")}>
            <Icon className="size-4" />
            {ok ? "Accepted" : result.outcome === "conflict" ? "Stopped at a conflict" : result.outcome === "step-limit" ? "Step limit reached" : "Rejected"}
          </div>
          <p className="mt-0.5 text-xs text-fg-muted">{result.message}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The ACTION row consulted in this step (and the GOTO row after a reduction), with the cell highlighted. */
function TableLookup({ analysis, method, step }: { analysis: Analysis; method: ParserMethod; step: SimStep }) {
  const t = analysis.tables[method];
  const st = step.actionCell.state;
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-fg-subtle">Table lookup</div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-max min-w-full font-mono text-[12px]">
          <thead className="bg-panel-2">
            <tr>
              <th className="px-2 py-1 text-left text-[10px] font-sans font-medium text-fg-subtle">ACTION</th>
              {t.terminals.map((x) => (
                <th key={x} className={cn("px-2 py-1", x === step.actionCell.terminal && "bg-accent/20")}>
                  <Sym s={x} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-2 py-1 font-semibold text-state">{st}</td>
              {t.terminals.map((x) => {
                const es = t.action[st].get(x);
                const hit = x === step.actionCell.terminal;
                return (
                  <td
                    key={x}
                    className={cn(
                      "px-2 py-1 text-center",
                      hit && (es ? (es.length > 1 ? "bg-conflict/25 ring-2 ring-inset ring-conflict" : "bg-accent/20 ring-2 ring-inset ring-accent") : "bg-conflict/25 ring-2 ring-inset ring-conflict"),
                    )}
                  >
                    {es?.map((e, k) => (
                      <React.Fragment key={k}>
                        {k > 0 && "/"}
                        <ActionChip a={e.action} />
                      </React.Fragment>
                    )) ?? (hit ? <span className="text-conflict">∅</span> : "")}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {step.gotoCell && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-max min-w-full font-mono text-[12px]">
            <thead className="bg-panel-2">
              <tr>
                <th className="px-2 py-1 text-left text-[10px] font-sans font-medium text-fg-subtle">GOTO</th>
                {t.nonterminals.map((x) => (
                  <th key={x} className={cn("px-2 py-1", x === step.gotoCell!.nonterminal && "bg-accent/20")}>
                    <Sym s={x} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1 font-semibold text-state">{step.gotoCell.state}</td>
                {t.nonterminals.map((x) => (
                  <td
                    key={x}
                    className={cn("px-2 py-1 text-center text-state", x === step.gotoCell!.nonterminal && "bg-accent/20 ring-2 ring-inset ring-accent")}
                  >
                    {t.goto[step.gotoCell!.state].get(x)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
        <Play className="size-3" /> {step.kind === "reduce" ? "After popping the handle, the exposed state's GOTO entry decides the next state." : "The top state and lookahead select one ACTION cell."}
      </p>
      <Badge tone={METHOD_META[method].tone}>{METHOD_META[method].label}</Badge>
    </div>
  );
}
