import { palette } from '@medipath/client-core';

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

// No fixed line heights: lets iOS Dynamic Type scale text without clipping.
export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, color: palette.navy900 },
  body: { fontSize: 17, color: palette.navy900 },
  label: { fontSize: 15, fontWeight: '600' as const, color: palette.navy900 },
  hint: { fontSize: 14, color: palette.ink600 },
};

/** Minimum touch target (Apple HIG). */
export const minTouch = 44;
