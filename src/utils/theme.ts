import type { ThemeMode } from '../types';

export interface M3Palette {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
}

const DEFAULT_LIGHT: M3Palette = {
  primary: '#4c662b',
  onPrimary: '#ffffff',
  primaryContainer: '#cdeda3',
  onPrimaryContainer: '#354e16',
  secondary: '#586249',
  onSecondary: '#ffffff',
  secondaryContainer: '#dce7c8',
  onSecondaryContainer: '#404a33',
  tertiary: '#386663',
  onTertiary: '#ffffff',
  tertiaryContainer: '#bcece7',
  onTertiaryContainer: '#1f4e4b',
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  background: '#f9faef',
  onBackground: '#1a1c16',
  surface: '#f9faef',
  onSurface: '#1a1c16',
  surfaceVariant: '#e1e4d5',
  onSurfaceVariant: '#44483d',
  outline: '#75796c',
  outlineVariant: '#c5c8ba',
  surfaceBright: '#f9faef',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f3f4e9',
  surfaceContainer: '#eeefe3',
  surfaceContainerHigh: '#e8e9de',
  surfaceContainerHighest: '#e2e3d8',
};

const DEFAULT_DARK: M3Palette = {
  primary: '#b1d18a',
  onPrimary: '#1f3701',
  primaryContainer: '#354e16',
  onPrimaryContainer: '#cdeda3',
  secondary: '#bfcbad',
  onSecondary: '#2a331e',
  secondaryContainer: '#404a33',
  onSecondaryContainer: '#dce7c8',
  tertiary: '#a0d0cb',
  onTertiary: '#003735',
  tertiaryContainer: '#1f4e4b',
  onTertiaryContainer: '#bcece7',
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',
  background: '#12140e',
  onBackground: '#e2e3d8',
  surface: '#12140e',
  onSurface: '#e2e3d8',
  surfaceVariant: '#44483d',
  onSurfaceVariant: '#c5c8ba',
  outline: '#8f9285',
  outlineVariant: '#44483d',
  surfaceBright: '#383a32',
  surfaceContainerLowest: '#0c0f09',
  surfaceContainerLow: '#1a1c16',
  surfaceContainer: '#1e201a',
  surfaceContainerHigh: '#282b24',
  surfaceContainerHighest: '#33362e',
};

