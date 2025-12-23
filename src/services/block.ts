/**
 * Block Service
 *
 * Handles user blocking functionality.
 */

import { api } from './api';

/**
 * Blocked User
 */
export interface BlockedUser {
  blockedId: string;
  displayName?: string;
  reason?: string;
  createdAt: Date;
}

/**
 * Blocked User DTO from backend
 */
interface BlockedUserDTO {
  blockedId: string;
  displayName?: string;
  reason?: string;
  createdAt: string;
}

/**
 * Transform DTO to model
 */
function transformBlockedUser(dto: BlockedUserDTO): BlockedUser {
  return {
    blockedId: dto.blockedId,
    displayName: dto.displayName,
    reason: dto.reason,
    createdAt: new Date(dto.createdAt),
  };
}

/**
 * Block Service class
 */
class BlockService {
  /**
   * Block a user
   */
  async blockUser(blockedId: string, reason?: string): Promise<BlockedUser> {
    const response = await api.post<{ data: BlockedUserDTO }>('/blocked-users', {
      blockedId,
      reason,
    });
    return transformBlockedUser(response.data);
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockedId: string): Promise<void> {
    await api.delete(`/blocked-users/${blockedId}`);
  }

  /**
   * Get list of blocked users
   */
  async getBlockedUsers(): Promise<BlockedUser[]> {
    const response = await api.get<{ data: BlockedUserDTO[] }>('/blocked-users');
    return (response.data || []).map(transformBlockedUser);
  }

  /**
   * Check if a user is blocked
   */
  isUserBlocked(blockedUsers: BlockedUser[], userId: string): boolean {
    return blockedUsers.some((user) => user.blockedId === userId);
  }
}

export const blockService = new BlockService();
export default blockService;

