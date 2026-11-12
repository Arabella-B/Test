import type { CSSProperties, ReactNode } from "react";

// A passport-style stamp: a slightly tilted double border with bold capitals.

const INKS = ["var(--color-brand-strong)", "var(--color-coral-strong)", "var(--color-sun-strong)"];

export default function Stamp({
  title, subtitle, icon, index = 0, size = "md", faded = false, thump = false,
}: {
  title: string; subtitle?: string; icon?: ReactNode; index?: number;
  size?: "sm" | "md" | "lg"; faded?: boolean; thump?: boolean;
}) {
  const ink = INKS[index % INKS.length];
  const tilt = [-8, 5, -3, 7, -6, 3][index % 6];
  const dims = size === "lg" ? "min-w-40 max-w-full px-5 py-4 text-2xl" : size === "sm" ? "min-w-20 px-2 py-1 text-[11px]" : "min-w-28 px-3 py-2 text-sm";
  const style: CSSProperties = {
    color: ink,
    borderColor: ink,
    ["--tilt" as string]: `${tilt}deg`,
    transform: thump ? undefined : `rotate(${tilt}deg)`,
    outline: `2px dashed ${ink}`,
    outlineOffset: size === "sm" ? "2px" : "3px",
  };
  return (
    <span
      className={`inline-flex flex-col items-center justify-center rounded-xl border-[3px] text-center font-display font-extrabold uppercase leading-tight tracking-wide ${dims} ${faded ? "opacity-35 grayscale" : "opacity-90"} ${thump ? "animate-stamp" : ""}`}
      style={style}
    >
      {icon && <span className={size === "lg" ? "text-3xl" : "text-base"}>{icon}</span>}
      <span>{title}</span>
      {subtitle && <span className="text-[0.7em] font-bold opacity-80">{subtitle}</span>}
    </span>
  );
}
