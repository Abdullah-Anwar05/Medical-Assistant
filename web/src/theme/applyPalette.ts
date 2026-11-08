import { paletteCssVariables } from '@medipath/client-core';

/** Publishes the shared palette as `--color-*` custom properties on :root (styles.css consumes them). */
export function applyPalette(root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(paletteCssVariables())) root.style.setProperty(name, value);
}
