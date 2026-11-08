// Deep navy / teal on white and pale neutrals. Text pairs meet WCAG AA (4.5:1) on their backgrounds.
export const colors = {
  navy: '#0B2545', // primary text, headings, primary button (≈15:1 on white)
  teal: '#0E7C7B', // accents, links (≈4.9:1 on white)
  tealDark: '#0A5E5D',
  white: '#FFFFFF',
  canvas: '#F5F7F9', // pale neutral background
  border: '#5B6B7C', // input borders (≥3:1 non-text contrast)
  muted: '#4A5A6A', // secondary text (≈6.6:1 on white)
  error: '#B3261E', // (≈6.5:1 on white)
  errorBg: '#FCEEEE',
  focus: '#0E7C7B',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

// No fixed line heights: lets iOS Dynamic Type scale text without clipping.
export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.navy },
  body: { fontSize: 17, color: colors.navy },
  label: { fontSize: 15, fontWeight: '600' as const, color: colors.navy },
  hint: { fontSize: 14, color: colors.muted },
};

/** Minimum touch target (Apple HIG). */
export const minTouch = 44;
