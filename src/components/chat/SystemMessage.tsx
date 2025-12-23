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
        return '#22c55e'; // green
      case 'user_left':
        return '#9ca3af'; // gray
      case 'user_kicked':
        return '#f97316'; // orange
      case 'user_banned':
        return '#ef4444'; // red
      case 'room_closed':
        return '#6b7280'; // gray
      default:
        return '#6b7280';
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'user_joined':
        return '#f0fdf4';
      case 'user_left':
        return '#f3f4f6';
      case 'user_kicked':
        return '#fff7ed';
      case 'user_banned':
        return '#fef2f2';
      case 'room_closed':
        return '#f3f4f6';
      default:
        return '#f3f4f6';
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
    color: '#6b7280',
  },
  time: {
    fontSize: 10,
    color: '#9ca3af',
    marginLeft: 4,
  },
});

export default SystemMessage;

