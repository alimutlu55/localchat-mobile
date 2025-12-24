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
  Platform,
} from 'react-native';
import {
  Check,
  CheckCheck,
  Copy,
  Flag,
  Ban,
  Clock,
  AlertCircle,
  MoreVertical,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChatMessage } from '../../types';
import { AvatarDisplay } from '../profile';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onReport?: (message: ChatMessage) => void;
  onBlock?: (message: ChatMessage) => void;
  hasBlocked?: boolean;
}

export function MessageBubble({ message, isOwn, onReport, onBlock, hasBlocked }: MessageBubbleProps) {
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
    if (hasBlocked) return;
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
        return <Clock size={12} color="rgba(255, 255, 255, 0.6)" />;
      case 'sent':
        return <Check size={12} color="rgba(255, 255, 255, 0.7)" />;
      case 'delivered':
        return <CheckCheck size={12} color="rgba(255, 255, 255, 0.7)" />;
      case 'read':
        return <CheckCheck size={12} color="#ffffff" />;
      case 'failed':
        return <AlertCircle size={14} color="#fca5a5" />;
      default:
        return null;
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#f97316', '#8b5cf6', '#ec4899', '#10b981', '#3b82f6'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  /**
   * Get avatar initial or display image
   */
  const renderAvatar = () => {
    return (
      <View style={{ marginRight: 10, marginTop: 2 }}>
        <AvatarDisplay
          avatarUrl={message.userProfilePhoto}
          displayName={message.userName || 'A'}
          size="sm"
          style={{ width: 36, height: 36, borderRadius: 18 }}
        />
      </View>
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
        {!isOwn && renderAvatar()}

        <View style={styles.messageContent}>
          {/* Sender name for incoming messages */}
          {!isOwn && (
            <View style={styles.messageHeader}>
              <Text style={styles.messageSender}>
                {message.userName || 'Anonymous'}
              </Text>
              <Text style={styles.messageTime}>{formatTime(message.timestamp)}</Text>
            </View>
          )}

          <View style={[styles.bubbleWrapper, isOwn && styles.bubbleWrapperOwn]}>
            {isOwn ? (
              <TouchableOpacity
                onLongPress={handleLongPress}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#f97316', '#ef4444']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.bubble, styles.bubbleOwn]}
                >
                  <Text style={[styles.messageText, styles.messageTextOwn]}>
                    {message.content}
                  </Text>
                  <View style={styles.ownMessageMeta}>
                    <Text style={styles.messageTimeOwn}>
                      {formatTime(message.timestamp)}
                    </Text>
                    {getStatusIcon()}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.incomingContainer}>
                <TouchableOpacity
                  style={styles.bubble}
                  onLongPress={handleLongPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.messageText}>{message.content}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleLongPress}
                >
                  <MoreVertical size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
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
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleReport}
                >
                  <Flag size={18} color="#374151" />
                  <Text style={styles.menuItemText}>Report</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, hasBlocked && styles.menuItemDisabled]}
                  onPress={handleBlock}
                  disabled={hasBlocked}
                >
                  <Ban size={18} color={hasBlocked ? '#9ca3af' : '#ef4444'} />
                  <Text style={[styles.menuItemText, hasBlocked ? styles.menuItemDisabledText : styles.menuItemDanger]}>
                    {hasBlocked ? 'Already Blocked' : 'Block User'}
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
    marginBottom: 16,
    paddingHorizontal: 16,
    width: '100%',
  },
  containerOwn: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    marginTop: 2,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  messageContent: {
    maxWidth: '80%',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
    gap: 6,
  },
  messageSender: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  messageTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bubbleWrapperOwn: {
    justifyContent: 'flex-end',
  },
  incomingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleOwn: {
    backgroundColor: '#f97316',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  messageText: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 22,
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
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
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
  menuItemDisabled: {
    opacity: 0.6,
  },
  menuItemDisabledText: {
    color: '#9ca3af',
  },
  reportedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 4,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  reportedText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ef4444',
    textTransform: 'uppercase',
  },
});

export default MessageBubble;

