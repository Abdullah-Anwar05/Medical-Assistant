/**
 * Design-token palette shared by web and mobile: deep navy / teal, white, pale neutrals.
 * Contrast (WCAG 2.2 AA, against white unless noted): navy900 ≈ 15:1 · teal700 ≈ 6:1 · ink600 ≈ 7.5:1 ·
 * error ≈ 6.4:1 · white on navy900 ≈ 15:1 · white on teal700 ≈ 6:1 · border ≥ 3:1 (non-text, 1.4.11).
 */
export const palette = {
  navy900: '#0b2545',
  navy700: '#13315c',
  teal700: '#0f6e6e',
  teal800: '#0b5555',
  teal50: '#e6f4f3',
  white: '#ffffff',
  neutral50: '#f7f8fa',
  neutral200: '#e2e6ec',
  ink900: '#1a202c',
  ink600: '#4a5568',
  border: '#6b7686',
  error: '#b42318',
  errorBg: '#fdecea',
  focus: '#f2a900',
} as const;

export type PaletteToken = keyof typeof palette;

/** `navy900` → `--color-navy-900`: CSS custom property names for web. */
export function paletteCssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [token, value] of Object.entries(palette)) {
    const kebab = token.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();
    vars[`--color-${kebab}`] = value;
  }
  return vars;
}
