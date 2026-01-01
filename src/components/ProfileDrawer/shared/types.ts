/**
 * Shared Types for ProfileDrawer Components
 */

import { Room } from '../../../types';

/**
 * Sub-page navigation type
 */
export type SubPage = 'main' | 'location' | 'notifications' | 'language' | 'help' | 'blocked';

/**
 * User statistics
 */
export interface UserStats {
    roomsJoined: number;
    messagesSent: number | null; // null = not available from backend
    memberSince: string;
}

/**
 * Blocked user from API
 */
export interface BlockedUser {
    blockedId: string;
    displayName?: string;
    createdAt: Date;
}
