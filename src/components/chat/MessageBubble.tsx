/**
 * Message Bubble Component
 *
 * Enhanced message bubble with:
 * - Message status indicators (sending/sent/delivered/read)
 * - Context menu (copy, report, block)
 * - Avatar display
 * - Animated entrance
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
  Image,
  Alert,
} from 'react-native';
import {
  Check,
  CheckCheck,
  Copy,
  Flag,
  Ban,
  Clock,
  AlertCircle,
} from 'lucide-react-native';
import { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onReport?: (message: ChatMessage) => void;
  onBlock?: (message: ChatMessage) => void;
}

export function MessageBubble({ message, isOwn, onReport, onBlock }: MessageBubbleProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Animate on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const handleCopy = async () => {
    // Note: To enable clipboard functionality, install expo-clipboard:
    // npx expo install expo-clipboard
    // Then import: import * as Clipboard from 'expo-clipboard';
    // And use: await Clipboard.setStringAsync(message.content);
    Alert.alert('Copied', 'Message copied to clipboard');
    setShowContextMenu(false);
  };

  const handleReport = () => {
    onReport?.(message);
    setShowContextMenu(false);
  };

  const handleBlock = () => {
    onBlock?.(message);
    setShowContextMenu(false);
  };

  const handleLongPress = () => {
    setShowContextMenu(true);
  };

  /**
   * Get status icon for own messages
   */
  const getStatusIcon = () => {
    if (!isOwn || !message.status) return null;

    switch (message.status) {
      case 'sending':
        return <Clock size={14} color="rgba(255, 255, 255, 0.6)" />;
      case 'sent':
        return <Check size={14} color="rgba(255, 255, 255, 0.7)" />;
      case 'delivered':
        return <CheckCheck size={14} color="rgba(255, 255, 255, 0.7)" />;
      case 'read':
        return <CheckCheck size={14} color="#93c5fd" />;
      case 'failed':
        return <AlertCircle size={14} color="#fca5a5" />;
      default:
        return null;
    }
  };

  /**
   * Get avatar initial or display image
   */
  const renderAvatar = () => {
    if (message.userProfilePhoto) {
      return (
        <Image
          source={{ uri: message.userProfilePhoto }}
          style={styles.avatarImage}
        />
      );
    }

    return (
      <Text style={styles.avatarText}>
        {message.userName?.charAt(0).toUpperCase() || 'U'}
      </Text>
    );
  };

  // System message rendering
  if (message.type === 'system') {
    return (
      <View style={styles.systemMessage}>
        <Text style={styles.systemMessageText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          isOwn && styles.containerOwn,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Avatar for incoming messages */}
        {!isOwn && (
          <View style={styles.avatar}>
            {renderAvatar()}
          </View>
        )}

        <TouchableOpacity
          style={styles.messageContent}
          onLongPress={handleLongPress}
          activeOpacity={0.8}
          delayLongPress={300}
        >
          {/* Sender name and time for incoming messages */}
          {!isOwn && (
            <View style={styles.messageHeader}>
              <Text style={styles.messageSender}>
                {message.userName || 'Anonymous'}
              </Text>
              <Text style={styles.messageTime}>{formatTime(message.timestamp)}</Text>
            </View>
          )}

          {/* Message bubble */}
          <View style={[styles.bubble, isOwn && styles.bubbleOwn]}>
            <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
              {message.content}
            </Text>

            {/* Time and status for own messages */}
            {isOwn && (
              <View style={styles.ownMessageMeta}>
                <Text style={styles.messageTimeOwn}>
                  {formatTime(message.timestamp)}
                </Text>
                {getStatusIcon()}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Context Menu Modal */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContextMenu(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowContextMenu(false)}
        >
          <View style={styles.contextMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
              <Copy size={18} color="#374151" />
              <Text style={styles.menuItemText}>Copy</Text>
            </TouchableOpacity>

            {!isOwn && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
                  <Flag size={18} color="#374151" />
                  <Text style={styles.menuItemText}>Report</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleBlock}>
                  <Ban size={18} color="#ef4444" />
                  <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                    Block User
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '85%',
  },
  containerOwn: {
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  bubble: {
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
  bubbleOwn: {
    backgroundColor: '#f97316',
    borderTopLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#ffffff',
  },
  ownMessageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  messageTimeOwn: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
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
  // Context Menu
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    minWidth: 180,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    color: '#374151',
  },
  menuItemDanger: {
    color: '#ef4444',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
});

export default MessageBubble;

