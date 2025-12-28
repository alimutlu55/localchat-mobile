/**
 * useBlockedUsers Hook
 *
 * Manages blocked users state with caching and optimistic updates.
 * Encapsulates all blocked users logic away from components.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { blockService, BlockedUser } from '../../../services/block';
import { createLogger } from '../../../shared/utils/logger';
import { useAuthStore } from '../../auth';

const log = createLogger('useBlockedUsers');

interface UseBlockedUsersReturn {
  /** List of blocked users */
  blockedUsers: BlockedUser[];

  /** Number of blocked users */
  count: number;

  /** Loading state for initial fetch */
  isLoading: boolean;

  /** ID of user currently being unblocked (for loading indicator) */
  unblockingId: string | null;

  /** Error message if fetch failed */
  error: string | null;

  /** Refresh blocked users list from API */
  refresh: () => Promise<void>;

  /** Unblock a user with confirmation */
  unblockUser: (user: BlockedUser) => void;

  /** Unblock a user without confirmation (for programmatic use) */
  unblockUserDirect: (blockedId: string) => Promise<boolean>;

  /** Block a user */
  blockUser: (userId: string, displayName?: string, reason?: string) => Promise<boolean>;
}

export function useBlockedUsers(): UseBlockedUsersReturn {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get auth state to prevent fetching when not authenticated
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Track if we've fetched at least once
  const hasFetched = useRef(false);

  /**
   * Fetch blocked users from API
   */
  const refresh = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!isAuthenticated) {
      log.debug('Skipping blocked users fetch - not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const users = await blockService.getBlockedUsers();
      setBlockedUsers(users);
      hasFetched.current = true;
      log.info('Loaded blocked users', { count: users.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load blocked users';
      setError(message);
      log.error('Failed to load blocked users', { error: err });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  /**
   * Initial fetch on mount, and refetch when auth state changes
   */
  useEffect(() => {
    if (isAuthenticated && !hasFetched.current) {
      refresh();
    }
    // Clear state when user logs out
    if (!isAuthenticated) {
      setBlockedUsers([]);
      setError(null);
      hasFetched.current = false;
    }
  }, [isAuthenticated, refresh]);

  /**
   * Unblock user without confirmation (for programmatic use)
   */
  const unblockUserDirect = useCallback(async (blockedId: string): Promise<boolean> => {
    setUnblockingId(blockedId);

    try {
      await blockService.unblockUser(blockedId);
      setBlockedUsers((prev) => prev.filter((u) => u.blockedId !== blockedId));
      log.info('User unblocked', { blockedId });
      return true;
    } catch (err) {
      log.error('Failed to unblock user', { blockedId, error: err });
      return false;
    } finally {
      setUnblockingId(null);
    }
  }, []);

  /**
   * Unblock user with confirmation dialog
   */
  const unblockUser = useCallback(
    (user: BlockedUser) => {
      Alert.alert(
        'Unblock User',
        `Are you sure you want to unblock ${user.displayName || 'this user'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: async () => {
              const success = await unblockUserDirect(user.blockedId);
              if (!success) {
                Alert.alert('Error', 'Failed to unblock user. Please try again.');
              }
            },
          },
        ]
      );
    },
    [unblockUserDirect]
  );

  /**
   * Block a user
   */
  const blockUser = useCallback(
    async (userId: string, displayName?: string, reason?: string): Promise<boolean> => {
      try {
        const blockedUser = await blockService.blockUser(userId, reason);
        setBlockedUsers((prev) => [...prev, blockedUser]);
        log.info('User blocked', { userId });
        return true;
      } catch (err) {
        log.error('Failed to block user', { userId, error: err });
        return false;
      }
    },
    []
  );

  return {
    blockedUsers,
    count: blockedUsers.length,
    isLoading,
    unblockingId,
    error,
    refresh,
    unblockUser,
    unblockUserDirect,
    blockUser,
  };
}

export default useBlockedUsers;
