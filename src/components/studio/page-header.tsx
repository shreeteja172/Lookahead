"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleAlert, FileCode2 } from "lucide-react";
import { useStudio } from "@/lib/studio/store";
import { Button, EmptyState, Panel } from "@/components/ui/primitives";
import { NAV } from "./nav";

const STEPS = NAV.filter((n) => n.step);

export function PageHeader({
  title,
  description,
  actions,
  step,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Position in the grammar → parse teaching sequence. */
  step?: number;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {step && (
          <div className="mb-1 text-xs font-medium text-fg-muted">
            Step {step} of {STEPS.length}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-[0.9375rem] leading-relaxed text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Previous / next links at the end of each step page. */
export function StepNav({ step }: { step: number }) {
  const prev = STEPS.find((n) => n.step === step - 1);
  const next = STEPS.find((n) => n.step === step + 1);
  return (
    <nav aria-label="Teaching sequence" className="mt-8 flex items-stretch justify-between gap-3 border-t border-border pt-5">
      {prev ? (
        <Link href={prev.href} className="group rounded-md px-3 py-2 hover:bg-panel-2">
          <div className="flex items-center gap-1 text-xs text-fg-muted">
            <ArrowLeft className="size-3" /> Step {prev.step}
          </div>
          <div className="text-sm font-medium">{prev.label}</div>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className="group rounded-md px-3 py-2 text-right hover:bg-panel-2">
          <div className="flex items-center justify-end gap-1 text-xs text-fg-muted">
            Step {next.step} <ArrowRight className="size-3" />
          </div>
          <div className="text-sm font-medium">{next.label}</div>
        </Link>
      )}
    </nav>
  );
}

/** Shown by analysis views when the current grammar cannot be analysed. */
export function NeedsGrammar() {
  const result = useStudio((s) => s.result);
  const errors = result.parse.diagnostics.filter((d) => d.severity === "error");
  return (
    <Panel>
      <EmptyState icon={<CircleAlert />} title={result.error ? "Construction stopped" : "The grammar has errors"}>
        <p>{result.error ?? `Fix ${errors.length} error${errors.length === 1 ? "" : "s"} on the Grammar page to generate parsers.`}</p>
        {errors.slice(0, 3).map((e, i) => (
          <p key={i} className="mt-1 font-mono text-danger">
            {e.line ? `line ${e.line}: ` : ""}
            {e.message}
          </p>
        ))}
        <Link href="/grammar">
          <Button variant="primary" size="sm" className="mt-4">
            <FileCode2 /> Open the Grammar page
          </Button>
        </Link>
      </EmptyState>
    </Panel>
  );
}
