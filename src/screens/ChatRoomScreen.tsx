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
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Users,
  Info,
  AlertCircle,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/types';
import { wsService, messageService, blockService, roomService, WS_EVENTS } from '../services';
import { ChatMessage, Room, MessageStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { useRooms } from '../context/RoomContext';
import {
  MessageBubble,
  DateSeparator,
  shouldShowDateSeparator,
  TypingIndicator,
  ConnectionBanner,
  ScrollToBottomButton,
  createSystemMessage,
  ChatRoomMenu,
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
  const { room: initialRoom } = route.params;
  const { user } = useAuth();
  const { updateRoom: contextUpdateRoom, leaveRoom: contextLeaveRoom } = useRooms();
  const insets = useSafeAreaInsets();

  // ============================================================================
  // SIMPLE STATE: Use initialRoom, update via WebSocket events
  // ============================================================================
  const [room, setRoom] = useState<Room>(initialRoom);
  const [isCreatorOverride, setIsCreatorOverride] = useState<boolean | null>(null);
  const isCreator = isCreatorOverride !== null ? isCreatorOverride : (room.isCreator || false);

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
  const [isMuted, setIsMuted] = useState(false);
  const [hasShownBlockedWarning, setHasShownBlockedWarning] = useState(false);
  const [showBlockedWarning, setShowBlockedWarning] = useState(false);
  const [blockedInChatCount, setBlockedInChatCount] = useState(0);

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
  const inputRef = useRef<TextInput>(null);
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
   * Check if user is creator by fetching participant list
   * This is a fallback in case isCreator flag is not set correctly
   */
  useEffect(() => {
    const checkCreatorStatus = async () => {
      if (room.isCreator !== undefined) {
        // If isCreator is already set, trust it
        return;
      }

      try {
        const participants = await roomService.getParticipants(room.id);
        const currentUserParticipant = participants.find(p => p.userId === user?.id);
        if (currentUserParticipant?.role === 'creator') {
          console.log('[ChatRoomScreen] User is creator (detected from participants)');
          setIsCreatorOverride(true);
        }
      } catch (err) {
        console.error('[ChatRoomScreen] Failed to check creator status:', err);
      }
    };

    checkCreatorStatus();
  }, [room.id, room.isCreator, user?.id]);

  /**
   * Refresh room data when screen comes into focus
   * useRoomSubscription already handles this, but we can trigger manual refresh
   */
  /**
   * Refresh room data when screen comes into focus
   */
  useFocusEffect(
    React.useCallback(() => {
      const refreshRoomData = async () => {
        try {
          const freshRoom = await roomService.getRoom(room.id);
          setRoom(prev => ({
            ...prev,
            participantCount: freshRoom.participantCount,
          }));
          contextUpdateRoom(room.id, { participantCount: freshRoom.participantCount });
        } catch (e) {
          console.warn('[ChatRoomScreen] Could not refresh room data on focus');
        }
      };
      refreshRoomData();
    }, [room.id, contextUpdateRoom])
  );

  /**
   * Debug: Log when room participant count changes
   */
  useEffect(() => {
    console.log('[ChatRoomScreen] Room participant count updated:', room.participantCount, 'roomId:', room.id);
  }, [room.participantCount, room.id]);

  /**
   * SIMPLE INITIALIZATION: Load room and messages on mount
   * If user is not a participant, redirect to RoomDetails
   */
  useEffect(() => {
    let isMounted = true;

    const initializeRoom = async () => {
      try {
        // Step 1: Try to load messages - this will fail if user is not a participant
        const { messages: history } = await messageService.getHistory(room.id);
        
        if (!isMounted) return;
        
        setMessages(history);
        setIsLoading(false);
        
        // Step 2: Subscribe to WebSocket for real-time updates
        wsService.subscribe(room.id);
        
        // Step 3: Fetch fresh room data for accurate participant count
        try {
          const freshRoom = await roomService.getRoom(room.id);
          if (isMounted) {
            setRoom(prev => ({
              ...prev,
              participantCount: freshRoom.participantCount,
            }));
            contextUpdateRoom(room.id, { participantCount: freshRoom.participantCount });
          }
        } catch (e) {
          console.warn('[ChatRoomScreen] Could not refresh room data:', e);
        }
        
      } catch (error: any) {
        console.error('[ChatRoomScreen] Failed to initialize room:', error);
        
        if (!isMounted) return;
        
        // If user is not a participant (kicked/banned), redirect to RoomDetails
        if (error?.message?.includes('must be in the room') || 
            error?.message?.includes('not a participant') ||
            error?.response?.status === 403) {
          console.log('[ChatRoomScreen] User not in room, redirecting to RoomDetails');
          navigation.replace('RoomDetails', { room: initialRoom });
          return;
        }
        
        // Other errors - show alert
        Alert.alert('Error', 'Failed to load room. Please try again.');
        setIsLoading(false);
      }
    };

    initializeRoom();

    return () => {
      isMounted = false;
      wsService.unsubscribe(room.id);
    };
  }, [room.id]);

  /**
   * Check for blocked users in room - fetches participants and checks against blocked users
   */
  useEffect(() => {
    // Only check after loading is complete and blocked users are loaded
    if (isLoading) return;
    if (hasShownBlockedWarning) return;
    if (blockedUserIds.size === 0) return;

    const checkForBlockedParticipants = async () => {
      try {
        const participants = await roomService.getParticipants(room.id);
        const participantIds = participants
          .map(p => p.userId)
          .filter(id => id !== user?.id);

        const blockedInRoom = participantIds.filter(id => blockedUserIds.has(id));

        if (blockedInRoom.length > 0) {
          setBlockedInChatCount(blockedInRoom.length);
          setShowBlockedWarning(true);
          setHasShownBlockedWarning(true);
        }
      } catch (err) {
        console.error('Failed to check for blocked participants:', err);
      }
    };

    checkForBlockedParticipants();
  }, [room.id, blockedUserIds, hasShownBlockedWarning, user?.id, isLoading]);

  /**
   * Setup WebSocket event listeners
   */
  useEffect(() => {
    // Handle new messages
    // Backend sends: { id, roomId, content, createdAt, sender: { id, displayName, profilePhotoUrl }, clientMessageId? }
    const unsubscribeMessage = wsService.on(WS_EVENTS.MESSAGE_NEW, (payload: any) => {
      if (payload.roomId === room.id) {
        setMessages(prev => {
          // Check for duplicate by id or clientMessageId
          const existingIndex = prev.findIndex(m =>
            m.id === payload.id ||
            (payload.clientMessageId && m.clientMessageId === payload.clientMessageId)
          );

          if (existingIndex !== -1) {
            // Update the optimistic message with server data
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              id: payload.id,
              status: 'delivered',
            };
            return updated;
          }

          // For own messages without clientMessageId (e.g. sent from another device), 
          // check if we have a pending message with same content (fallback)
          if (payload.sender.id === user?.id) {
            const pendingIndex = prev.findIndex(m =>
              m.userId === user?.id &&
              m.content === payload.content &&
              m.status === 'sending'
            );
            if (pendingIndex !== -1) {
              const updated = [...prev];
              updated[pendingIndex] = {
                ...updated[pendingIndex],
                id: payload.id,
                status: 'delivered',
              };
              return updated;
            }
          }

          const newMessage: ChatMessage = {
            id: payload.id,
            type: 'user',
            content: payload.content,
            timestamp: new Date(payload.createdAt),
            userId: payload.sender.id,
            userName: payload.sender.displayName || 'Anonymous User',
            userProfilePhoto: payload.sender.profilePhotoUrl,
            status: 'delivered',
            clientMessageId: payload.clientMessageId,
          };

          return [...prev, newMessage];
        });
      }
    });

    // Handle message acknowledgments
    const unsubscribeAck = wsService.on(WS_EVENTS.MESSAGE_ACK, (payload: any) => {
      const { clientMessageId, messageId, status } = payload;

      // Map backend status to frontend MessageStatus
      const s = status?.toLowerCase();
      let normalizedStatus: MessageStatus = 'delivered';
      if (s === 'sent') normalizedStatus = 'sent';
      else if (s === 'delivered') normalizedStatus = 'delivered';
      else if (s === 'read') normalizedStatus = 'read';
      else if (s === 'failed') normalizedStatus = 'failed';

      setMessages(prev => prev.map(msg =>
        msg.clientMessageId === clientMessageId
          ? { ...msg, id: messageId, status: normalizedStatus }
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
      // Backend sends: { roomId, user: { id, displayName, profilePhotoUrl? }, participantCount }
      const joinedUserId = payload.user?.id;
      const joinedDisplayName = payload.user?.displayName || 'Someone';

      if (payload.roomId === room.id) {
        // Update participant count
        if (payload.participantCount !== undefined) {
          setRoom(prev => ({ ...prev, participantCount: payload.participantCount }));
          contextUpdateRoom(room.id, { participantCount: payload.participantCount });
        }
        
        // Show system message for other users joining
        if (joinedUserId !== user?.id) {
          const systemMessage: ChatMessage = {
            id: `system-join-${Date.now()}`,
            type: 'system',
            content: createSystemMessage('user_joined', joinedDisplayName),
            timestamp: new Date(),
            userId: 'system',
            userName: 'System',
          };
          setMessages(prev => [...prev, systemMessage]);
        }
      }
    });

    // Handle user left
    const unsubscribeUserLeft = wsService.on(WS_EVENTS.USER_LEFT, (payload: any) => {
      if (payload.roomId === room.id) {
        // Update participant count
        if (payload.participantCount !== undefined) {
          setRoom(prev => ({ ...prev, participantCount: payload.participantCount }));
          contextUpdateRoom(room.id, { participantCount: payload.participantCount });
        }
        
        // Show system message for other users leaving
        if (payload.userId !== user?.id) {
          const displayNameToUse = payload.displayName || 'Someone';
          const systemMessage: ChatMessage = {
            id: `system-leave-${Date.now()}`,
            type: 'system',
            content: createSystemMessage('user_left', displayNameToUse),
            timestamp: new Date(),
            userId: 'system',
            userName: 'System',
          };
          setMessages(prev => [...prev, systemMessage]);
        }
      }
    });

    // Handle user kicked (if current user is kicked)
    const unsubscribeUserKicked = wsService.on(WS_EVENTS.USER_KICKED, (payload: any) => {
      if (payload.roomId === room.id) {
        if (payload.kickedUserId === user?.id) {
          // Current user was kicked - show alert and navigate back
          // NOTE: RoomContext already handles membership state update
          console.log('[ChatRoomScreen] Current user kicked, showing alert');
          
          Alert.alert(
            'Removed from Room',
            'You have been removed from this room by the moderator.',
            [{ 
              text: 'OK', 
              onPress: () => {
                navigation.goBack();
              }
            }]
          );
        } else {
          // Show system message for other user being kicked
          const systemMessage: ChatMessage = {
            id: `system-kick-${Date.now()}`,
            type: 'system',
            content: createSystemMessage('user_kicked', payload.displayName || 'A user'),
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
        if (payload.bannedUserId === user?.id) {
          // Current user was banned - show alert and navigate back
          // NOTE: RoomContext already handles membership state update
          console.log('[ChatRoomScreen] Current user banned, showing alert');
          
          const banReason = payload.reason || 'You have been banned from this room.';
          Alert.alert(
            'Banned from Room',
            banReason,
            [{ 
              text: 'OK', 
              onPress: () => {
                navigation.goBack();
              }
            }]
          );
        } else {
          // Show system message for other user being banned
          const systemMessage: ChatMessage = {
            id: `system-ban-${Date.now()}`,
            type: 'system',
            content: createSystemMessage('user_banned', payload.displayName || 'A user'),
            timestamp: new Date(),
            userId: 'system',
            userName: 'System',
          };
          setMessages(prev => [...prev, systemMessage]);
        }
      }
    });

    // Handle participant count updates
    const unsubscribeParticipantCount = wsService.on(WS_EVENTS.PARTICIPANT_COUNT, (payload: any) => {
      if (payload.roomId === room.id && payload.participantCount !== undefined) {
        setRoom(prev => ({ ...prev, participantCount: payload.participantCount }));
        contextUpdateRoom(room.id, { participantCount: payload.participantCount });
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

    // Handle message reactions
    // Backend sends: { roomId, messageId, reactions: [{ emoji, count, userReacted }] }
    const unsubscribeReaction = wsService.on(WS_EVENTS.MESSAGE_REACTION, (payload: any) => {
      if (payload.roomId === room.id) {
        setMessages(prev => prev.map(msg =>
          msg.id === payload.messageId
            ? { ...msg, reactions: payload.reactions }
            : msg
        ));
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
      unsubscribeParticipantCount();
      unsubscribeConnection();
      unsubscribeReaction();
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
   * Handle message reaction
   */
  const handleReact = useCallback((messageId: string, emoji: string) => {
    // Optimistic update
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;

      const reactions = [...(msg.reactions || [])];
      const existingReactionIndex = reactions.findIndex(r => r.emoji === emoji);

      if (existingReactionIndex !== -1) {
        const reaction = { ...reactions[existingReactionIndex] };
        if (reaction.userReacted) {
          reaction.count = Math.max(0, reaction.count - 1);
          reaction.userReacted = false;
        } else {
          reaction.count += 1;
          reaction.userReacted = true;
        }

        if (reaction.count === 0) {
          reactions.splice(existingReactionIndex, 1);
        } else {
          reactions[existingReactionIndex] = reaction;
        }
      } else {
        reactions.push({ emoji, count: 1, userReacted: true });
      }

      return { ...msg, reactions };
    }));

    // Send to server
    wsService.sendReaction(room.id, messageId, emoji);
  }, [room.id]);

  /**
   * Open room info drawer
   */
  const handleRoomInfo = useCallback(() => {
    navigation.navigate('RoomInfo', {
      room,
      isCreator,
      currentUserId: user?.id,
      onCloseRoom: isCreator ? () => {
        navigation.goBack();
        handleCloseRoom();
      } : undefined,
    });
  }, [room, isCreator, user?.id, navigation]);

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
    // Check if user is already blocked
    if (blockedUserIds.has(message.userId)) {
      Alert.alert('Already Blocked', `${message.userName} is already blocked.`);
      return;
    }

    Alert.alert(
      'Block User',
      `Are you sure you want to block ${message.userName}? You will still see their messages, but they won't be able to contact you privately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockService.blockUser(message.userId);
              setBlockedUserIds(prev => {
                const next = new Set(prev);
                next.add(message.userId);
                return next;
              });

              // Show the blocked user warning since we just blocked someone in this chat
              if (!hasShownBlockedWarning) {
                setBlockedInChatCount(1);
                setShowBlockedWarning(true);
                setHasShownBlockedWarning(true);
              }
            } catch (error: any) {
              // Handle "already blocked" gracefully
              const isAlreadyBlocked =
                error?.status === 409 ||
                error?.message?.toLowerCase().includes('already blocked');

              if (isAlreadyBlocked) {
                // Just update local state
                setBlockedUserIds(prev => {
                  const next = new Set(prev);
                  next.add(message.userId);
                  return next;
                });
              } else {
                console.error('Failed to block user:', error);
                Alert.alert('Error', 'Failed to block user. Please try again.');
              }
            }
          },
        },
      ]
    );
  }, [hasShownBlockedWarning, blockedUserIds]);

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
              // Use context's leaveRoom to update state properly
              const success = await contextLeaveRoom(room.id);
              if (success) {
                navigation.popToTop();
              } else {
                Alert.alert('Error', 'Failed to leave room');
              }
            } catch (error) {
              console.error('[ChatRoomScreen] Leave error:', error);
              Alert.alert('Error', 'Failed to leave room');
            }
          },
        },
      ]
    );
  }, [room.id, navigation, contextLeaveRoom]);

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
  }) => {
    try {
      if (reportConfig.targetType === 'message' && reportConfig.targetData) {
        const messageId = reportConfig.targetData.id;
        const targetUserId = reportConfig.targetData.userId;

        // Attempt to report, handle "already reported" gracefully
        try {
          await messageService.reportMessage(room.id, messageId, data.reason, data.details);
        } catch (reportError: any) {
          // Check if this is a "already reported" conflict error (HTTP 409)
          // ApiError has status and message as direct properties
          const isAlreadyReported =
            reportError?.status === 409 ||
            reportError?.message?.toLowerCase().includes('already reported');

          if (!isAlreadyReported) {
            // Re-throw other errors
            throw reportError;
          }
          // Otherwise, treat as success - the report already exists
        }

        // Only attempt to block if checkbox is checked AND user is not already blocked
        if (data.blockUser && !blockedUserIds.has(targetUserId)) {
          try {
            await blockService.blockUser(targetUserId);
            setBlockedUserIds(prev => {
              const next = new Set(prev);
              next.add(targetUserId);
              return next;
            });

            // Show the blocked user warning since we just blocked someone in this chat
            if (!hasShownBlockedWarning) {
              setBlockedInChatCount(1);
              setShowBlockedWarning(true);
              setHasShownBlockedWarning(true);
            }
          } catch (blockError) {
            // Silently handle "already blocked" error - just update local state
            console.log('[ChatRoomScreen] Block user failed (may already be blocked):', blockError);
            setBlockedUserIds(prev => {
              const next = new Set(prev);
              next.add(targetUserId);
              return next;
            });
          }
        }
      } else if (reportConfig.targetType === 'room') {
        try {
          await roomService.reportRoom(room.id, data.reason, data.details);
        } catch (reportError: any) {
          // Handle "already reported" as success (idempotent)
          const isAlreadyReported =
            reportError?.status === 409 ||
            reportError?.message?.toLowerCase().includes('already reported');

          if (!isAlreadyReported) {
            // Re-throw other errors
            throw reportError;
          }
          // Otherwise, treat as success - the report already exists
          console.log('[ChatRoomScreen] Room already reported - treating as success');
        }

        // Auto-leave after reporting room (UX improvement)
        const success = await contextLeaveRoom(room.id);
        if (success) {
          navigation.popToTop();
        } else {
          // Don't throw - report succeeded
          console.error('[ChatRoomScreen] Failed to leave room after report');
          navigation.popToTop(); // Navigate anyway
        }
      }
    } catch (error) {
      console.error('Report submission failed:', error);
      throw error; // Re-throw to show error in modal if needed
    }
  };

  /**
   * Render message item with date separator
   */
  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
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
          onReact={handleReact}
          hasBlocked={blockedUserIds.has(item.userId)}
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
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#94a3b8"
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              maxLength={1000}
              blurOnSubmit={false}
              keyboardType="default"
              returnKeyType="default"
              enablesReturnKeyAutomatically
              underlineColorAndroid="transparent"
            />
          </View>
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Send
              size={22}
              color="#94a3b8"
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
        isCreator={isCreator}
        onCloseRoom={isCreator ? handleCloseRoom : undefined}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={reportConfig.isOpen}
        onClose={() => setReportConfig(prev => ({ ...prev, isOpen: false }))}
        onSubmit={handleSubmitReport}
        targetType={reportConfig.targetType}
        targetName={reportConfig.targetType === 'message' ? reportConfig.targetData?.userName : room.title}
        isUserAlreadyBlocked={
          reportConfig.targetType === 'message' && reportConfig.targetData?.userId
            ? blockedUserIds.has(reportConfig.targetData.userId)
            : false
        }
      />

      {/* Blocked User Warning Modal */}
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
            <View style={styles.warningIconContainer}>
              <AlertCircle size={32} color="#f97316" />
            </View>
            <Text style={styles.warningTitle}>Someone you blocked is here</Text>
            <Text style={styles.warningDescription}>
              A user you've blocked is in this chat. You can still see their messages.
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
    justifyContent: 'center',
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
    gap: 12,
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
    textAlignVertical: 'top',
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
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  warningIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  warningDescription: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
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

