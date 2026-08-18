import type { CSSProperties } from 'react';

export const RADIX_COLORS = [
  'blue',
  'green',
  'amber',
  'purple',
  'pink',
  'red',
  'cyan',
  'teal',
  'orange',
  'indigo',
  'violet',
  'gray',
  'ruby',
  'grass',
  'mint',
  'iris',
] as const;

export type RadixColorName = (typeof RADIX_COLORS)[number];

export const DEFAULT_FOLDER_COLOR: RadixColorName = 'blue';

export function isRadixColor(color: string): color is RadixColorName {
  return RADIX_COLORS.includes(color as RadixColorName);
}

export function getFolderColorStyle(colorName?: string): {
  color: string;
  backgroundColor: string;
  borderColor: string;
  accentColor: string;
  style: CSSProperties;
} {
  const c = colorName && isRadixColor(colorName) ? colorName : DEFAULT_FOLDER_COLOR;
  return {
    color: `var(--${c}-11)`,
    backgroundColor: `var(--${c}-3)`,
    borderColor: `var(--${c}-6)`,
    accentColor: `var(--${c}-9)`,
    style: {
      color: `var(--${c}-11)`,
      backgroundColor: `var(--${c}-3)`,
      borderColor: `var(--${c}-6)`,
    },
  };
}
