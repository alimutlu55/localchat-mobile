/**
 * Chat Room Screen
 *
 * Real-time chat interface for a room.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Users,
  Info,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/types';
import { wsService, messageService, WS_EVENTS } from '../services';
import { ChatMessage, Room } from '../types';
import { useAuth } from '../context/AuthContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatRoom'>;
type ChatRoomRouteProp = RouteProp<RootStackParamList, 'ChatRoom'>;

/**
 * Message Bubble Component
 */
interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (message.type === 'system') {
    return (
      <View style={styles.systemMessage}>
        <Text style={styles.systemMessageText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.messageBubbleContainer, isOwn && styles.messageBubbleContainerOwn]}>
      {!isOwn && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {message.userName?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
      )}
      <View style={styles.messageContent}>
        {!isOwn && (
          <View style={styles.messageHeader}>
            <Text style={styles.messageSender}>{message.userName || 'Anonymous'}</Text>
            <Text style={styles.messageTime}>{formatTime(message.timestamp)}</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isOwn && styles.messageBubbleOwn]}>
          <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
            {message.content}
          </Text>
          {isOwn && (
            <Text style={styles.messageTimeOwn}>{formatTime(message.timestamp)}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Typing Indicator Component
 */
function TypingIndicator({ users }: { users: string[] }) {
  if (users.length === 0) return null;

  const text = users.length === 1
    ? `${users[0]} is typing...`
    : users.length === 2
      ? `${users[0]} and ${users[1]} are typing...`
      : `${users[0]} and ${users.length - 1} others are typing...`;

  return (
    <View style={styles.typingIndicator}>
      <View style={styles.typingDots}>
        <View style={[styles.typingDot, styles.typingDot1]} />
        <View style={[styles.typingDot, styles.typingDot2]} />
        <View style={[styles.typingDot, styles.typingDot3]} />
      </View>
      <Text style={styles.typingText}>{text}</Text>
    </View>
  );
}

/**
 * Chat Room Screen Component
 */
export default function ChatRoomScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ChatRoomRouteProp>();
  const { room } = route.params;
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(true);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    const unsubscribeConnection = wsService.on('connectionStateChange', (state: string) => {
      setIsConnected(state === 'connected');
    });

    return () => {
      unsubscribeMessage();
      unsubscribeAck();
      unsubscribeTyping();
      unsubscribeRoomClosed();
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
   * Navigate to room details
   */
  const handleRoomInfo = () => {
    navigation.navigate('RoomDetails', { room });
  };

  /**
   * Render message item
   */
  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <MessageBubble
      message={item}
      isOwn={item.userId === user?.id}
    />
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#1f2937" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerInfo} onPress={handleRoomInfo}>
          <View style={styles.roomEmoji}>
            <Text style={styles.emojiText}>{room.emoji}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.roomTitle} numberOfLines={1}>{room.title}</Text>
            <View style={styles.roomMeta}>
              <Users size={12} color="#9ca3af" />
              <Text style={styles.participantCount}>
                {room.participantCount} participants
              </Text>
              {!isConnected && (
                <View style={styles.offlineBadge}>
                  <Text style={styles.offlineText}>Offline</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton} onPress={handleRoomInfo}>
          <Info size={22} color="#6b7280" />
        </TouchableOpacity>
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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
            </View>
          }
          ListFooterComponent={<TypingIndicator users={typingUsers} />}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#9ca3af"
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Send size={20} color={inputText.trim() ? '#ffffff' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomEmoji: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  emojiText: {
    fontSize: 20,
  },
  headerText: {
    flex: 1,
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  roomMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  participantCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  offlineBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  offlineText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '500',
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
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '85%',
  },
  messageBubbleContainerOwn: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  messageSender: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  messageTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  messageBubble: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageBubbleOwn: {
    backgroundColor: '#f97316',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#ffffff',
  },
  messageTimeOwn: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 8,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9ca3af',
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  typingText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1f2937',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
});

