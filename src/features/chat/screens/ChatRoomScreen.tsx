/**
 * Chat Room Screen (Refactored)
 *
 * Real-time chat interface using extracted hooks for separation of concerns.
 *
 * Architecture:
 * - useChatMessages: Message state, WebSocket subscriptions
 * - useChatInput: Input state, typing indicators
 * - useBlockedUsers: Blocked user management
 * - UI is purely presentational
 *
 * ~400 LOC (down from 1,388 LOC)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { theme } from '../../../core/theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AlertCircle,
} from 'lucide-react-native';

// Navigation
import { RootStackParamList } from '../../../navigation/types';

// Feature Components
import { ChatHeader, MessageInput } from '../components';

// Types
import { ChatMessage, Room } from '../../../types';

// UserStore
import { useUserId } from '../../user/store';

// Services (via feature gateway)
import { chatServices } from '../services';

// Hooks
import { useChatMessages, useChatInput } from '../hooks';
import { useRoom, useRoomOperations, useRoomMembership } from '../../rooms/hooks';
import { useRoomStore, useIsRoomMutedStore } from '../../rooms/store';
import { useNetworkState } from '../../../hooks';
import { useBlockedUsers } from '../../user/hooks';

// Components
import {
  MessageBubble,
  DateSeparator,
  shouldShowDateSeparator,
  TypingIndicator,
  ScrollToBottomButton,
  ChatRoomMenu,
  ReportModal,
  ReportReason,
} from '../../../components/chat';

// Utils
import { createLogger } from '../../../shared/utils/logger';
import { isAlreadyReported } from '../../../shared/utils/errors';

const log = createLogger('ChatRoom');

// =============================================================================
// Types
// =============================================================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatRoom'>;
type ChatRoomRouteProp = RouteProp<RootStackParamList, 'ChatRoom'>;

// =============================================================================
// Main Component
// =============================================================================

export default function ChatRoomScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ChatRoomRouteProp>();

  // Support both new (roomId) and legacy (room) navigation params
  const params = route.params;
  const roomId = params.roomId || params.room?.id;
  const initialRoom = params.initialRoom || params.room;

  // Guard: roomId is required
  if (!roomId) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Room not found</Text>
      </View>
    );
  }

  const userId = useUserId();
  const updateRoom = useRoomStore((s) => s.updateRoom);
  const toggleMuteRoom = useRoomStore((s) => s.toggleMuteRoom);

  const { isJoined, isCreator } = useRoomMembership(roomId);
  const { leave, close, isLeaving, isClosing } = useRoomOperations();

  const insets = useSafeAreaInsets();

  // Mute state from RoomStore
  const isMuted = useIsRoomMutedStore(roomId);

  // ConnectionBanner is now self-contained - no manual network state needed

  // Use new useRoom hook for room data with caching and WebSocket updates
  const { room: cachedRoom } = useRoom(roomId, {
    skipFetchIfCached: true, // Use cached data, don't re-fetch on every render
  });

  // Prefer cached room (has WebSocket updates), fallback to initial
  const room = cachedRoom || initialRoom;

  // UI State
  const [showMenu, setShowMenu] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showBlockedWarning, setShowBlockedWarning] = useState(false);
  const [reportConfig, setReportConfig] = useState<{
    isOpen: boolean;
    targetType: 'message' | 'room' | 'user';
    targetData?: any;
  }>({ isOpen: false, targetType: 'message' });

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const isAtBottomRef = useRef(true);
  const isClosingRoomRef = useRef(false); // Track if owner is closing the room

  // Safe navigation helper - navigates to home and clears room stack
  const navigateToHome = useCallback(() => {
    // Reset to Discovery screen to ensure we clear any nested room info screens
    navigation.reset({
      index: 0,
      routes: [{ name: 'Discovery' }],
    });
  }, [navigation]);

  // Blocked Users Hook
  const { blockedUserIds, blockUser, isBlocked, isLoaded: blockedUsersLoaded } = useBlockedUsers();

  // Chat Messages Hook
  const {
    messages,
    isLoading,
    connectionState,
    sendMessage,
    retryMessage,
    addReaction,
    markMessagesAsRead,
  } = useChatMessages(roomId, {
    onAccessDenied: (reason) => {
      if (reason === 'banned') {
        Alert.alert('Access Denied', 'You are banned from this room.', [
          { text: 'OK', onPress: () => navigateToHome() },
        ]);
      } else {
        navigation.replace('RoomDetails', { roomId, initialRoom });
      }
    },
    onRoomClosed: () => {
      // Don't show alert if the current user (owner) initiated the close
      if (isClosingRoomRef.current) {
        return;
      }
      Alert.alert('Room Closed', 'This room has been closed.', [
        { text: 'OK', onPress: () => navigateToHome() },
      ]);
    },
    onUserKicked: () => {
      Alert.alert('Removed from Room', 'You have been removed from this room.', [
        { text: 'OK', onPress: () => navigateToHome() },
      ]);
    },
    onUserBanned: (reason) => {
      Alert.alert('Banned from Room', reason || 'You have been banned from this room.', [
        { text: 'OK', onPress: () => navigateToHome() },
      ]);
    },
  });

  // Chat Input Hook - use roomId for consistency
  const { inputText, setInputText, handleSubmit, typingUsers, canSend } = useChatInput(
    roomId,
    sendMessage
  );

  // ==========================================================================
  // Track active room for notifications (suppress notifications when in room)
  // ==========================================================================

  useFocusEffect(
    useCallback(() => {
      // When screen is focused, set this room as active
      chatServices.setActiveRoom(roomId);

      return () => {
        // When screen loses focus, clear active room
        chatServices.setActiveRoom(null);
      };
    }, [roomId])
  );

  // ==========================================================================
  // Mark messages as read when user is at bottom
  // ==========================================================================

  // Track if we've done initial read marking
  const initialReadDoneRef = useRef(false);

  useEffect(() => {
    // When at bottom and have messages from others, mark them as read
    if (messages.length > 0) {
      // Filter for real messages from other users (exclude optimistic messages with temp- prefix)
      const messagesFromOthers = messages
        .filter((m) =>
          m.userId !== userId &&
          m.type === 'user' &&
          m.id &&
          !m.id.startsWith('temp-') &&
          !m.id.startsWith('system-')
        )
        .map((m) => m.id);

      if (messagesFromOthers.length > 0) {
        // On initial load or when at bottom, mark as read
        if (!initialReadDoneRef.current || isAtBottomRef.current) {
          markMessagesAsRead(messagesFromOthers);
          initialReadDoneRef.current = true;
        }
      }
    }
  }, [messages, userId, markMessagesAsRead]);

  // ==========================================================================
  // Refresh Room Data on Focus
  // ==========================================================================

  useFocusEffect(
    useCallback(() => {
      const refreshRoom = async () => {
        try {
          const freshRoom = await chatServices.getRoom(roomId);
          updateRoom(roomId, { participantCount: freshRoom.participantCount });
        } catch (e) {
          log.warn('Could not refresh room data on focus');
        }
      };
      refreshRoom();
    }, [roomId, updateRoom])
  );

  // ==========================================================================
  // Blocked User Warning Check
  // ==========================================================================

  useEffect(() => {
    const checkForBlockedUsers = async () => {
      // Wait for blocked users to be loaded before checking
      if (!blockedUsersLoaded) return;

      // Only check if we have blocked users
      if (blockedUserIds.size === 0) return;

      try {
        const participants = await chatServices.getParticipants(roomId);
        const hasBlockedParticipant = participants.some(
          (p) => blockedUserIds.has(p.userId)
        );

        if (hasBlockedParticipant) {
          log.info('Blocked user detected in room', { roomId });
          // Delay showing modal to ensure screen transition animation is complete
          // This fixes the issue where modal was rendered but not visible when
          // entering via navigation.replace() from RoomDetails
          setTimeout(() => {
            setShowBlockedWarning(true);
          }, 400);
        }
      } catch (err) {
        log.error('Failed to check participants for blocked users', err);
      }
    };

    checkForBlockedUsers();
  }, [roomId, blockedUserIds, blockedUsersLoaded]);

  // ==========================================================================
  // Scroll Handling (for INVERTED list)
  // ==========================================================================

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    // In inverted list, offset 0 = bottom, higher offset = scrolled up (towards older messages)
    const isAtBottom = contentOffset.y < 100;

    isAtBottomRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);

    if (isAtBottom) {
      setUnreadCount(0);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    // In inverted list, scroll to offset 0 = bottom
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setUnreadCount(0);
  }, []);

  // ==========================================================================
  // Action Handlers
  // ==========================================================================

  const handleRoomInfo = useCallback(() => {
    navigation.navigate('RoomInfo', {
      roomId,
      initialRoom: room,
      isCreator,
      currentUserId: userId ?? undefined,
      onCloseSuccess: () => {
        isClosingRoomRef.current = true;
      },
    });
  }, [roomId, room, isCreator, userId, navigation]);

  const handleLeaveRoom = useCallback(() => {
    if (isLeaving(roomId)) return;
    Alert.alert('Leave Room', 'Are you sure you want to leave this room?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const result = await leave(roomId);
          if (result.success) {
            navigation.popToTop();
          } else {
            Alert.alert('Error', result.error?.message || 'Failed to leave room');
          }
        },
      },
    ]);
  }, [roomId, leave, navigation, isLeaving]);


  const handleReportMessage = useCallback((message: ChatMessage) => {
    setTimeout(() => {
      setReportConfig({ isOpen: true, targetType: 'message', targetData: message });
    }, 100);
  }, []);

  const handleReportRoom = useCallback(() => {
    setShowMenu(false);
    setTimeout(() => {
      setReportConfig({ isOpen: true, targetType: 'room', targetData: room });
    }, 100);
  }, [room]);

  const handleBlockUser = useCallback(
    (message: ChatMessage) => {
      if (isBlocked(message.userId)) {
        Alert.alert('Already Blocked', `${message.userName} is already blocked.`);
        return;
      }

      Alert.alert(
        'Block User',
        `Block ${message.userName}? You will still see their messages.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: () => blockUser(message.userId, message.userName),
          },
        ]
      );
    },
    [isBlocked, blockUser]
  );

  const handleSubmitReport = async (data: {
    reason: ReportReason;
    details: string;
    blockUser: boolean;
  }) => {
    try {
      if (reportConfig.targetType === 'message' && reportConfig.targetData) {
        await chatServices.reportMessage(
          roomId,
          reportConfig.targetData.id,
          data.reason,
          data.details
        );
        if (data.blockUser && !isBlocked(reportConfig.targetData.userId)) {
          await blockUser(reportConfig.targetData.userId, reportConfig.targetData.userName);
        }
      } else if (reportConfig.targetType === 'room') {
        await chatServices.reportRoom(roomId, data.reason, data.details);
        // Alert removed: ReportModal handles confirmation
      }
    } catch (error) {
      if (isAlreadyReported(error)) {
        log.info('Room already reported, treating as success', { roomId });
        return;
      }
      log.error('Report submission failed', error);
      throw error;
    }
  };

  // ==========================================================================
  // Prepare Data for Inverted List
  // ==========================================================================

  // Reverse messages for inverted FlatList (newest first in data = shows at bottom)
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  // ==========================================================================
  // Render Message Item
  // ==========================================================================

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      // For inverted list with reversed data:
      // - index 0 is the newest message (bottom of screen)
      // - We need to check the NEXT item (index + 1) for date separator
      //   because in visual order, the item at index+1 appears ABOVE current item
      const nextMessage = index < reversedMessages.length - 1 ? reversedMessages[index + 1] : null;

      // Show date separator if this message is on a different day than the one above it
      const showDateSeparator = shouldShowDateSeparator(item, nextMessage);
      const isOwn = item.userId === userId;

      return (
        <>
          <MessageBubble
            message={item}
            isOwn={isOwn}
            onReport={handleReportMessage}
            onBlock={handleBlockUser}
            onReact={addReaction}
            onRetry={retryMessage}
            hasBlocked={isBlocked(item.userId)}
          />
          {/* Date separator appears BELOW the message in inverted list = above visually */}
          {showDateSeparator && <DateSeparator date={item.timestamp} />}
        </>
      );
    },
    [reversedMessages, userId, handleReportMessage, handleBlockUser, addReaction, retryMessage, isBlocked]
  );

  // ==========================================================================
  // Loading State - Only if no room data at all
  // ==========================================================================

  // Show full loading only if we have no room data whatsoever
  if (!room && !initialRoom) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.tokens.brand.primary} />
      </View>
    );
  }

  // Use whatever room data we have (prefer fresh, fallback to initial)
  // After the guard above, at least one of these is defined
  const displayRoom = (room || initialRoom)!;

  // ==========================================================================
  // Main Render
  // ==========================================================================

  return (
    <View style={styles.container}>
      {/* Header - Extracted to ChatHeader component */}
      <ChatHeader
        room={displayRoom}
        onBack={() => navigation.goBack()}
        onRoomInfo={handleRoomInfo}
        onMenuOpen={() => setShowMenu(true)}
      />

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Show loading indicator while fetching messages */}
        {isLoading ? (
          <View style={styles.loadingMessages}>
            <ActivityIndicator size="large" color={theme.tokens.brand.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            // INVERTED LIST: Data is already reversed via reversedMessages
            // This makes the list start at bottom without scroll animation
            data={reversedMessages}
            inverted
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageListInverted}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            // For inverted list, header becomes footer (shows at bottom = typing indicator)
            ListHeaderComponent={<TypingIndicator users={typingUsers} />}
            ListEmptyComponent={
              <View style={styles.emptyStateInverted}>
                <Text style={styles.emptyIcon}>🎉</Text>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtitle}>Say hi and break the ice!</Text>
              </View>
            }
          />
        )}

        <ScrollToBottomButton
          visible={showScrollButton}
          unreadCount={unreadCount}
          onPress={scrollToBottom}
        />

        {/* Input - Extracted to MessageInput component */}
        <MessageInput
          inputRef={inputRef}
          value={inputText}
          onChangeText={setInputText}
          onSubmit={handleSubmit}
          canSend={canSend}
        />
      </KeyboardAvoidingView>

      {/* Menu */}
      <ChatRoomMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        onRoomInfo={handleRoomInfo}
        onLeave={handleLeaveRoom}
        onReport={handleReportRoom}
        onMute={() => toggleMuteRoom(roomId)}
        isMuted={isMuted}
        isCreator={isCreator}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={reportConfig.isOpen}
        onClose={() => setReportConfig((prev) => ({ ...prev, isOpen: false }))}
        onSubmit={handleSubmitReport}
        targetType={reportConfig.targetType}
        targetName={
          reportConfig.targetType === 'message'
            ? reportConfig.targetData?.userName
            : displayRoom.title
        }
        isUserAlreadyBlocked={
          reportConfig.targetType === 'message' && reportConfig.targetData?.userId
            ? isBlocked(reportConfig.targetData.userId)
            : false
        }
      />

      {/* Blocked User Warning */}
      <Modal
        visible={showBlockedWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBlockedWarning(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowBlockedWarning(false)}
          />
          <View style={styles.warningModal}>
            <AlertCircle size={32} color={theme.tokens.brand.primary} />
            <Text style={styles.warningTitle}>Blocked user in chat</Text>
            <Text style={styles.warningDescription}>
              A user you've blocked is in this chat.
            </Text>
            <TouchableOpacity
              style={styles.stayButton}
              onPress={() => setShowBlockedWarning(false)}
            >
              <Text style={styles.stayButtonText}>Stay in Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={async () => {
                setShowBlockedWarning(false);
                const result = await leave(roomId);
                if (result.success) {
                  navigation.popToTop();
                } else {
                  Alert.alert('Error', result.error?.message || 'Failed to leave room');
                }
              }}
            >
              <Text style={styles.leaveButtonText}>Leave Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.tokens.bg.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.tokens.bg.surface,
  },
  loadingMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  messageListInverted: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    // For inverted list, flexGrow pushes content to bottom when empty
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateInverted: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    // Flip the empty state back since list is inverted
    transform: [{ scaleY: -1 }],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.tokens.text.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: theme.tokens.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  warningModal: {
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.tokens.text.primary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  warningDescription: {
    fontSize: 15,
    color: theme.tokens.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  stayButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.tokens.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  stayButtonText: {
    color: theme.tokens.text.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  leaveButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.tokens.bg.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveButtonText: {
    color: theme.tokens.text.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
