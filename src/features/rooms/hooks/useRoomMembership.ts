/**
 * useRoomMembership Hook
 *
 * Provides reactive membership status for a specific room.
 * Separates membership logic from data fetching.
 */

import { useMemo } from 'react';
import { useRoomStore } from '../store';

export type UserRoomRole = 'creator' | 'member' | 'guest';

export interface UseRoomMembershipReturn {
    /** Whether the user is a participant in the room */
    isJoined: boolean;

    /** Whether the user is the room's host */
    isCreator: boolean;

    /** Whether the user has muted the room */
    isMuted: boolean;

    /** The user's role in the room */
    role: UserRoomRole;

    /** Human-readable role label */
    roleLabel: string;
}

export function useRoomMembership(roomId: string | undefined): UseRoomMembershipReturn {
    // Subscribe to store sets for reactivity
    const isJoined = useRoomStore((s) => (roomId ? s.joinedRoomIds.has(roomId) : false));
    const isCreator = useRoomStore((s) => (roomId ? s.createdRoomIds.has(roomId) : false));
    const isMuted = useRoomStore((s) => (roomId ? s.mutedRoomIds.has(roomId) : false));

    const role = useMemo((): UserRoomRole => {
        if (isCreator) return 'creator';
        if (isJoined) return 'member';
        return 'guest';
    }, [isCreator, isJoined]);

    const roleLabel = useMemo(() => {
        switch (role) {
            case 'creator': return 'Host';
            case 'member': return 'Member';
            case 'guest': return 'Guest';
        }
    }, [role]);

    return {
        isJoined,
        isCreator,
        isMuted,
        role,
        roleLabel,
    };
}

export default useRoomMembership;
