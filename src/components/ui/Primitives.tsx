import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "emerald" | "crimson" | "amber" | "cyan" | "neutral" | "outline";

const toneClasses: Record<Tone, string> = {
  emerald: "border-emerald/35 bg-emerald/10 text-emerald",
  crimson: "border-crimson/35 bg-crimson/10 text-crimson",
  amber: "border-amber/40 bg-amber/10 text-amber",
  cyan: "border-cyan/35 bg-cyan/10 text-cyan",
  neutral: "border-hairline bg-panel-2 text-ink-muted",
  outline: "border-hairline bg-transparent text-ink-muted",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot = false,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        toneClasses[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-dot" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  icon,
  id,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  icon?: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-hairline bg-panel/90 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]",
        className,
      )}
    >
      {title ? (
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline/80 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {icon ? <span className="text-ink-faint">{icon}</span> : null}
            <div className="min-w-0">
              <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                {title}
              </h2>
              {subtitle ? (
                <p className="truncate text-[10px] text-ink-faint">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("min-h-0 flex-1 overflow-auto", bodyClassName ?? "p-3")}>{children}</div>
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "buy" | "sell" | "danger" | "warning";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary:
      "bg-emerald text-obsidian hover:bg-emerald/90 border border-emerald font-semibold shadow-[0_0_24px_-8px_rgba(16,185,129,0.8)]",
    secondary: "border border-hairline bg-panel-2 text-ink hover:border-hairline-bright hover:bg-panel-3",
    ghost: "border border-transparent text-ink-muted hover:bg-panel-2 hover:text-ink",
    buy: "bg-emerald/15 text-emerald border border-emerald/50 hover:bg-emerald/25 font-semibold",
    sell: "bg-crimson/15 text-crimson border border-crimson/50 hover:bg-crimson/25 font-semibold",
    danger: "bg-crimson text-white border border-crimson hover:bg-crimson/90 font-semibold",
    warning: "bg-amber/15 text-amber border border-amber/50 hover:bg-amber/25 font-semibold",
  };
  const sizes = {
    sm: "h-7 px-2.5 text-[11px]",
    md: "h-9 px-3.5 text-xs",
    lg: "h-11 px-5 text-sm",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "up" | "down" | "amber";
  className?: string;
}) {
  const tones = {
    neutral: "text-ink",
    up: "text-emerald",
    down: "text-crimson",
    amber: "text-amber",
  };
  return (
    <div className={cn("rounded-lg border border-hairline/70 bg-panel-2/60 px-2.5 py-2", className)}>
      <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-faint">{label}</p>
      <p className={cn("num mt-0.5 text-sm font-semibold", tones[tone])}>{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-ink-faint">{sub}</p> : null}
    </div>
  );
}

export function Progress({ value, tone = "emerald" }: { value: number; tone?: "emerald" | "crimson" | "amber" | "cyan" }) {
  const colors = {
    emerald: "bg-emerald",
    crimson: "bg-crimson",
    amber: "bg-amber",
    cyan: "bg-cyan",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-3" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-200", colors[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[10px] leading-snug text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "h-9 w-full rounded-lg border border-hairline bg-obsidian/70 px-2.5 text-xs text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-cyan/60";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-hairline bg-obsidian/60 p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]",
            value === option.value
              ? "bg-panel-3 text-ink shadow-sm"
              : "text-ink-faint hover:text-ink-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, icon }: { title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline px-4 py-6 text-center">
      {icon ? <div className="text-ink-faint">{icon}</div> : null}
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      <p className="max-w-[34ch] text-[10px] leading-relaxed text-ink-faint">{description}</p>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
        checked ? "border-emerald/60 bg-emerald/30" : "border-hairline bg-panel-3",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all",
          checked ? "left-[18px] bg-emerald" : "left-0.5 bg-ink-faint",
        )}
      />
    </button>
  );
}

export function DisclaimerNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-amber/20 bg-amber/5 px-2 py-1.5 text-[10px] leading-relaxed text-amber/90">
      {children}
    </p>
  );
}
