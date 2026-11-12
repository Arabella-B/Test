// The Wayfund logo: a sticker with a winding path that turns into a £ sign.
// Drawn in the current theme's colours.

export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="2.5" y="2.5" width="59" height="59" rx="19" fill="var(--color-brand)" stroke="var(--color-cream)" strokeWidth="3" />
      <path d="M13 50 C 21 51, 22 40, 29 39 S 35 34, 30.5 28.5" fill="none" stroke="var(--color-on-brand)" strokeWidth="3.4"
        strokeLinecap="round" strokeDasharray="0.1 6.5" />
      <circle cx="13" cy="50" r="3.6" fill="var(--color-sun)" />
      <text x="44" y="31" textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-display)" fontWeight="800"
        fontSize="27" fill="var(--color-on-brand)">£</text>
    </svg>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} className="shrink-0 -rotate-6 drop-shadow-sm" />
      <span className="font-display text-xl font-extrabold tracking-tight" style={{ fontSize: size * 0.6 }}>Wayfund</span>
    </span>
  );
}
