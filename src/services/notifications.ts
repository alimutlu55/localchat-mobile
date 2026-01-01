/**
 * Notification Service
 *
 * Handles local push notifications for messages and room events.
 * Uses expo-notifications for cross-platform notification support.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { createLogger } from '../shared/utils/logger';
import { storage } from './storage';
import { eventBus } from '../core/events';

const log = createLogger('NotificationService');

// Storage keys
const MUTED_ROOMS_STORAGE_KEY = '@localchat/muted_rooms';

export interface NotificationSettings {
  pushNotifications: boolean;
  messageNotifications: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  pushNotifications: true,
  messageNotifications: true,
};

// Function to get notification settings from UserStore (set by provider)
let getNotificationSettingsFromStore: (() => NotificationSettings) | null = null;

// Track current active room to avoid notifying for messages in current room
let currentActiveRoomId: string | null = null;

// Track current user ID to avoid self-notifications
let currentUserId: string | null = null;

// Cache of muted room IDs (synced from RoomStore)
let mutedRoomIds: Set<string> = new Set();

// Function to look up room name by ID (set by RoomStoreProvider)
let getRoomNameById: ((roomId: string) => string | undefined) | null = null;

/**
 * Configure notification behavior
 */
function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions
 */
async function requestPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === 'granted') {
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    log.error('Failed to request notification permissions', { error });
    return false;
  }
}

/**
 * Set the function to get notification settings from UserStore
 * Called by UserStoreProvider during initialization
 */
function setSettingsGetter(getter: () => NotificationSettings): void {
  getNotificationSettingsFromStore = getter;
  log.debug('Notification settings getter set');
}

/**
 * Get notification settings (from UserStore if available, otherwise defaults)
 */
function getSettings(): NotificationSettings {
  if (getNotificationSettingsFromStore) {
    const settings = getNotificationSettingsFromStore();
    log.debug('Retrieved notification settings', { settings });
    return settings;
  }
  log.warn('Settings getter not set, using defaults');
  return DEFAULT_SETTINGS;
}

/**
 * Show a local notification for a new message
 */
async function showMessageNotification(
  roomId: string,
  roomName: string,
  senderName: string,
  messageContent: string
): Promise<void> {
  try {
    log.debug('showMessageNotification called', { roomId, roomName, senderName, currentActiveRoomId, currentUserId });

    // Check if notifications are enabled
    const settings = getSettings();
    if (!settings.pushNotifications || !settings.messageNotifications) {
      log.debug('Message notifications disabled, skipping', { roomId, settings });
      return;
    }

    // Don't notify for current active room
    if (roomId === currentActiveRoomId) {
      log.debug('User is in this room, skipping notification', { roomId });
      return;
    }

    // Don't notify for muted rooms
    if (mutedRoomIds.has(roomId)) {
      log.debug('Room is muted, skipping notification', { roomId });
      return;
    }

    // Check permissions
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      log.debug('Notification permissions not granted', { status });
      return;
    }

    // Truncate long messages
    const truncatedContent = messageContent.length > 100
      ? messageContent.substring(0, 97) + '...'
      : messageContent;

    log.info('Scheduling notification', { roomId, roomName, senderName });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: roomName,
        body: `${senderName}: ${truncatedContent}`,
        data: {
          type: 'message',
          roomId,
          roomName,
        },
        sound: true,
        ...(Platform.OS === 'android' && {
          priority: Notifications.AndroidNotificationPriority.HIGH,
        }),
      },
      trigger: null, // Show immediately
    });

    log.info('Message notification shown', { roomId, roomName, senderName });
  } catch (error) {
    log.error('Failed to show message notification', { error, roomId });
  }
}

/**
 * Show a notification for room events (e.g., room expiring, kicked)
 */
async function showRoomNotification(
  title: string,
  body: string,
  roomId?: string
): Promise<void> {
  try {
    const settings = getSettings();
    if (!settings.pushNotifications) {
      return;
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'room',
          roomId,
        },
        sound: true,
      },
      trigger: null,
    });

    log.debug('Room notification shown', { title });
  } catch (error) {
    log.error('Failed to show room notification', { error });
  }
}

