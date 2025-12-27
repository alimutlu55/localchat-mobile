/**
 * useSettings Hook
 * 
 * Provides access to user preferences and settings.
 * This hook is an abstraction over UserStore's preferences, providing
 * a stable API for components that were previously using SettingsContext.
 */

import { useUserStore } from '../store';

export function useSettings() {
    const preferences = useUserStore((state) => state.preferences);
    const updatePreferences = useUserStore((state) => state.updatePreferences);
    const isUpdating = useUserStore((state) => state.isUpdating);
    const isLoading = useUserStore((state) => state.isLoading);

    return {
        /**
         * Current app settings (preferences)
         */
        settings: preferences,

        /**
         * Whether settings are currently being updated
         */
        isLoading: isLoading || isUpdating,

        /**
         * Error state (not explicitly handled in UserStore yet, but kept for compatibility)
         */
        error: null,

        /**
         * Update settings (optimistic with backend sync)
         */
        updateSettings: updatePreferences,

        /**
         * Refresh settings from backend/local (handled automatically by UserStore)
         */
        refreshSettings: async () => {
            // UserStore handles sync internally, but we provide this for API compatibility
        },
    };
}
