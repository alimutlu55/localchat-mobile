/**
 * Rooms Screen
 *
 * Shows user's joined and created rooms.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MessageCircle, Plus, Users, Clock, Crown } from 'lucide-react-native';
import { RootStackParamList } from '../../navigation/types';
import { roomService } from '../../services';
import { Room } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RoomsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [joinedRooms, setJoinedRooms] = useState<Room[]>([]);
  const [createdRooms, setCreatedRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'joined' | 'created'>('joined');

  /**
   * Fetch rooms on focus
   */
  useFocusEffect(
    useCallback(() => {
      fetchRooms();
    }, [])
  );

  /**
   * Fetch user's rooms
   */
  const fetchRooms = async () => {
    try {
      const [joined, created] = await Promise.all([
        roomService.getMyRooms(),
        roomService.getCreatedRooms(),
      ]);
      setJoinedRooms(joined);
      setCreatedRooms(created);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchRooms();
  };

  /**
   * Navigate to room - check if user needs to join first
   */
  const handleRoomPress = (room: Room) => {
    // If user hasn't joined (e.g., was kicked), show room details with join button
    // Otherwise, go directly to chat
    if (!room.hasJoined && !room.isCreator) {
      navigation.navigate('RoomDetails', { roomId: room.id, initialRoom: room });
    } else {
      navigation.navigate('ChatRoom', { roomId: room.id, initialRoom: room });
    }
  };

  /**
   * Navigate to create room
   */
  const handleCreateRoom = () => {
    navigation.navigate('CreateRoom');
  };

  /**
   * Render room item
   */
  const renderRoomItem = ({ item: room }: { item: Room }) => (
    <TouchableOpacity
      style={styles.roomCard}
      onPress={() => handleRoomPress(room)}
      activeOpacity={0.7}
    >
      <View style={styles.roomEmoji}>
        <Text style={styles.emojiText}>{room.emoji}</Text>
      </View>

      <View style={styles.roomContent}>
        <View style={styles.roomHeader}>
          <Text style={styles.roomTitle} numberOfLines={1}>
            {room.title}
          </Text>
          {room.isCreator && (
            <View style={styles.creatorBadge}>
              <Crown size={12} color="#f97316" />
            </View>
          )}
        </View>

        <View style={styles.roomMeta}>
          <View style={styles.metaItem}>
            <Users size={14} color="#9ca3af" />
            <Text style={styles.metaText}>
              {room.participantCount}/{room.maxParticipants}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Clock size={14} color="#9ca3af" />
            <Text style={styles.metaText}>{room.timeRemaining}</Text>
          </View>
        </View>
      </View>

      <View style={[
        styles.statusDot,
        room.status === 'active' ? styles.statusActive : styles.statusInactive,
      ]} />
    </TouchableOpacity>
  );

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MessageCircle size={48} color="#d1d5db" />
      <Text style={styles.emptyTitle}>
        {activeTab === 'joined' ? 'No rooms yet' : 'No rooms created'}
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'joined'
          ? 'Explore the map to find and join rooms nearby'
          : 'Start a conversation in your area'}
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={handleCreateRoom}
      >
        <Plus size={18} color="#ffffff" />
        <Text style={styles.emptyButtonText}>Create Room</Text>
      </TouchableOpacity>
    </View>
  );

  const rooms = activeTab === 'joined' ? joinedRooms : createdRooms;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Rooms</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'joined' && styles.tabActive]}
          onPress={() => setActiveTab('joined')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'joined' && styles.tabTextActive,
          ]}>
            Joined ({joinedRooms.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'created' && styles.tabActive]}
          onPress={() => setActiveTab('created')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'created' && styles.tabTextActive,
          ]}>
            Created ({createdRooms.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Room List */}
      <FlatList
        data={rooms}
        renderItem={renderRoomItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#f97316"
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* Create FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateRoom}
        activeOpacity={0.8}
      >
        <Plus size={28} color="#ffffff" strokeWidth={2.5} />
      </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#fff7ed',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#f97316',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roomEmoji: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emojiText: {
    fontSize: 24,
  },
  roomContent: {
    flex: 1,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  creatorBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
  statusActive: {
    backgroundColor: '#22c55e',
  },
  statusInactive: {
    backgroundColor: '#d1d5db',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

