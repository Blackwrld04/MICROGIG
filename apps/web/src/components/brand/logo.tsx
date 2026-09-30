import { cn } from "@/lib/utils";

type Tone = "light" | "dark";

const TONES: Record<Tone, { bracket: string; square: string; text: string }> = {
  // On light surfaces: charcoal brackets, darker brand green square.
  light: { bracket: "#222325", square: "#13A06F", text: "text-brand-ink" },
  // On dark surfaces: white brackets, PRD primary green square.
  dark: { bracket: "#FFFFFF", square: "#1DBF73", text: "text-white" },
};

interface LogoMarkProps {
  size?: number;
  tone?: Tone;
  className?: string;
  title?: string;
}

/** The bracketed-square mark. Geometry traced from the brand sheet on a 27-unit grid. */
export function LogoMark({ size = 28, tone = "light", className, title }: LogoMarkProps) {
  const { bracket, square } = TONES[tone];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 27 27"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path d="M0 1a1 1 0 0 1 1-1h9.2v3H3v7.2H0z" fill={bracket} />
      <path d="M27 26a1 1 0 0 1-1 1h-9.2v-3H24v-7.2h3z" fill={bracket} />
      <rect x="8" y="8" width="11" height="11" rx="1" fill={square} />
    </svg>
  );
}

interface LogoProps {
  tone?: Tone;
  markSize?: number;
  className?: string;
}

/** Horizontal lockup used in the site header (28px mark per the brand sheet). */
export function Logo({ tone = "light", markSize = 28, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={markSize} tone={tone} />
      <span
        className={cn("text-xl font-bold lowercase leading-none tracking-tight", TONES[tone].text)}
      >
        microgig
      </span>
    </span>
  );
}
