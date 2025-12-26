/**
 * MapHeader Component
 *
 * Header bar for the map screen with:
 * - User avatar (opens profile drawer)
 * - Room count indicator
 * - Refresh button
 * - My rooms button (opens sidebar)
 *
 * Extracted from MapScreen for better separation of concerns.
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { RefreshCw, ChevronRight } from 'lucide-react-native';
import { AvatarDisplay } from '../../../components/profile';

interface MapHeaderProps {
  /** User avatar URL */
  avatarUrl?: string;
  /** User display name */
  displayName: string;
  /** Number of rooms visible */
  roomCount: number;
  /** Whether refreshing rooms */
  isRefreshing: boolean;
  /** Number of user's active rooms */
  myRoomsCount: number;
  /** Handler for profile button press */
  onProfilePress: () => void;
  /** Handler for refresh button press */
  onRefreshPress: () => void;
  /** Handler for my rooms button press */
  onMyRoomsPress: () => void;
  /** Safe area top inset */
  topInset: number;
}

export function MapHeader({
  avatarUrl,
  displayName,
  roomCount,
  isRefreshing,
  myRoomsCount,
  onProfilePress,
  onRefreshPress,
  onMyRoomsPress,
  topInset,
}: MapHeaderProps) {
  return (
    <View style={[styles.container, { paddingTop: topInset + 8 }]}>
      {/* Left: Profile Avatar */}
      <TouchableOpacity
        style={styles.avatarButton}
        onPress={onProfilePress}
        activeOpacity={0.8}
      >
        <AvatarDisplay
          avatarUrl={avatarUrl}
          displayName={displayName}
          size="md"
          style={styles.avatar}
        />
      </TouchableOpacity>

      {/* Center: Room Count & Refresh */}
      <View style={styles.centerSection}>
        <View style={styles.roomCountCard}>
          <Text style={styles.roomCountText}>
            {roomCount} {roomCount === 1 ? 'room' : 'rooms'} nearby
          </Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefreshPress}
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (
              <RefreshCw size={16} color="#f97316" strokeWidth={2} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Right: My Rooms */}
      <TouchableOpacity
        style={styles.myRoomsButton}
        onPress={onMyRoomsPress}
        activeOpacity={0.8}
      >
        <Text style={styles.myRoomsText}>My Rooms</Text>
        {myRoomsCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{myRoomsCount}</Text>
          </View>
        )}
        <ChevronRight size={16} color="#6b7280" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  roomCountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  roomCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  refreshButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myRoomsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  myRoomsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default MapHeader;
