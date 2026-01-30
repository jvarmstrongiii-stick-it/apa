/**
 * ThemeProvider
 *
 * Provides the theme object to the entire component tree via React Context.
 * Currently supports only the dark theme, which is optimized for
 * low-light pool hall environments.
 *
 * Usage:
 *   // In app root
 *   <ThemeProvider>
 *     <App />
 *   </ThemeProvider>
 *
 *   // In any child component
 *   const theme = useTheme();
 */

import React, { createContext, useContext } from 'react';
import { theme as defaultTheme, Theme } from '../constants/theme';

const ThemeContext = createContext<Theme>(defaultTheme);

export interface ThemeProviderProps {
  children: React.ReactNode;
  theme?: Theme;
}

export function ThemeProvider({
  children,
  theme = defaultTheme,
}: ThemeProviderProps) {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the current theme from any component within the ThemeProvider tree.
 *
 * @throws Error if used outside of a ThemeProvider.
 */
export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
