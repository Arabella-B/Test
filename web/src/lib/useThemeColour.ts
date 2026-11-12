import { useEffect, useState } from "react";

// Charts draw with real colour values (not CSS variables), so this reads a theme
// colour and updates it when you switch theme or brightness.

function read(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function useThemeColours<T extends string>(names: T[]): Record<T, string> {
  const get = () => Object.fromEntries(names.map((n) => [n, read(`--color-${n}`)])) as Record<T, string>;
  const [colours, setColours] = useState(get);
  useEffect(() => {
    const observer = new MutationObserver(() => setColours(get()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-palette"] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- names are fixed per call site
  }, []);
  return colours;
}
