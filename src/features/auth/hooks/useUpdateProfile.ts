/**
 * useUpdateProfile Hook
 *
 * Handles user profile updates.
 * Moved from AuthContext to maintain separation of concerns.
 *
 * Updates:
 * 1. Call authService to update on server
 * 2. Update UserStore with new data
 * 3. Sync via WebSocket for real-time updates
 */

import { useState, useCallback } from 'react';
import { authService } from '../../../services/auth';
import { wsService } from '../../../services';
import { useUserStore } from '../../user/store/UserStore';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('useUpdateProfile');

interface ProfileUpdates {
    displayName?: string;
    profilePhotoUrl?: string;
    bio?: string;
}

export function useUpdateProfile() {
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateUser = useUserStore((state) => state.updateUser);

    const updateProfile = useCallback(
        async (updates: ProfileUpdates) => {
            setIsUpdating(true);
            setError(null);

            try {
                log.debug('Updating profile', { updates: Object.keys(updates) });

                // Update on server
                const updatedUser = await authService.updateProfile(updates);

                // Update UserStore
                updateUser(updatedUser);

                // Sync changes via WebSocket for real-time updates across devices
                // This matches web app behavior in UserContext.tsx
                if (updates.displayName !== undefined || updates.profilePhotoUrl !== undefined) {
                    wsService.updateProfile({
                        displayName: updates.displayName,
                        profilePhotoUrl: updates.profilePhotoUrl,
                    });
                }

                log.debug('Profile update successful');
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Profile update failed';
                log.error('Profile update failed', { error: message });
                setError(message);
                throw err;
            } finally {
                setIsUpdating(false);
            }
        },
        [updateUser]
    );

    return {
        updateProfile,
        isUpdating,
        error,
    };
}

export default useUpdateProfile;
