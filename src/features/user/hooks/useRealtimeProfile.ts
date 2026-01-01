import { useState, useEffect } from 'react';
import { eventBus } from '../../../core/events/EventBus';
import { useUserStore } from '../store';

interface ProfileData {
    userId: string;
    displayName: string;
    profilePhotoUrl?: string;
}

/**
 * Hook to keep a user's profile data updated in real-time.
 * It takes initial data (e.g., from a participant list fetch) and listens
 * for 'user.profileUpdated' events to update the local state.
 * 
 * IMPORTANT: Also syncs when initialData changes (e.g., when fetch completes with avatar URLs)
 */
export function useRealtimeProfile<T extends ProfileData>(initialData: T) {
    const [data, setData] = useState<T>(initialData);

    // Also sync with UserStore if this IS the current user
    const currentUserId = useUserStore(s => s.userId);
    const currentUser = useUserStore(s => s.currentUser);
    const isCurrentUser = initialData.userId === currentUserId;

    // Sync state when initialData changes (e.g., when parent re-fetches with new data)
    // IMPORTANT: For the CURRENT USER, we ignore most profile fields from initialData 
    // to prevent stale backend data from overwriting our local source of truth (UserStore).
    useEffect(() => {
        // Only update if profile data actually changed and it's NOT the current user
        // (For current user, we only sync ID/non-profile fields here; profile is handled by next effect)
        const profileChanged = initialData.displayName !== data.displayName ||
            initialData.profilePhotoUrl !== data.profilePhotoUrl;

        if (profileChanged && !isCurrentUser) {
            setData(prev => ({
                ...prev,
                displayName: initialData.displayName,
                profilePhotoUrl: initialData.profilePhotoUrl,
            }));
        }
    }, [initialData.userId, initialData.displayName, initialData.profilePhotoUrl, isCurrentUser]);

    useEffect(() => {
        // If it's the current user, we prefer the UserStore data as the source of truth
        if (isCurrentUser && currentUser) {
            setData(prev => ({
                ...prev,
                displayName: currentUser.displayName,
                profilePhotoUrl: currentUser.profilePhotoUrl,
            }));
        }
    }, [isCurrentUser, currentUser?.displayName, currentUser?.profilePhotoUrl]);

    useEffect(() => {
        // Listen for profile updates from any user
        const unsubscribe = eventBus.on('user.profileUpdated', (payload) => {
            if (payload.userId === initialData.userId) {
                setData(prev => ({
                    ...prev,
                    displayName: payload.displayName ?? prev.displayName,
                    profilePhotoUrl: payload.profilePhotoUrl ?? prev.profilePhotoUrl,
                }));
            }
        });

        return () => unsubscribe();
    }, [initialData.userId]);

    return data;
}
