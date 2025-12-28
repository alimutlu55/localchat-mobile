/**
 * System Message Component
 *
 * Displays system events in the chat:
 * - User joined
 * - User left
 * - User kicked
 * - User banned
 * - Room closed
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../core/theme';
import {
  UserPlus,
  UserMinus,
  UserX,
  Ban,
  Lock,
  Info,
} from 'lucide-react-native';

export type SystemMessageType =
  | 'user_joined'
  | 'user_left'
  | 'user_kicked'
  | 'user_banned'
  | 'room_closed'
  | 'info';

interface SystemMessageProps {
  type: SystemMessageType;
  content: string;
  timestamp?: Date;
}

export function SystemMessage({ type, content, timestamp }: SystemMessageProps) {
  const getIcon = () => {
    const iconSize = 14;
    const iconColor = getIconColor();

    switch (type) {
      case 'user_joined':
        return <UserPlus size={iconSize} color={iconColor} />;
      case 'user_left':
        return <UserMinus size={iconSize} color={iconColor} />;
      case 'user_kicked':
        return <UserX size={iconSize} color={iconColor} />;
      case 'user_banned':
        return <Ban size={iconSize} color={iconColor} />;
      case 'room_closed':
        return <Lock size={iconSize} color={iconColor} />;
      default:
        return <Info size={iconSize} color={iconColor} />;
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'user_joined':
        return theme.tokens.status.success.main;
      case 'user_left':
        return theme.tokens.text.tertiary;
      case 'user_kicked':
        return theme.tokens.brand.primary;
      case 'user_banned':
        return theme.tokens.status.error.main;
      case 'room_closed':
        return theme.tokens.text.secondary;
      default:
        return theme.tokens.text.secondary;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'user_joined':
        return theme.tokens.status.success.bg;
      case 'user_left':
        return theme.tokens.bg.subtle;
      case 'user_kicked':
        return theme.tokens.action.secondary.default;
      case 'user_banned':
        return theme.tokens.status.error.bg;
      case 'room_closed':
        return theme.tokens.bg.subtle;
      default:
        return theme.tokens.bg.subtle;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: getBackgroundColor() }]}>
        {getIcon()}
        <Text style={styles.text}>{content}</Text>
        {timestamp && (
          <Text style={styles.time}>{formatTime(timestamp)}</Text>
        )}
      </View>
    </View>
  );
}

/**
 * Create a system message for user events
 */
export function createSystemMessage(
  type: SystemMessageType,
  userName: string
): string {
  switch (type) {
    case 'user_joined':
      return `${userName} joined the room`;
    case 'user_left':
      return `${userName} left the room`;
    case 'user_kicked':
      return `${userName} was removed from the room`;
    case 'user_banned':
      return `${userName} was banned from the room`;
    case 'room_closed':
      return 'This room has been closed';
    default:
      return userName;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  text: {
    fontSize: 12,
    color: theme.tokens.text.secondary,
  },
  time: {
    fontSize: 10,
    color: theme.tokens.text.tertiary,
    marginLeft: 4,
  },
});

export default SystemMessage;

