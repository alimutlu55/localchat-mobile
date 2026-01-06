import { palette } from './palette';

/**
 * Design System - Semantic Tokens
 * 
 * Maps functional roles to specific palette values.
 * This allows for easy adjustments and supports future theming.
 */

export const tokens = {
    // Brand
    brand: {
        primary: palette.orange[500],
        secondary: palette.rose[500],
        accent: palette.orange[500],
    },

    // Actions
    action: {
        primary: {
            default: palette.orange[500],
            active: palette.orange[600],
            contrast: '#ffffff',
        },
        secondary: {
            default: palette.orange[50], // Tinted background
            active: palette.orange[100],
            text: palette.orange[500],
        },
        danger: {
            default: palette.red[500],
            active: palette.red[600],
            contrast: '#ffffff',
        },
        ghost: {
            text: palette.orange[500],
            active: palette.orange[50],
        },
        disabled: {
            bg: palette.slate[200],
            text: palette.slate[400],
        },
    },

    // Surfaces & Backgrounds
    bg: {
        canvas: palette.slate[50],
        surface: '#ffffff',
        subtle: palette.slate[100],
    },

    // Borders
    border: {
        subtle: palette.slate[200],
        strong: palette.slate[300],
        focus: palette.orange[500],
        error: palette.red[500],
    },

    // Typography
    text: {
        primary: palette.slate[900],
        secondary: palette.slate[600],
        tertiary: palette.slate[400],
        onPrimary: '#ffffff',
        onSecondary: palette.orange[500],
        error: palette.red[500],
        success: palette.emerald[600],
    },

    // Semantic Feedback
    status: {
        success: {
            main: palette.emerald[500],
            bg: palette.emerald[50],
        },
        error: {
            main: palette.red[500],
            bg: palette.red[50],
        },
        warning: {
            main: palette.amber[500],
            bg: palette.amber[50],
        },
        info: {
            main: palette.blue[500],
            bg: palette.blue[50],
        },
    },

    // Room Status
    room: {
        join: palette.orange[500],
        enter: palette.emerald[500],
        success: palette.emerald[500],
        error: palette.red[500],
        disabled: palette.slate[200],
        disabledText: palette.slate[500],
    },

    // Categories (Mapped to Harmonized Families)
    categories: {
        // Pulse Family
        trafficTransit: palette.pulse,
        safetyHazards: palette.pulse,
        lostFound: palette.pulse,
        // Spirit Family
        eventsFestivals: palette.spirit,
        socialMeetups: palette.spirit,
        atmosphereMusic: palette.spirit,
        // Flow Family
        sightseeingGems: palette.flow,
        newsIntel: palette.flow,
        retailWait: palette.flow,
        // Play Family
        sportsFitness: palette.play,
        dealsPopups: palette.play,
        marketsFinds: palette.play,
        play: palette.orange[400],
        // Essential
        foodDining: palette.orange[500],
        general: palette.slate[500],
    },
};
