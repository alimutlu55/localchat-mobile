/**
 * LocationPermissionStore - Caches OS Location Permission Status
 *
 * A simple Zustand store that caches the OS-level location permission status.
 * This provides reactive updates when permission changes without duplicating
 * the source of truth (which is the OS).
 *
 * Design:
 * - Single responsibility: Cache OS permission status for reactive UI
 * - No app-level "locationConsent" - OS permission IS the source of truth
 * - Emits events for components that need to react
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import * as Location from 'expo-location';
import { eventBus } from '../../core/events/EventBus';
import { createLogger } from '../utils/logger';

const log = createLogger('LocationPermissionStore');

// =============================================================================
// Types
// =============================================================================

export interface LocationPermissionState {
    /** Whether OS has granted location permission */
    isGranted: boolean;
    /** Whether permission status has been checked */
    isChecked: boolean;
    /** Whether we're currently requesting permission */
    isRequesting: boolean;
}

export interface LocationPermissionActions {
    /** Check current OS permission status */
    checkPermission: () => Promise<boolean>;
    /** Request OS permission (shows system dialog) */
    requestPermission: () => Promise<boolean>;
    /** Reset state */
    reset: () => void;
}

export type LocationPermissionStore = LocationPermissionState & LocationPermissionActions;

// =============================================================================
// Initial State
// =============================================================================

const initialState: LocationPermissionState = {
    isGranted: false,
    isChecked: false,
    isRequesting: false,
};

// =============================================================================
// Store Implementation
// =============================================================================

export const useLocationPermissionStore = create<LocationPermissionStore>()(
    subscribeWithSelector((set, get) => ({
        ...initialState,

        checkPermission: async () => {
            try {
                const { status } = await Location.getForegroundPermissionsAsync();
                const isGranted = status === 'granted';

                set({
                    isGranted,
                    isChecked: true,
                });

                log.debug('Permission checked', { isGranted });
                return isGranted;
            } catch (error) {
                log.error('Failed to check permission', error);
                set({ isChecked: true, isGranted: false });
                return false;
            }
        },

        requestPermission: async () => {
            set({ isRequesting: true });

            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                const isGranted = status === 'granted';

                set({
                    isGranted,
                    isChecked: true,
                    isRequesting: false,
                });

                // Sync consent decision to backend for GDPR tracking
                try {
                    const { consentService } = await import('../../services/consent');
                    await consentService.updatePreferences(undefined, undefined, isGranted);
                    log.info('Location consent synced to backend', { isGranted });
                } catch (syncError) {
                    log.warn('Failed to sync location consent to backend', syncError);
                    // Don't fail the permission request if sync fails
                }

                // Emit event for reactive updates
                eventBus.emit('consent.updated', {
                    locationConsent: isGranted,
                });

                log.info('Permission requested', { isGranted });
                return isGranted;
            } catch (error) {
                log.error('Failed to request permission', error);
                set({ isRequesting: false });
                return false;
            }
        },

        reset: () => {
            log.debug('LocationPermissionStore reset');
            set(initialState);
        },
    }))
);

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Hook to access location permission state and actions
 */
export function useLocationPermission() {
    const isGranted = useLocationPermissionStore((state) => state.isGranted);
    const isChecked = useLocationPermissionStore((state) => state.isChecked);
    const isRequesting = useLocationPermissionStore((state) => state.isRequesting);
    const checkPermission = useLocationPermissionStore((state) => state.checkPermission);
    const requestPermission = useLocationPermissionStore((state) => state.requestPermission);

    return {
        isGranted,
        isChecked,
        isRequesting,
        checkPermission,
        requestPermission,
    };
}

/**
 * Get store instance directly (for non-React contexts)
 */
export function getLocationPermissionStore() {
    return useLocationPermissionStore.getState();
}

export default useLocationPermissionStore;
