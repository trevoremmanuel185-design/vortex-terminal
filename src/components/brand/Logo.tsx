import type { SVGProps } from "react";

type LogoMarkProps = SVGProps<SVGSVGElement> & {
  size?: number;
  tone?: "gradient" | "mono" | "light";
};

/**
 * VORTEX TERMINAL mark — interlocking prism with a precision crosshair and a
 * candlestick spine. Designed on a 48px grid with 2.5px strokes so it stays
 * legible at 16px (favicon) and remains crisp at 256px.
 */
export function LogoMark({ size = 32, tone = "gradient", ...props }: LogoMarkProps) {
  const id = tone === "gradient" ? "vx-logo-grad" : "vx-logo-mono";
  const stroke = tone === "mono" ? "#0E121B" : "url(#vx-logo-grad)";
  const accent = tone === "mono" ? "#0E121B" : "#06B6D4";
  const emerald = tone === "mono" ? "#0E121B" : "#10B981";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="VORTEX TERMINAL"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id={id} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="0.55" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      {/* outer diamond prism */}
      <path
        d="M24 3.6 43.2 15.3v17.4L24 44.4 4.8 32.7V15.3L24 3.6Z"
        stroke={stroke}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      {/* inner rotated prism (interlock) */}
      <path
        d="M24 11.4 34.8 18v12L24 36.6 13.2 30V18L24 11.4Z"
        stroke={accent}
        strokeOpacity={tone === "mono" ? 1 : 0.55}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* candlestick spine */}
      <path d="M24 17.2v13.6" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M20.2 21.4h7.6M20.2 27.8h7.6"
        stroke={emerald}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* crosshair ticks */}
      <path
        d="M24 3.6v4.2M24 40.2v4.2M4.8 24h4.4M38.8 24h4.4"
        stroke={accent}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity={tone === "mono" ? 1 : 0.85}
      />
      <circle cx="24" cy="24" r="1.9" fill={tone === "mono" ? "#0E121B" : "#E6EDF7"} />
    </svg>
  );
}

type LogoProps = {
  size?: number;
  tone?: "gradient" | "mono" | "light";
  showWordmark?: boolean;
  tagline?: boolean;
  className?: string;
};

export function Logo({
  size = 30,
  tone = "gradient",
  showWordmark = true,
  tagline = false,
  className = "",
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} tone={tone} />
      {showWordmark ? (
        <span className="flex flex-col leading-none">
          <span className="text-[13px] font-semibold tracking-[0.2em] text-ink">
            VORTEX<span className="ml-1.5 text-emerald">TERMINAL</span>
          </span>
          {tagline ? (
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-faint">
              Trade with precision.
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

export default Logo;
