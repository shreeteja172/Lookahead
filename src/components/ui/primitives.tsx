"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Button                                                               */
/* ------------------------------------------------------------------ */

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent/90",
        secondary: "bg-panel text-fg border border-border hover:bg-panel-2",
        ghost: "text-fg-muted hover:text-fg hover:bg-panel-2",
        outline: "border border-border text-fg hover:bg-panel-2",
        danger: "border border-danger/30 text-danger hover:bg-danger-bg",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3",
        lg: "h-10 px-4",
        icon: "h-8 w-8",
        "icon-sm": "h-7 w-7",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

/* ------------------------------------------------------------------ */
/* Badge                                                                */
/* ------------------------------------------------------------------ */

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium leading-4 whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-border bg-panel-2 text-fg-muted",
        accent: "border-accent/25 bg-highlight-bg text-accent",
        success: "border-success/25 bg-success-bg text-success",
        danger: "border-danger/25 bg-danger-bg text-danger",
        warning: "border-warning/25 bg-warning-bg text-warning",
        info: "border-accent/25 bg-highlight-bg text-accent",
        // Parser methods are labelled, not colour-coded.
        slr: "border-border bg-panel-2 text-fg-muted",
        clr: "border-border bg-panel-2 text-fg-muted",
        lalr: "border-border bg-panel-2 text-fg-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/* ------------------------------------------------------------------ */
/* Panel                                                                */
/* ------------------------------------------------------------------ */

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-panel", className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3", className)}>
      {/* Icons are accepted for API compatibility but not drawn: headers stay text-only. */}
      <div className="min-w-0" data-has-icon={icon ? "" : undefined}>
        <h3 className="text-[0.9375rem] font-semibold text-fg">{title}</h3>
        {description && <p className="mt-0.5 max-w-prose text-[0.8125rem] leading-snug text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                    */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string; className?: string }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cn("inline-flex min-w-0 max-w-full overflow-x-auto rounded-md border border-border bg-panel-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap",
            size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs sm:text-sm",
            value === o.value ? "bg-panel text-fg ring-1 ring-border" : "text-fg-muted hover:text-fg",
            value === o.value && o.className,
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                 */
/* ------------------------------------------------------------------ */

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-panel-2 px-1 font-mono text-[0.625rem] text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-8 w-full rounded-md border border-border bg-bg-elevated px-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-8 rounded-md border border-border bg-bg-elevated px-2 text-sm text-fg focus:border-accent focus:outline-none cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({
  icon,
  title,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      {icon && <div className="text-fg-subtle [&_svg]:size-5">{icon}</div>}
      <div className="text-sm font-medium text-fg">{title}</div>
      {children && <div className="max-w-md text-xs text-fg-muted">{children}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: "danger" | "success" | "default";
  hint?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="font-medium text-xs text-fg-muted">{label}</div>
      <div
        className={cn(
          "mt-0.5 font-mono text-lg font-medium tabular-nums",
          tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-fg",
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[0.6875rem] text-fg-subtle">{hint}</div>}
    </div>
  );
}
