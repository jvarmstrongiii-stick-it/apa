/**
 * APA League App - Theme Constants
 *
 * Dark theme optimized for pool hall environments (low-light conditions).
 * All color values use high contrast ratios for readability in dim lighting.
 */

export const theme = {
  colors: {
    /** Primary background - near black for minimal glare */
    background: '#0A0A0A',
    /** Card and surface background */
    surface: '#1A1A1A',
    /** Lighter surface for hover/active states */
    surfaceLight: '#2A2A2A',
    /** Border color for dividers and outlines */
    border: '#333333',
    /** Primary text - white */
    text: '#FFFFFF',
    /** Secondary text for labels and descriptions */
    textSecondary: '#999999',
    /** Muted text for placeholders and disabled states */
    textMuted: '#666666',
    /** Primary action color - blue */
    primary: '#3B82F6',
    /** Darker primary for pressed states */
    primaryDark: '#1D4ED8',
    /** Success indicators - green */
    success: '#22C55E',
    /** Error and destructive actions - red */
    error: '#EF4444',
    /** Warnings and offline indicators - yellow */
    warning: '#EAB308',
    /** Informational elements - cyan */
    info: '#06B6D4',
    /** Accent color - purple */
    accent: '#8B5CF6',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    /** Large score display */
    score: 48,
  },

  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  /**
   * Minimum touch target size in dp.
   * Sized generously for pool hall use where users may have
   * chalk on their hands or be operating in low light.
   */
  touchTarget: {
    minimum: 48,
  },
} as const;

export type Theme = typeof theme;
export type ThemeColors = keyof typeof theme.colors;
export type ThemeSpacing = keyof typeof theme.spacing;
export type ThemeFontSize = keyof typeof theme.fontSize;
export type ThemeBorderRadius = keyof typeof theme.borderRadius;
