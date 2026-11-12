// Confetti and a celebration message, for milestones (checklist done, back on budget,
// first import, a new country). Made with plain page elements: no extra libraries.
// Skipped automatically if the device asks for reduced motion.

const COLOURS = ["--color-brand", "--color-coral", "--color-sun", "--color-brand-strong", "--color-coral-strong"];

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function celebrate(message?: string): void {
  const root = document.documentElement;
  const colours = COLOURS.map((c) => getComputedStyle(root).getPropertyValue(c).trim()).filter(Boolean);

  if (message) showMessage(message);
  if (reducedMotion()) return;

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "100", overflow: "hidden" });
  document.body.appendChild(layer);

  const pieces = 90;
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement("span");
    const size = 6 + Math.random() * 8;
    const startX = 50 + (Math.random() - 0.5) * 30; // burst from near the middle
    const drift = (Math.random() - 0.5) * 120;
    const fall = 70 + Math.random() * 40;
    const spin = (Math.random() - 0.5) * 1080;
    Object.assign(piece.style, {
      position: "absolute",
      left: `${startX}vw`,
      top: "35vh",
      width: `${size}px`,
      height: `${size * (Math.random() > 0.5 ? 0.45 : 1)}px`,
      background: colours[i % colours.length],
      borderRadius: Math.random() > 0.6 ? "50%" : "2px",
    });
    layer.appendChild(piece);
    piece.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${drift * 0.6}vw, -${18 + Math.random() * 20}vh) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${drift}vw, ${fall}vh) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 1800 + Math.random() * 1200, easing: "cubic-bezier(0.2, 0.7, 0.4, 1)", fill: "forwards" },
    );
  }
  setTimeout(() => layer.remove(), 3200);
}

function showMessage(text: string): void {
  const box = document.createElement("div");
  box.setAttribute("role", "status");
  box.textContent = text;
  Object.assign(box.style, {
    position: "fixed",
    left: "50%",
    top: "max(1rem, env(safe-area-inset-top))",
    transform: "translateX(-50%)",
    zIndex: "101",
    width: "max-content",
    maxWidth: "min(26rem, calc(100vw - 2rem))",
    padding: "0.85rem 1.25rem",
    borderRadius: "1.25rem",
    background: "var(--color-brand)",
    color: "var(--color-on-brand)",
    fontFamily: "var(--font-display)",
    fontWeight: "800",
    fontSize: "1.05rem",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  });
  document.body.appendChild(box);
  if (!reducedMotion()) {
    box.animate(
      [{ transform: "translate(-50%, -140%)", opacity: 0 }, { transform: "translate(-50%, 0)", opacity: 1 }],
      { duration: 420, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.3)", fill: "both" },
    );
  }
  setTimeout(() => {
    const out = box.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
    if (out) out.onfinish = () => box.remove();
    else box.remove();
  }, 3600);
}

/** Remember that a one-off celebration has happened (per account), so it isn't repeated. */
export function once(scope: string, key: string): boolean {
  const name = `wayfund-celebrated-${scope}-${key}`;
  try {
    if (localStorage.getItem(name)) return false;
    localStorage.setItem(name, new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}
