import { tokens } from './tokens';
import { palette } from './palette';

/**
 * Design System - Theme Entry Point
 */

export const theme = {
    tokens,
    palette,
};

/**
 * Hook for accessing theme tokens in components.
 * Currently returns the static theme, but supports future dynamic theming (Dark Mode).
 */
export function useTheme() {
    // In the future, this can access a ThemeContext for dynamic switching
    return theme;
}

export * from './tokens';
export * from './palette';