/**
 * Set the current active room (to avoid notifications for current room)
 */
function setActiveRoom(roomId: string | null): void {
  currentActiveRoomId = roomId;
  log.debug('Active room set', { roomId });
}

/**
 * Set the current user ID (to avoid self-notifications)
 */
function setCurrentUser(userId: string | null): void {
  currentUserId = userId;
  log.debug('Current user set', { userId });
}

/**
 * Sync muted rooms from RoomStore
 * Called by RoomStoreProvider when muted rooms change
 */
function setMutedRooms(roomIds: Set<string>): void {
  mutedRoomIds = roomIds;
  log.debug('Muted rooms synced', { count: roomIds.size });
}

/**
 * Set room name lookup function
 * Called by RoomStoreProvider to allow notification service to look up room names
 */
function setRoomNameLookup(lookupFn: (roomId: string) => string | undefined): void {
  getRoomNameById = lookupFn;
  log.debug('Room name lookup function set');
}

/**
 * Load muted rooms from storage (for initialization before store is ready)
 */
async function loadMutedRoomsFromStorage(): Promise<void> {
  try {
    const saved = await storage.get<string[]>(MUTED_ROOMS_STORAGE_KEY);
    if (saved && Array.isArray(saved)) {
      mutedRoomIds = new Set(saved);
      log.debug('Loaded muted rooms from storage', { count: saved.length });
    }
  } catch (error) {
    log.error('Failed to load muted rooms from storage', { error });
  }
}

/**
 * Clear all notifications
 */
async function clearAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    log.error('Failed to clear notifications', { error });
  }
}

/**
 * Initialize notification service and subscribe to events
 */
function initialize(): () => void {
  log.info('Initializing notification service');

  // Configure handler
  configureNotificationHandler();

  // Subscribe to message events
  const unsubMessage = eventBus.on('message.new', (payload) => {
    log.debug('Received message.new event', {
      senderId: payload.sender?.id,
      currentUserId,
      roomId: payload.roomId
    });

    // Don't notify for own messages
    if (payload.sender.id === currentUserId) {
      log.debug('Skipping notification for own message');
      return;
    }

    // Don't notify for system messages
    if (payload.type === 'SYSTEM') {
      log.debug('Skipping notification for system message');
      return;
    }

    // Look up room name from store, fallback to payload or default
    const roomName = getRoomNameById?.(payload.roomId) || payload.roomName || 'Chat Room';
    log.debug('Room name resolved', { roomId: payload.roomId, roomName });

    showMessageNotification(
      payload.roomId,
      roomName,
      payload.sender.displayName || 'Someone',
      payload.content
    );
  });

  // Note: We don't subscribe to room.userKicked or room.userBanned events here
  // because the ChatRoomScreen already shows an Alert when the user is kicked/banned.
  // Showing a notification would be redundant and could cause duplicate alerts due to
  // timing issues with currentActiveRoomId being cleared during navigation.

  const unsubExpiring = eventBus.on('room.expiring', (payload) => {
    // Only notify if user is in the room
    if (currentActiveRoomId === payload.roomId) {
      showRoomNotification(
        'Room Expiring Soon',
        `${payload.roomName || 'This room'} will expire in ${payload.minutesRemaining} minutes`,
        payload.roomId
      );
    }
  });

  log.info('Notification service initialized');

  // Return cleanup function
  return () => {
    unsubMessage();
    unsubExpiring();
    log.info('Notification service cleaned up');
  };
}

/**
 * Add notification response listener (for handling taps)
 */
function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export const notificationService = {
  initialize,
  requestPermissions,
  getSettings,
  setSettingsGetter,
  showMessageNotification,
  showRoomNotification,
  setActiveRoom,
  setCurrentUser,
  setMutedRooms,
  setRoomNameLookup,
  loadMutedRoomsFromStorage,
  clearAllNotifications,
  addNotificationResponseListener,
};

export default notificationService;
