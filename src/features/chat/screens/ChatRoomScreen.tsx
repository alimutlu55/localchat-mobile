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

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Send,
  MoreVertical,
  AlertCircle,
} from 'lucide-react-native';

// Navigation
import { RootStackParamList } from '../../../navigation/types';

// Types
import { ChatMessage, Room } from '../../../types';

// Context
import { useAuth } from '../../../context/AuthContext';
import { useRooms } from '../../../context/RoomContext';

// Services
import { blockService, roomService, messageService } from '../../../services';

// Hooks
import { useChatMessages, useChatInput } from '../hooks';
import { useRoomActions } from '../../rooms/hooks';

// Components
import {
  MessageBubble,
  DateSeparator,
  shouldShowDateSeparator,
  TypingIndicator,
  ConnectionBanner,
  ScrollToBottomButton,
  ChatRoomMenu,
  ReportModal,
  ReportReason,
} from '../../../components/chat';

// Utils
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('ChatRoom');

// =============================================================================
// Types
// =============================================================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatRoom'>;
type ChatRoomRouteProp = RouteProp<RootStackParamList, 'ChatRoom'>;

// =============================================================================
// Custom Hook: Blocked Users
// =============================================================================

function useBlockedUsers() {
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadBlockedUsers = async () => {
      try {
        const blockedUsers = await blockService.getBlockedUsers();
        setBlockedUserIds(new Set(blockedUsers.map((u) => u.blockedId)));
      } catch (err) {
        log.error('Failed to load blocked users', err);
      }
    };
    loadBlockedUsers();
  }, []);

  const blockUser = useCallback(async (userId: string): Promise<boolean> => {
    try {
      await blockService.blockUser(userId);
      setBlockedUserIds((prev) => new Set(prev).add(userId));
      return true;
    } catch (error: any) {
      // Handle "already blocked" gracefully
      if (error?.status === 409 || error?.message?.includes('already blocked')) {
        setBlockedUserIds((prev) => new Set(prev).add(userId));
        return true;
      }
      log.error('Failed to block user', error);
      return false;
    }
  }, []);

  const isBlocked = useCallback(
    (userId: string) => blockedUserIds.has(userId),
    [blockedUserIds]
  );

  return { blockedUserIds, blockUser, isBlocked };
}

// =============================================================================
// Main Component
// =============================================================================

