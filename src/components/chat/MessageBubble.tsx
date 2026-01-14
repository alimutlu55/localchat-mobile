/**
 * Message Bubble Component
 *
 * Enhanced message bubble with:
 * - Message status indicators (sending/sent/delivered/read)
 * - Context menu (copy, report, block)
 * - Avatar display
 * - Animated entrance
 */

import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../core/theme';
import { ChatMessage } from '../../types';
import { AvatarDisplay } from '../profile';
import { useRealtimeProfile } from '../../features/user/hooks/useRealtimeProfile';
import { getCategoryColor } from '../../constants';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onPress: (message: ChatMessage) => void;
  onLongPress: (message: ChatMessage) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onRetry?: (message: ChatMessage) => void;
  hasBlocked?: boolean;
}

const isOnlyEmojis = (str: string) => {
  try {
    // Check if string contains only emojis and whitespace
    // \p{Extended_Pictographic} covers most emojis
    // We allow whitespace between emojis
    const regex = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Component}|\s)+$/u;
    return regex.test(str) && str.trim().length > 0;
  } catch (e) {
    return false;
  }
};

export function MessageBubble({
  message,
  isOwn,
  onPress,
  onLongPress,
  onReact,
  onRetry,
  hasBlocked
}: MessageBubbleProps) {
  // Use real-time profile for sender info
  const profile = useRealtimeProfile({
    userId: message.userId,
    displayName: message.userName || 'Anonymous',
    profilePhotoUrl: message.userProfilePhoto,
  });

  const userName = profile.displayName;
  const userProfilePhoto = profile.profilePhotoUrl;

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

  /**
   * Get status icon for own messages
   */
  const getStatusIcon = () => {
    if (!isOwn || !message.status) return null;

    switch (message.status) {
      case 'sending':
        return <Clock size={12} color={theme.tokens.text.onPrimary} style={{ opacity: 0.6 }} />;
      case 'sent':
        return <Check size={12} color={theme.tokens.text.onPrimary} style={{ opacity: 0.7 }} />;
      case 'delivered':
        return <CheckCheck size={12} color={theme.tokens.text.onPrimary} style={{ opacity: 0.7 }} />;
      case 'read':
        return <CheckCheck size={12} color={theme.tokens.text.onPrimary} />;
      case 'failed':
        return null; // We'll handle failed state separately with tap-to-retry
      default:
        return null;
    }
  };

  /**
   * Handle retry for failed messages
   */
  const handleRetry = () => {
    if (message.status === 'failed' && onRetry) {
      onRetry(message);
    }
  };

  /**
   * Get avatar initial or display image
   */
  const renderAvatar = () => {
    return (
      <View style={{ marginRight: 10, marginTop: 2 }}>
        <AvatarDisplay
          avatarUrl={userProfilePhoto}
          displayName={userName}
          size="sm"
          style={{ width: 32, height: 32, borderRadius: 16 }}
        />
      </View>
    );
  };

  // Determine if message is jumbo emoji candidate
  const emojiInfo = useMemo(() => {
    if (message.type === 'system') return { isJumbo: false, count: 0 };

    const isEmoji = isOnlyEmojis(message.content);
    if (!isEmoji) return { isJumbo: false, count: 0 };

    // Count emojis roughly by splitting by non-whitespace
    // This is an approximation. Array.from(str) splits by code points/surrogates correctly-ish.
    const count = [...message.content.trim()].filter(c => /\S/.test(c)).length / 2; // Rough estimate since emojis are often 2 chars
    // Better count using Intl.Segmenter if available, or just length of match
    // Actually, let's just use a threshold on length.
    // Standard emoji is 2 chars. 3 emojis ~ 6 chars.
    // Allow up to 3 emojis for jumbo size.

    // Simple approach: if length is small enough, it's few emojis.
    // 3 emojis max.
    const isSmallCount = message.content.trim().length <= 12; // Generous limit for 3-4 emojis

    return { isJumbo: isEmoji && isSmallCount, count: 0 };
  }, [message.content, message.type]);

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
                {userName}
              </Text>
            </View>
          )}

          {isOwn ? (
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ position: 'relative' }}>
                <View style={styles.outgoingContainer}>

                  <TouchableOpacity
                    onPress={() => message.status === 'failed' ? handleRetry() : onPress(message)}
                    onLongPress={() => message.status === 'failed' ? undefined : onLongPress(message)}
                    activeOpacity={0.85}
                  >
                    {emojiInfo.isJumbo ? (
                      <View style={[styles.jumboEmojiContainer, message.reactions && message.reactions.length > 0 && { marginBottom: 12 }]}>
                        <Text style={styles.jumboEmojiText}>
                          {message.content}
                        </Text>
                        <View style={styles.ownMessageMetaJumbo}>
                           {message.status === 'failed' ? (
                            <AlertCircle size={14} color={theme.tokens.text.error} />
                          ) : (
                            <>
                              <Text style={[styles.messageTimeOwn, { color: theme.tokens.text.tertiary }]}>
                                {formatTime(message.timestamp)}
                              </Text>
                              {/* For jumbo emojis, we don't show read ticks inside, maybe next to it?
                                  Or just hide them for simplicity/aesthetics */}
                            </>
                          )}
                        </View>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={
                          message.status === 'failed'
                            ? [theme.tokens.status.error.main, theme.tokens.status.error.main]
                            : [theme.tokens.brand.primary, theme.tokens.brand.secondary]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                          styles.bubble,
                          styles.bubbleOwn,
                          message.status === 'failed' && styles.bubbleFailed,
                          message.reactions && message.reactions.length > 0 && { marginBottom: 12 },
                        ]}
                      >
                        <View style={styles.bubbleInner}>
                          <Text style={[styles.messageText, styles.messageTextOwn]}>
                            {message.content}
                            <View style={{ width: 65, height: 1 }} />
                          </Text>
                          <View style={styles.ownMessageMetaAbsolute}>
                            {message.status === 'failed' ? (
                              <AlertCircle size={14} color={theme.tokens.text.onPrimary} />
                            ) : (
                              <>
                                <Text style={styles.messageTimeOwn}>
                                  {formatTime(message.timestamp)}
                                </Text>
                                {getStatusIcon()}
                              </>
                            )}
                          </View>
                        </View>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                </View>
                {message.reactions && message.reactions.length > 0 && (
                  <View style={[styles.reactionsContainer, styles.reactionsContainerOwn]}>
                    {message.reactions.map((reaction, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.reactionPill,
                          styles.reactionPillOwn,
                          reaction.userReacted && styles.reactionPillActiveOwn
                        ]}
                        onPress={() => onReact?.(message.id, reaction.emoji)}
                      >
                        <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                        <Text style={[
                          styles.reactionCount,
                          styles.reactionCountOwn,
                          reaction.userReacted && styles.reactionCountActiveOwn
                        ]}>
                          {reaction.count}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              {/* Failed message retry hint */}
              {message.status === 'failed' && (
                <TouchableOpacity
                  style={styles.retryHint}
                  onPress={handleRetry}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <AlertCircle size={12} color={theme.tokens.text.error} />
                  <Text style={styles.retryHintText}>Tap to retry</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'flex-start' }}>
              <View style={{ position: 'relative' }}>
                <View style={styles.incomingContainer}>
                  <TouchableOpacity
                    style={[
                      emojiInfo.isJumbo ? styles.jumboEmojiContainer : styles.bubble,
                      message.reactions && message.reactions.length > 0 && { marginBottom: 12 },
                      !emojiInfo.isJumbo && styles.bubbleIncoming
                    ]}
                    onPress={() => onPress(message)}
                    onLongPress={() => onLongPress(message)}
                    activeOpacity={0.8}
                  >
                    {emojiInfo.isJumbo ? (
                      <View>
                        <Text style={styles.jumboEmojiText}>
                          {message.content}
                        </Text>
                        <Text style={[styles.messageTimeInside, { marginTop: 4, textAlign: 'right' }]}>
                          {formatTime(message.timestamp)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.bubbleInner}>
                        <Text style={styles.messageText}>
                          {message.content}
                          <View style={{ width: 48, height: 1 }} />
                        </Text>
                        <View style={styles.messageMetaAbsolute}>
                          <Text style={styles.messageTimeInside}>
                            {formatTime(message.timestamp)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
                {message.reactions && message.reactions.length > 0 && (
                  <View style={[styles.reactionsContainer, styles.reactionsContainerIncoming]}>
                    {message.reactions.map((reaction, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.reactionPill,
                          styles.reactionPillIncoming,
                          reaction.userReacted && styles.reactionPillActiveIncoming
                        ]}
                        onPress={() => onReact?.(message.id, reaction.emoji)}
                      >
                        <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                        <Text style={[
                          styles.reactionCount,
                          styles.reactionCountIncoming,
                          reaction.userReacted && styles.reactionCountActiveIncoming
                        ]}>
                          {reaction.count}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </Animated.View >
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 8,
    width: '100%',
  },
  containerOwn: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    marginTop: 2,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.tokens.text.onPrimary,
  },
  messageContent: {
    maxWidth: '80%',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
    gap: 6,
  },
  messageSender: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.tokens.text.primary,
  },
  messageTime: {
    fontSize: 12,
    color: theme.tokens.text.tertiary,
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
  outgoingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: theme.tokens.border.subtle,
    shadowColor: theme.tokens.border.strong,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleOwn: {
    backgroundColor: theme.tokens.action.primary.default,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  bubbleFailed: {
    opacity: 0.8,
  },
  retryHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
    paddingRight: 4,
  },
  retryHintText: {
    fontSize: 12,
    color: theme.tokens.text.error,
    fontWeight: '500',
  },
  messageText: {
    fontSize: 16,
    color: theme.tokens.text.primary,
    lineHeight: 20,
    flexShrink: 1,
  },
  messageTextOwn: {
    color: theme.tokens.text.onPrimary,
  },
  bubbleInner: {
    flexDirection: 'column',
    position: 'relative',
  },
  bubbleIncoming: {
    backgroundColor: theme.tokens.bg.surface,
    borderRadius: 10,
  },
  ownMessageMetaAbsolute: {
    position: 'absolute',
    bottom: -2,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageMetaAbsolute: {
    position: 'absolute',
    bottom: -2,
    right: 0,
  },
  messageTimeOwn: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageTimeInside: {
    fontSize: 10,
    color: theme.tokens.text.tertiary,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'absolute',
    bottom: -8,
    gap: 4,
    zIndex: 10,
  },
  reactionsContainerOwn: {
    right: 4,
  },
  reactionsContainerIncoming: {
    left: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    height: 20,
    borderRadius: 10,
    gap: 2,
    borderWidth: 0,
  },
  reactionPillOwn: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  reactionPillIncoming: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  reactionPillActiveOwn: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  reactionPillActiveIncoming: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    fontWeight: '600',
  },
  reactionCountOwn: {
    color: theme.tokens.text.secondary,
  },
  reactionCountIncoming: {
    color: theme.tokens.text.secondary,
  },
  reactionCountActiveOwn: {
    color: theme.tokens.text.secondary,
  },
  reactionCountActiveIncoming: {
    color: theme.tokens.text.secondary,
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: 12,
    width: '100%',
  },
  systemMessageText: {
    fontSize: 12,
    color: theme.tokens.text.tertiary,
    backgroundColor: theme.tokens.bg.subtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  jumboEmojiContainer: {
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  jumboEmojiText: {
    fontSize: 48,
    lineHeight: 56,
  },
  ownMessageMetaJumbo: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
});

export default MessageBubble;
