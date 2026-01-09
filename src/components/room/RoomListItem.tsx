/**
 * Room List Item Component
 *
 * Enhanced room item for lists with:
 * - Emoji icon
 * - Participant count
 * - Time ago / expiry status
 * - Category badge
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Users, Clock, MapPin } from 'lucide-react-native';
import { Room } from '../../types';
import { calculateDistance } from '../../utils/geo';
import { formatDistanceShort, formatTimeRemaining, isExpiringSoon } from '../../utils/format';

interface RoomListItemProps {
  room: Room;
  onPress: (room: Room) => void;
  showDistance?: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
}


export function RoomListItem({
  room,
  onPress,
  showDistance = false,
  userLocation,
}: RoomListItemProps) {
  const isExpiringSoon = room.expiresAt &&
    (room.expiresAt.getTime() - Date.now()) < 30 * 60 * 1000; // < 30 min

  const distance = showDistance && userLocation && room.latitude && room.longitude
    ? calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      room.latitude,
      room.longitude
    )
    : null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(room)}
      activeOpacity={0.7}
    >
      {/* Emoji */}
      <View style={styles.emojiContainer}>
        <Text style={styles.emoji}>{room.emoji || '💬'}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {room.title}
        </Text>

        <View style={styles.meta}>
          {/* Participants */}
          <View style={styles.metaItem}>
            <Users size={12} color="#9ca3af" />
            <Text style={styles.metaText}>{room.participantCount}</Text>
          </View>

          {/* Distance */}
          {distance !== null && (
            <View style={styles.metaItem}>
              <MapPin size={12} color="#9ca3af" />
              <Text style={styles.metaText}>{formatDistanceShort(distance)}</Text>
            </View>
          )}

          {/* Time remaining */}
          {room.expiresAt && (
            <View style={[
              styles.metaItem,
              isExpiringSoon && styles.expiringBadge,
            ]}>
              <Clock size={12} color={isExpiringSoon ? '#FF6410' : '#9ca3af'} />
              <Text style={[
                styles.metaText,
                isExpiringSoon && styles.expiringText,
              ]}>
                {formatTimeRemaining(room.expiresAt)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Category Badge */}
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryText}>
          {room.category?.replace('_', ' ') || 'General'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  emojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 24,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  expiringBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expiringText: {
    color: '#FF6410',
    fontWeight: '500',
  },
  categoryBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'capitalize',
  },
});

export default RoomListItem;

