/**
 * Chat Services Gateway
 *
 * Encapsulates all service calls related to chat functionality.
 * This provides a single entry point for the chat feature module,
 * reducing direct coupling between screens and the services layer.
 *
 * Design Decision:
 * - Facades expose only the operations needed by the chat feature
 * - Hides implementation details of underlying services
 * - Makes mocking/testing easier
 * - Provides a clear contract for the chat feature's dependencies
 */

import { roomService, messageService, notificationService, ParticipantDTO } from '../../../services';
import { ReportReason } from '../../../components/chat';

// =============================================================================
// Room Operations (Chat-specific subset)
// =============================================================================

/**
 * Get participants for a room (for blocked user detection)
 */
export async function getParticipants(roomId: string): Promise<ParticipantDTO[]> {
    return roomService.getParticipants(roomId);
}

/**
 * Get room details
 */
export async function getRoom(roomId: string) {
    return roomService.getRoom(roomId);
}

/**
 * Report a room
 */
export async function reportRoom(
    roomId: string,
    reason: ReportReason | string,
    details: string
): Promise<void> {
    return roomService.reportRoom(roomId, reason, details);
}

// =============================================================================
// Message Operations
// =============================================================================

/**
 * Report a message
 */
export async function reportMessage(
    roomId: string,
    messageId: string,
    reason: ReportReason | string,
    details: string
): Promise<void> {
    return messageService.reportMessage(roomId, messageId, reason, details);
}

// =============================================================================
// Notification Operations
// =============================================================================

/**
 * Set the active room for notification suppression
 * Should be called when entering/leaving a chat room
 */
export function setActiveRoom(roomId: string | null): void {
    notificationService.setActiveRoom(roomId);
}

// =============================================================================
// Aggregate Export
// =============================================================================

export const chatServices = {
    // Room
    getParticipants,
    getRoom,
    reportRoom,

    // Messages
    reportMessage,

    // Notifications
    setActiveRoom,
};

export default chatServices;
