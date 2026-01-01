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

    // CRITICAL FIX: Sync state when initialData changes (e.g., when parent re-fetches with avatar URLs)
    // This fixes the issue where avatars don't show on first render but appear on second open
    useEffect(() => {
        // Only update if profile data actually changed
        if (initialData.displayName !== data.displayName ||
            initialData.profilePhotoUrl !== data.profilePhotoUrl) {
            setData(prev => ({
                ...prev,
                displayName: initialData.displayName,
                profilePhotoUrl: initialData.profilePhotoUrl,
            }));
        }
    }, [initialData.userId, initialData.displayName, initialData.profilePhotoUrl]);

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