export default function ChatRoomScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ChatRoomRouteProp>();
  const { room: initialRoom } = route.params;
  const { user } = useAuth();
  const { updateRoom, getRoomById } = useRooms();
  const { leaveRoom, isLeaving } = useRoomActions();
  const insets = useSafeAreaInsets();

  // Room state - prefer context data over route params
  const room = getRoomById(initialRoom.id) || initialRoom;
  const isCreator = room.isCreator || false;

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

  // Blocked Users Hook
  const { blockedUserIds, blockUser, isBlocked } = useBlockedUsers();

  // Chat Messages Hook
  const {
    messages,
    isLoading,
    connectionState,
    sendMessage,
    addReaction,
  } = useChatMessages(room.id, {
    onAccessDenied: (reason) => {
      if (reason === 'banned') {
        Alert.alert('Access Denied', 'You are banned from this room.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        navigation.replace('RoomDetails', { room: initialRoom });
      }
    },
    onRoomClosed: () => {
      Alert.alert('Room Closed', 'This room has been closed.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onUserKicked: () => {
      Alert.alert('Removed from Room', 'You have been removed from this room.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onUserBanned: (reason) => {
      Alert.alert('Banned from Room', reason || 'You have been banned from this room.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
  });

  // Chat Input Hook
  const { inputText, setInputText, handleSubmit, typingUsers, canSend } = useChatInput(
    room.id,
    sendMessage
  );

  // ==========================================================================
  // Refresh Room Data on Focus
  // ==========================================================================

  useFocusEffect(
    useCallback(() => {
      const refreshRoom = async () => {
        try {
          const freshRoom = await roomService.getRoom(room.id);
          updateRoom(room.id, { participantCount: freshRoom.participantCount });
        } catch (e) {
          log.warn('Could not refresh room data on focus');
        }
      };
      refreshRoom();
    }, [room.id, updateRoom])
  );

  // ==========================================================================
  // Scroll Handling
  // ==========================================================================

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;

    isAtBottomRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);

    if (isAtBottom) {
      setUnreadCount(0);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setUnreadCount(0);
  }, []);

  // ==========================================================================
  // Action Handlers
  // ==========================================================================

  const handleRoomInfo = useCallback(() => {
    navigation.navigate('RoomInfo', {
      room,
      isCreator,
      currentUserId: user?.id,
    });
  }, [room, isCreator, user?.id, navigation]);

  const handleLeaveRoom = useCallback(() => {
    Alert.alert('Leave Room', 'Are you sure you want to leave this room?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const result = await leaveRoom(room.id);
          if (result.success) {
            navigation.popToTop();
          } else {
            Alert.alert('Error', 'Failed to leave room');
          }
        },
      },
    ]);
  }, [room.id, leaveRoom, navigation]);

  const handleCloseRoom = useCallback(() => {
    Alert.alert('Close Room', 'This will prevent any new messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close Room',
        style: 'destructive',
        onPress: async () => {
          try {
            await roomService.closeRoom(room.id);
            Alert.alert('Success', 'Room has been closed');
            navigation.goBack();
          } catch (error) {
            Alert.alert('Error', 'Failed to close room');
          }
        },
      },
    ]);
  }, [room.id, navigation]);

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
            onPress: () => blockUser(message.userId),
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
        await messageService.reportMessage(
          room.id,
          reportConfig.targetData.id,
          data.reason,
          data.details
        );
        if (data.blockUser && !isBlocked(reportConfig.targetData.userId)) {
          await blockUser(reportConfig.targetData.userId);
        }
      } else if (reportConfig.targetType === 'room') {
        await roomService.reportRoom(room.id, data.reason, data.details);
        const result = await leaveRoom(room.id);
        navigation.popToTop();
      }
    } catch (error) {
      log.error('Report submission failed', error);
      throw error;
    }
  };

  // ==========================================================================
  // Render Message Item
  // ==========================================================================

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const previousMessage = index > 0 ? messages[index - 1] : null;
      const showDateSeparator = shouldShowDateSeparator(item, previousMessage);
      const isOwn = item.userId === user?.id;

      return (
        <>
          {showDateSeparator && <DateSeparator date={item.timestamp} />}
          <MessageBubble
            message={item}
            isOwn={isOwn}
            onReport={handleReportMessage}
            onBlock={handleBlockUser}
            onReact={addReaction}
            hasBlocked={isBlocked(item.userId)}
          />
        </>
      );
    },
    [messages, user?.id, handleReportMessage, handleBlockUser, addReaction, isBlocked]
  );

  // ==========================================================================
  // Loading State
  // ==========================================================================

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  // ==========================================================================
  // Main Render
  // ==========================================================================

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={{ height: insets.top }} />
        <ConnectionBanner state={connectionState} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="#1f2937" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerContent} onPress={handleRoomInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {room.title}
            </Text>
            <Text style={styles.headerSubtitle}>
              {room.participantCount} people • {room.distanceDisplay || 'Nearby'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenu(true)}>
            <MoreVertical size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => {
            if (isAtBottomRef.current) {
              flatListRef.current?.scrollToEnd({ animated: false });
            } else {
              setUnreadCount((prev) => prev + 1);
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>Say hi and break the ice!</Text>
            </View>
          }
          ListFooterComponent={<TypingIndicator users={typingUsers} />}
        />

        <ScrollToBottomButton
          visible={showScrollButton}
          unreadCount={unreadCount}
          onPress={scrollToBottom}
        />

        {/* Input */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#94a3b8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />
          </View>
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSubmit}
            disabled={!canSend}
          >
            <Send size={22} color={canSend ? '#f97316' : '#94a3b8'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Menu */}
      <ChatRoomMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        onRoomInfo={handleRoomInfo}
        onLeave={handleLeaveRoom}
        onReport={handleReportRoom}
        onMute={() => {}}
        isCreator={isCreator}
        onCloseRoom={isCreator ? handleCloseRoom : undefined}
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
            : room.title
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
            <AlertCircle size={32} color="#f97316" />
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
              onPress={() => {
                setShowBlockedWarning(false);
                navigation.goBack();
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
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  menuButton: {
    width: 44,
    height: 44,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    minHeight: 40,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  warningDescription: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  stayButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  stayButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  leaveButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },
});
