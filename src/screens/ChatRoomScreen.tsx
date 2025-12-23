/**
 * Chat Room Screen
 *
 * Real-time chat interface for a room with:
 * - Enhanced message bubbles with status indicators
 * - Date separators between message groups
 * - System messages for user events
 * - Animated typing indicator
 * - Connection status banner
 * - Scroll-to-bottom button
 * - Block/report functionality
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Users,
  Info,
  Plus,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/types';
import { wsService, messageService, blockService, roomService, WS_EVENTS } from '../services';
import { ChatMessage, Room } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  MessageBubble,
  DateSeparator,
  shouldShowDateSeparator,
  TypingIndicator,
  ConnectionBanner,
  ScrollToBottomButton,
  createSystemMessage,
  ChatRoomMenu,
  RoomInfoDrawer,
  ReportModal,
  ReportReason,
} from '../components/chat';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatRoom'>;
type ChatRoomRouteProp = RouteProp<RootStackParamList, 'ChatRoom'>;

type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

/**
 * Chat Room Screen Component
 */
export default function ChatRoomScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ChatRoomRouteProp>();
  const { room } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Report State
  const [reportConfig, setReportConfig] = useState<{
    isOpen: boolean;
    targetType: 'message' | 'room' | 'user';
    targetData?: any;
  }>({
    isOpen: false,
    targetType: 'message',
  });

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAtBottomRef = useRef(true);

  /**
   * Load blocked users on mount
   */
  useEffect(() => {
    const loadBlockedUsers = async () => {
      try {
        const blockedUsers = await blockService.getBlockedUsers();
        const blockedIds = new Set(blockedUsers.map(u => u.blockedId));
        setBlockedUserIds(blockedIds);
      } catch (err) {
        console.error('Failed to load blocked users:', err);
      }
    };
    loadBlockedUsers();
  }, []);

  /**
   * Load message history and subscribe to room
   */
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const { messages: history } = await messageService.getHistory(room.id);
        setMessages(history.reverse());
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Subscribe to room
    wsService.subscribe(room.id);
    loadMessages();

    // Cleanup
    return () => {
      wsService.unsubscribe(room.id);
    };
  }, [room.id]);

  /**
   * Setup WebSocket event listeners
   */
  useEffect(() => {
    // Handle new messages
    // Backend sends: { id, roomId, content, createdAt, sender: { id, displayName, profilePhotoUrl }, clientMessageId? }
    const unsubscribeMessage = wsService.on(WS_EVENTS.MESSAGE_NEW, (payload: any) => {
      if (payload.roomId === room.id) {
        // Don't add duplicate messages (our own messages from optimistic updates)
        if (payload.clientMessageId) {
          setMessages(prev => prev.map(msg =>
            msg.clientMessageId === payload.clientMessageId
              ? { ...msg, id: payload.id, status: 'delivered' as const }
              : msg
          ));
          return;
        }

        const newMessage: ChatMessage = {
          id: payload.id,
          type: 'user',
          content: payload.content,
          timestamp: new Date(payload.createdAt),
          userId: payload.sender.id,
          userName: payload.sender.displayName,
          userProfilePhoto: payload.sender.profilePhotoUrl,
          status: 'delivered',
        };

        // Don't add if it's our own message
        if (payload.sender.id !== user?.id) {
          setMessages(prev => [...prev, newMessage]);
        }
      }
    });

    // Handle message acknowledgments
    const unsubscribeAck = wsService.on(WS_EVENTS.MESSAGE_ACK, (payload: any) => {
      setMessages(prev => prev.map(msg =>
        msg.clientMessageId === payload.clientMessageId
          ? { ...msg, id: payload.messageId, status: payload.status === 'SENT' ? 'delivered' as const : 'failed' as const }
          : msg
      ));
    });

    // Handle typing indicators
    // Backend sends: { roomId, userId, displayName, isTyping }
    const unsubscribeTyping = wsService.on(WS_EVENTS.USER_TYPING, (payload: any) => {
      if (payload.roomId === room.id && payload.userId !== user?.id) {
        if (payload.isTyping) {
          setTypingUsers(prev =>
            prev.includes(payload.displayName) ? prev : [...prev, payload.displayName]
          );
        } else {
          setTypingUsers(prev => prev.filter(name => name !== payload.displayName));
        }
      }
    });

    // Handle room closed
    const unsubscribeRoomClosed = wsService.on(WS_EVENTS.ROOM_CLOSED, (payload: any) => {
      if (payload.roomId === room.id) {
        Alert.alert('Room Closed', 'This room has been closed.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    });

    // Handle user joined
    const unsubscribeUserJoined = wsService.on(WS_EVENTS.USER_JOINED, (payload: any) => {
      if (payload.roomId === room.id && payload.userId !== user?.id) {
        const systemMessage: ChatMessage = {
          id: `system-join-${Date.now()}`,
          type: 'system',
          content: createSystemMessage('user_joined', payload.displayName || 'Someone'),
          timestamp: new Date(),
          userId: 'system',
          userName: 'System',
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    });

    // Handle user left
    const unsubscribeUserLeft = wsService.on(WS_EVENTS.USER_LEFT, (payload: any) => {
      if (payload.roomId === room.id && payload.userId !== user?.id) {
        const systemMessage: ChatMessage = {
          id: `system-leave-${Date.now()}`,
          type: 'system',
          content: createSystemMessage('user_left', payload.displayName || 'Someone'),
          timestamp: new Date(),
          userId: 'system',
          userName: 'System',
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    });

    // Handle user kicked (if current user is kicked)
    const unsubscribeUserKicked = wsService.on(WS_EVENTS.USER_KICKED, (payload: any) => {
      if (payload.roomId === room.id) {
        if (payload.userId === user?.id) {
          Alert.alert(
            'Removed from Room',
            'You have been removed from this room.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        } else {
          const systemMessage: ChatMessage = {
            id: `system-kick-${Date.now()}`,
            type: 'system',
            content: createSystemMessage('user_kicked', payload.displayName || 'Someone'),
            timestamp: new Date(),
            userId: 'system',
            userName: 'System',
          };
          setMessages(prev => [...prev, systemMessage]);
        }
      }
    });

    // Handle user banned (if current user is banned)
    const unsubscribeUserBanned = wsService.on(WS_EVENTS.USER_BANNED, (payload: any) => {
      if (payload.roomId === room.id) {
        if (payload.userId === user?.id) {
          Alert.alert(
            'Banned from Room',
            payload.reason || 'You have been banned from this room.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        } else {
          const systemMessage: ChatMessage = {
            id: `system-ban-${Date.now()}`,
            type: 'system',
            content: createSystemMessage('user_banned', payload.displayName || 'Someone'),
            timestamp: new Date(),
            userId: 'system',
            userName: 'System',
          };
          setMessages(prev => [...prev, systemMessage]);
        }
      }
    });

    const unsubscribeConnection = wsService.on('connectionStateChange', (state: string) => {
      if (state === 'connected') {
        setConnectionState('connected');
      } else if (state === 'reconnecting') {
        setConnectionState('reconnecting');
      } else {
        setConnectionState('disconnected');
      }
    });

    return () => {
      unsubscribeMessage();
      unsubscribeAck();
      unsubscribeTyping();
      unsubscribeRoomClosed();
      unsubscribeUserJoined();
      unsubscribeUserLeft();
      unsubscribeUserKicked();
      unsubscribeUserBanned();
      unsubscribeConnection();
    };
  }, [room.id, user?.id, navigation]);

  /**
   * Handle sending a message
   */
  const handleSend = useCallback(() => {
    if (!inputText.trim() || isSending) return;

    const content = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Create optimistic message
    const clientMessageId = messageService.generateClientMessageId();
    const optimisticMessage: ChatMessage = {
      id: `temp-${clientMessageId}`,
      type: 'user',
      content,
      timestamp: new Date(),
      userId: user?.id || '',
      userName: user?.displayName || 'You',
      status: 'sending',
      clientMessageId,
    };

    setMessages(prev => [...prev, optimisticMessage]);

    // Send via WebSocket
    wsService.sendMessage(room.id, content, clientMessageId);
    setIsSending(false);

    // Stop typing indicator
    wsService.sendTyping(room.id, false);
  }, [inputText, isSending, room.id, user]);

  /**
   * Handle text input change (with typing indicator)
   */
  const handleTextChange = useCallback((text: string) => {
    setInputText(text);

    // Send typing indicator
    if (text.length > 0) {
      wsService.sendTyping(room.id, true);

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        wsService.sendTyping(room.id, false);
      }, 3000);
    } else {
      wsService.sendTyping(room.id, false);
    }
  }, [room.id]);

  /**
   * Open room info drawer
   */
  const handleRoomInfo = () => {
    setShowRoomInfo(true);
  };

  /**
   * Handle message report
   */
  const handleReportMessage = useCallback((message: ChatMessage) => {
    // Delay slightly if a menu might be closing
    setTimeout(() => {
      setReportConfig({
        isOpen: true,
        targetType: 'message',
        targetData: message,
      });
    }, 100);
  }, []);

  /**
   * Handle block user
   */
  const handleBlockUser = useCallback((message: ChatMessage) => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${message.userName}? You won't see their messages anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockService.blockUser(message.userId);
              setBlockedUserIds(prev => new Set([...prev, message.userId]));
              Alert.alert('Blocked', `${message.userName} has been blocked.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  }, []);

  /**
   * Handle scroll event
   */
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;

    isAtBottomRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);

    if (isAtBottom) {
      setUnreadCount(0);
    }
  }, []);

  /**
   * Scroll to bottom
   */
  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setUnreadCount(0);
  }, []);

  /**
   * Handle leave room
   */
  const handleLeaveRoom = useCallback(() => {
    Alert.alert(
      'Leave Room',
      'Are you sure you want to leave this room?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await roomService.leaveRoom(room.id);
              navigation.popToTop();
            } catch (error) {
              Alert.alert('Error', 'Failed to leave room');
            }
          },
        },
      ]
    );
  }, [room.id, navigation]);

  /**
   * Handle close room (creator only)
   */
  const handleCloseRoom = useCallback(() => {
    Alert.alert(
      'Close Room',
      'This will prevent any new messages. The room will become read-only.',
      [
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
      ]
    );
  }, [room.id, navigation]);

  /**
   * Handle report room
   */
  const handleReportRoom = useCallback(() => {
    // Ensure menu closes first
    setShowMenu(false);

    setTimeout(() => {
      setReportConfig({
        isOpen: true,
        targetType: 'room',
        targetData: room,
      });
    }, 100);
  }, [room]);

  const handleSubmitReport = async (data: {
    reason: ReportReason;
    details: string;
    blockUser: boolean;
    leaveRoom: boolean;
  }) => {
    try {
      if (reportConfig.targetType === 'message' && reportConfig.targetData) {
        await messageService.reportMessage(room.id, reportConfig.targetData.id, data.reason, data.details);
        if (data.blockUser) {
          await blockService.blockUser(reportConfig.targetData.userId);
          setBlockedUserIds(prev => new Set([...prev, reportConfig.targetData.userId]));
        }
      } else if (reportConfig.targetType === 'room') {
        await roomService.reportRoom(room.id, data.reason, data.details);
      }

      if (data.leaveRoom) {
        await roomService.leaveRoom(room.id);
        navigation.popToTop();
      }
    } catch (error) {
      console.error('Report submission failed:', error);
      throw error; // Re-throw to show error in modal if needed, though ReportModal handles success state
    }
  };

  /**
   * Render message item with date separator
   */
  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showDateSeparator = shouldShowDateSeparator(item, previousMessage);
    const isOwn = item.userId === user?.id;

    // Filter out messages from blocked users
    if (blockedUserIds.has(item.userId) && item.type !== 'system') {
      return null;
    }

    return (
      <>
        {showDateSeparator && <DateSeparator date={item.timestamp} />}
        <MessageBubble
          message={item}
          isOwn={isOwn}
          onReport={handleReportMessage}
          onBlock={handleBlockUser}
        />
      </>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Container with Safe Area */}
      <View style={styles.headerContainer}>
        <View style={{ height: insets.top }} />
        <ConnectionBanner state={connectionState} />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={24} color="#1f2937" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerContent} onPress={handleRoomInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{room.title}</Text>
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
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
          onContentSizeChange={() => {
            if (isAtBottomRef.current) {
              flatListRef.current?.scrollToEnd({ animated: false });
            } else {
              setUnreadCount(prev => prev + 1);
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.partyIconContainer}>
                <Text style={styles.partyIcon}>🎉</Text>
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>Say hi and break the ice!</Text>

              <View style={styles.iceBreakersContainer}>
                <Text style={styles.iceBreakersLabel}>Ice breakers:</Text>
                <TouchableOpacity
                  style={styles.iceBreakerButton}
                  onPress={() => handleTextChange("Hey everyone! 👋")}
                >
                  <Text style={styles.iceBreakerText}>"Hey everyone! 👋"</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iceBreakerButton}
                  onPress={() => handleTextChange("What brings you here?")}
                >
                  <Text style={styles.iceBreakerText}>"What brings you here?"</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListFooterComponent={<TypingIndicator users={typingUsers} />}
        />

        {/* Scroll to bottom button */}
        <ScrollToBottomButton
          visible={showScrollButton}
          unreadCount={unreadCount}
          onPress={scrollToBottom}
        />

        {/* Input */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.plusButton}>
            <Plus size={24} color="#64748b" />
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#94a3b8"
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              maxLength={1000}
            />
          </View>
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Send
              size={22}
              color={inputText.trim() ? '#3b82f6' : '#94a3b8'}
              style={{ marginLeft: 2 }}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Chat Room Menu */}
      <ChatRoomMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        onRoomInfo={handleRoomInfo}
        onLeave={handleLeaveRoom}
        onReport={handleReportRoom}
        onMute={() => setIsMuted(!isMuted)}
        isCreator={room.isCreator || false}
        onCloseRoom={room.isCreator ? handleCloseRoom : undefined}
      />

      {/* Room Info Drawer */}
      <RoomInfoDrawer
        room={room}
        isOpen={showRoomInfo}
        onClose={() => setShowRoomInfo(false)}
        isCreator={room.isCreator || false}
        currentUserId={user?.id}
        onCloseRoom={room.isCreator ? handleCloseRoom : undefined}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={reportConfig.isOpen}
        onClose={() => setReportConfig(prev => ({ ...prev, isOpen: false }))}
        onSubmit={handleSubmitReport}
        targetType={reportConfig.targetType}
        targetName={reportConfig.targetType === 'message' ? reportConfig.targetData?.userName : room.title}
      />
    </View>
  );
}

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
    paddingHorizontal: 8,
    paddingVertical: 10,
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
    justifyContent: 'center',
    paddingHorizontal: 50, // To avoid overlap with buttons
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
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
  partyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff1f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  partyIcon: {
    fontSize: 32,
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
    marginBottom: 32,
  },
  iceBreakersContainer: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  iceBreakersLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 4,
  },
  iceBreakerButton: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    width: 'auto',
    minWidth: 200,
    alignItems: 'center',
  },
  iceBreakerText: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    fontSize: 16,
    color: '#0f172a',
    maxHeight: 120,
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
});

