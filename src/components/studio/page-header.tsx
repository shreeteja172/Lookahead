"use client";

import * as React from "react";
import Link from "next/link";
import { CircleAlert, FileCode2 } from "lucide-react";
import { useStudio } from "@/lib/studio/store";
import { Button, EmptyState, Panel } from "@/components/ui/primitives";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Shown by analysis views when the current grammar cannot be analysed. */
export function NeedsGrammar() {
  const result = useStudio((s) => s.result);
  const errors = result.parse.diagnostics.filter((d) => d.severity === "error");
  return (
    <Panel>
      <EmptyState icon={<CircleAlert />} title={result.error ? "Construction stopped" : "The grammar has errors"}>
        <p>{result.error ?? `Fix ${errors.length} error${errors.length === 1 ? "" : "s"} in the grammar workbench to generate parsers.`}</p>
        {errors.slice(0, 3).map((e, i) => (
          <p key={i} className="mt-1 font-mono text-danger">
            {e.line ? `line ${e.line}: ` : ""}
            {e.message}
          </p>
        ))}
        <Link href="/grammar">
          <Button variant="primary" size="sm" className="mt-4">
            <FileCode2 /> Open Grammar Workbench
          </Button>
        </Link>
      </EmptyState>
    </Panel>
  );
}
