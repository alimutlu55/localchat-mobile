/**
 * Date Separator Component
 *
 * Displays a date divider between message groups.
 * Shows "Today", "Yesterday", or the full date.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DateSeparatorProps {
  date: Date;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const formatDate = (d: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (targetDate.getTime() === today.getTime()) {
      return 'Today';
    }

    if (targetDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }

    // Check if same year
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    }

    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={styles.badge}>
        <Text style={styles.text}>{formatDate(date)}</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
}

/**
 * Check if two dates are on different days
 */
export function shouldShowDateSeparator(
  currentMessage: { timestamp: Date },
  previousMessage: { timestamp: Date } | null
): boolean {
  if (!previousMessage) return true;

  const current = currentMessage.timestamp;
  const previous = previousMessage.timestamp;

  return (
    current.getDate() !== previous.getDate() ||
    current.getMonth() !== previous.getMonth() ||
    current.getFullYear() !== previous.getFullYear()
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  badge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginHorizontal: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
});

export default DateSeparator;

