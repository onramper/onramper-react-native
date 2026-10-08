import { createContext, useContext } from 'react';

export type ThemeName = 'dark' | 'light';

export interface Palette {
  name: ThemeName;
  headerBg: string;
  contentBg: string;
  cardBg: string;
  accent: string;
  onAccent: string;
  text: string;
  textSecondary: string;
  inputBg: string;
  border: string;
  danger: string;
  success: string;
  warning: string;
}

// Mirrors oid-ios-demo BuyCryptoView tokens. Colors are #RRGGBB so they can go
// straight into the SDK's CheckoutButtonStyle and through `withAlpha`.
export const PALETTES: Record<ThemeName, Palette> = {
  dark: {
    name: 'dark',
    headerBg: '#000000',
    contentBg: '#121217',
    cardBg: '#1F1F24',
    accent: '#B5F798',
    onAccent: '#000000',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    inputBg: '#8E8E931A',
    border: '#8E8E934D',
    danger: '#FF453A',
    success: '#30D158',
    warning: '#FF9F0A',
  },
  light: {
    name: 'light',
    headerBg: '#F5F5FA',
    contentBg: '#F2F2F7',
    cardBg: '#FFFFFF',
    accent: '#F831FD',
    onAccent: '#000000',
    text: '#000000',
    textSecondary: '#6C6C70',
    inputBg: '#8E8E931A',
    border: '#8E8E934D',
    danger: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
  },
};

export const RADIUS = { card: 16, tile: 12, input: 10, button: 14 } as const;
export const MONO = 'Menlo';

export const ThemeContext = createContext<Palette>(PALETTES.dark);

export function useTheme(): Palette {
  return useContext(ThemeContext);
}

/** `#RRGGBB` + alpha (0–1) → `#RRGGBBAA`. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}