function hexToHsl(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hsl(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  return `hsl(${hh}, ${Math.min(100, Math.max(0, s))}%, ${Math.min(100, Math.max(0, l))}%)`;
}

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function buildPalette(seedHex: string, isDark: boolean, blackTheme: boolean): M3Palette {
  const isDefault = !seedHex || seedHex.toLowerCase() === '#ffffff';
  let palette: M3Palette;

  if (isDefault) {
    palette = isDark ? { ...DEFAULT_DARK } : { ...DEFAULT_LIGHT };
  } else {
    const [h] = hexToHsl(seedHex);
    const th = (h + 60) % 360;
    if (!isDark) {
      palette = {
        primary: hsl(h, 48, 34),
        onPrimary: '#ffffff',
        primaryContainer: hsl(h, 68, 86),
        onPrimaryContainer: hsl(h, 52, 20),
        secondary: hsl(h, 20, 38),
        onSecondary: '#ffffff',
        secondaryContainer: hsl(h, 30, 88),
        onSecondaryContainer: hsl(h, 24, 22),
        tertiary: hsl(th, 42, 34),
        onTertiary: '#ffffff',
        tertiaryContainer: hsl(th, 58, 85),
        onTertiaryContainer: hsl(th, 48, 20),
        error: '#ba1a1a',
        onError: '#ffffff',
        errorContainer: '#ffdad6',
        onErrorContainer: '#93000a',
        background: hsl(h, 24, 97),
        onBackground: hsl(h, 12, 11),
        surface: hsl(h, 24, 97),
        onSurface: hsl(h, 12, 11),
        surfaceVariant: hsl(h, 18, 88),
        onSurfaceVariant: hsl(h, 12, 28),
        outline: hsl(h, 10, 46),
        outlineVariant: hsl(h, 14, 78),
        surfaceBright: hsl(h, 24, 98),
        surfaceContainerLowest: '#ffffff',
        surfaceContainerLow: hsl(h, 22, 95),
        surfaceContainer: hsl(h, 20, 92),
        surfaceContainerHigh: hsl(h, 18, 89),
        surfaceContainerHighest: hsl(h, 16, 86),
      };
    } else {
      palette = {
        primary: hsl(h, 64, 76),
        onPrimary: hsl(h, 55, 16),
        primaryContainer: hsl(h, 46, 26),
        onPrimaryContainer: hsl(h, 72, 88),
        secondary: hsl(h, 26, 74),
        onSecondary: hsl(h, 28, 18),
        secondaryContainer: hsl(h, 24, 27),
        onSecondaryContainer: hsl(h, 34, 86),
        tertiary: hsl(th, 54, 74),
        onTertiary: hsl(th, 50, 16),
        tertiaryContainer: hsl(th, 42, 26),
        onTertiaryContainer: hsl(th, 62, 86),
        error: '#ffb4ab',
        onError: '#690005',
        errorContainer: '#93000a',
        onErrorContainer: '#ffdad6',
        background: hsl(h, 14, 8),
        onBackground: hsl(h, 12, 90),
        surface: hsl(h, 14, 8),
        onSurface: hsl(h, 12, 90),
        surfaceVariant: hsl(h, 12, 26),
        onSurfaceVariant: hsl(h, 12, 76),
        outline: hsl(h, 10, 56),
        outlineVariant: hsl(h, 12, 28),
        surfaceBright: hsl(h, 12, 22),
        surfaceContainerLowest: hsl(h, 16, 5),
        surfaceContainerLow: hsl(h, 14, 10),
        surfaceContainer: hsl(h, 14, 12),
        surfaceContainerHigh: hsl(h, 14, 16),
        surfaceContainerHighest: hsl(h, 14, 20),
      };
    }
  }

  if (isDark && blackTheme) {
    palette.background = '#000000';
    palette.surface = '#000000';
    palette.surfaceContainerLowest = '#000000';
    palette.surfaceContainerLow = '#090909';
    palette.surfaceContainer = '#000000';
    palette.surfaceContainerHigh = '#151515';
    palette.surfaceContainerHighest = '#1f1f1f';
    palette.surfaceBright = '#161616';
  }

  return palette;
}

export function applyPaletteToRoot(palette: M3Palette) {
  const root = document.documentElement;
  const map: Record<string, string> = {
    '--m3-primary': palette.primary,
    '--m3-on-primary': palette.onPrimary,
    '--m3-primary-container': palette.primaryContainer,
    '--m3-on-primary-container': palette.onPrimaryContainer,
    '--m3-secondary': palette.secondary,
    '--m3-on-secondary': palette.onSecondary,
    '--m3-secondary-container': palette.secondaryContainer,
    '--m3-on-secondary-container': palette.onSecondaryContainer,
    '--m3-tertiary': palette.tertiary,
    '--m3-on-tertiary': palette.onTertiary,
    '--m3-tertiary-container': palette.tertiaryContainer,
    '--m3-on-tertiary-container': palette.onTertiaryContainer,
    '--m3-error': palette.error,
    '--m3-on-error': palette.onError,
    '--m3-error-container': palette.errorContainer,
    '--m3-on-error-container': palette.onErrorContainer,
    '--m3-background': palette.background,
    '--m3-on-background': palette.onBackground,
    '--m3-surface': palette.surface,
    '--m3-on-surface': palette.onSurface,
    '--m3-surface-variant': palette.surfaceVariant,
    '--m3-on-surface-variant': palette.onSurfaceVariant,
    '--m3-outline': palette.outline,
    '--m3-outline-variant': palette.outlineVariant,
    '--m3-surface-bright': palette.surfaceBright,
    '--m3-surface-container-lowest': palette.surfaceContainerLowest,
    '--m3-surface-container-low': palette.surfaceContainerLow,
    '--m3-surface-container': palette.surfaceContainer,
    '--m3-surface-container-high': palette.surfaceContainerHigh,
    '--m3-surface-container-highest': palette.surfaceContainerHighest,
  };
  for (const [k, v] of Object.entries(map)) {
    root.style.setProperty(k, v);
  }
}
