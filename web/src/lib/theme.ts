// Light / dark / match-device appearance. Bright (light) is the default.
// The choice is a simple display preference, saved in this browser.

export type ThemeChoice = "light" | "dark" | "system";

const KEY = "gap-year-theme";

export function getThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

function prefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Apply a choice to the page (adds or removes the "dark" class on <html>). */
export function applyTheme(choice: ThemeChoice = getThemeChoice()): void {
  const dark = choice === "dark" || (choice === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#13111a" : "#7C3AED");
}

export function setThemeChoice(choice: ThemeChoice): void {
  try { localStorage.setItem(KEY, choice); } catch { /* storage unavailable: still applies for this visit */ }
  applyTheme(choice);
}

/** Follow the device's setting live when "Match device" is chosen. */
export function watchSystemTheme(): void {
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemeChoice() === "system") applyTheme("system");
  });
}
