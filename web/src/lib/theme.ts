// Appearance: a colour theme (Ocean, Purple, Sunset, Earthy, Navy, Charcoal) and light / dark /
// match-device. Ocean and light are the defaults. Saved in this browser.

export type ThemeChoice = "light" | "dark" | "system";
export type Palette = "ocean" | "purple" | "sunset" | "earthy" | "navy" | "charcoal";

export const PALETTES: { id: Palette; name: string; colours: [string, string, string] }[] = [
  { id: "ocean", name: "Ocean", colours: ["#7fd6cb", "#a9c4f7", "#fcd68f"] },
  { id: "purple", name: "Purple pop", colours: ["#c8b6fb", "#ffb8b8", "#ffdb8f"] },
  { id: "sunset", name: "Sunset", colours: ["#fdbb8f", "#f8aed6", "#fde58f"] },
  { id: "earthy", name: "Earthy", colours: ["#a9d8aa", "#f2b88f", "#f2d38c"] },
  { id: "navy", name: "Navy", colours: ["#2f4a6d", "#c4652a", "#e0b354"] },
  { id: "charcoal", name: "Charcoal", colours: ["#3a4046", "#2e7d8c", "#d8ab5a"] },
];

const MODE_KEY = "gap-year-theme";
const PALETTE_KEY = "gap-year-palette";

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable: still applies for this visit */ }
}

export function getThemeChoice(): ThemeChoice {
  const v = read(MODE_KEY);
  return v === "dark" || v === "system" ? v : "light";
}

export function getPalette(): Palette {
  const v = read(PALETTE_KEY);
  return PALETTES.some((p) => p.id === v) ? (v as Palette) : "ocean";
}

function prefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Apply the saved (or given) choices to the page. */
export function applyTheme(choice: ThemeChoice = getThemeChoice(), palette: Palette = getPalette()): void {
  const root = document.documentElement;
  const dark = choice === "dark" || (choice === "system" && prefersDark());
  root.classList.toggle("dark", dark);
  if (palette === "ocean") root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", palette);
  // Colour the phone's status bar to match.
  const bg = getComputedStyle(root).getPropertyValue("--color-cream").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg || "#e2f4f0");
}

export function setThemeChoice(choice: ThemeChoice): void {
  write(MODE_KEY, choice);
  applyTheme(choice, getPalette());
}

export function setPalette(palette: Palette): void {
  write(PALETTE_KEY, palette);
  applyTheme(getThemeChoice(), palette);
}

/** Follow the device's setting live when "Match device" is chosen. */
export function watchSystemTheme(): void {
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemeChoice() === "system") applyTheme();
  });
}
