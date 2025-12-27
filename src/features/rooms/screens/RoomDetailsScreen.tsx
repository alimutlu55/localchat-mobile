/**
 * Room Details Screen
 *
 * Shows room information, participants, and actions.
 *
 * Architecture:
 * - Receives roomId from navigation params
 * - Uses useRoom hook to fetch room data from RoomStore
 * - Optional initialRoom for optimistic rendering
 * - Uses useRoomActions for join/leave operations
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  X,
  Users,
  Clock,
  MapPin,
  Crown,
  LogOut,
  Lock,
  Ban,
  Flag,
  Shield,
  Share2,
  MessageCircle,
  Check,
  AlertCircle,
} from 'lucide-react-native';
import { RootStackParamList } from '../../../navigation/types';
import { roomService, ParticipantDTO, messageService } from '../../../services';
import { eventBus } from '../../../core/events';
import { Room, ChatMessage } from '../../../types';
import { useUserId } from '../../user/store';
import { useRoom, useRoomActions, useMyRooms } from '../hooks';
import { useRoomStore } from '../store';
import { ROOM_CONFIG, executeJoinWithMinLoading } from '../../../constants';
import { BannedUsersModal } from '../components';
import { ReportModal, ReportReason } from '../../../components/chat/ReportModal';
import { AvatarDisplay } from '../../../components/profile';
import { createLogger } from '../../../shared/utils/logger';
import { isUserBanned } from '../../../shared/utils/errors';

const log = createLogger('RoomDetails');

type JoinButtonState = 'default' | 'joining' | 'join-success' | 'joined' | 'error';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoomDetails'>;
type RoomDetailsRouteProp = RouteProp<RootStackParamList, 'RoomDetails'>;

/**
 * Participant Item Component
 */
interface ParticipantItemProps {
  participant: ParticipantDTO;
  isCreator: boolean;
  isCurrentUser: boolean;
}

function ParticipantItem({
  participant,
  isCreator,
  isCurrentUser,
}: ParticipantItemProps) {
  return (
    <View style={styles.participantItem}>
      <AvatarDisplay
        avatarUrl={participant.profilePhotoUrl}
        displayName={participant.displayName}
        size="md"
        style={{ width: 40, height: 40, borderRadius: 20 }}
      />
      <View style={styles.participantInfo}>
        <View style={styles.participantNameRow}>
          <Text style={styles.participantName}>
            {participant.displayName}
            {isCurrentUser && ' (You)'}
          </Text>
          {participant.role === 'creator' && (
            <Crown size={14} color="#f97316" />
          )}
        </View>
        <Text style={styles.participantRole}>
          {participant.role === 'creator' ? 'Room Creator' : 'Participant'}
        </Text>
      </View>
    </View>
  );
}

/**
 * Room Details Screen Component
 */
export default function RoomDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoomDetailsRouteProp>();

  // Support both new (roomId) and legacy (room) navigation params
  const params = route.params;
  const roomId = params.roomId || params.room?.id;
  const initialRoom = params.initialRoom || params.room;

  // Guard: roomId is required
  if (!roomId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Room Not Found</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>
    );
  }

  const userId = useUserId();
  const { isJoined: isRoomJoined } = useMyRooms();

  // Use RoomStore for updates
  const storeUpdateRoom = useRoomStore((s) => s.updateRoom);

  // Use useRoom hook for room data with caching
  // Falls back to initialRoom while loading
  const { room: fetchedRoom, isLoading: isRoomLoading, refresh: refreshRoom } = useRoom(roomId, {
    skipFetchIfCached: false, // Always fetch fresh data
  });

  // Priority: fetched room > initial room from params
  const room = fetchedRoom || initialRoom;

  // Handle case where room data is not available
  if (!room && !isRoomLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Room Not Found</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#6b7280', fontSize: 16 }}>This room is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading while we don't have room data
  if (!room) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <X size={24} color="#6b7280" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      </SafeAreaView>
    );
  }

  // Use new useRoomActions hook for join/leave/close operations
  const {
    joinRoom,
    leaveRoom,
    closeRoom,
    isLeaving: isLeavingAction,
    isClosing: isClosingAction,
    isJoining: isJoiningRoom,
  } = useRoomActions();

  // Use centralized hooks for joined status
  const hasJoined = isRoomJoined(roomId);
  const isJoiningOptimistic = isJoiningRoom(roomId);

  const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showBannedUsersModal, setShowBannedUsersModal] = useState(false);

  // Report state
  const [reportConfig, setReportConfig] = useState<{
    isOpen: boolean;
    targetType: 'message' | 'room' | 'user';
    targetData?: any;
  }>({
    isOpen: false,
    targetType: 'room',
  });

  const isCreator = room.isCreator || false;

  /**
   * Load participants and keep updated via WebSocket events
   */
  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const data = await roomService.getParticipants(roomId);
        setParticipants(data);

        // Update both legacy context and new store
        storeUpdateRoom(roomId, { participantCount: data.length });
        storeUpdateRoom(roomId, { participantCount: data.length });
      } catch (error) {
        log.error('Failed to load participants', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadParticipants();

    // Re-fetch participants when users join or leave via EventBus
    const unsubJoined = eventBus.on('room.userJoined', (payload) => {
      if (payload.roomId === roomId) {
        log.debug('User joined, refreshing participants');
        loadParticipants();
      }
    });

    const unsubLeft = eventBus.on('room.userLeft', (payload) => {
      if (payload.roomId === roomId) {
        log.debug('User left, refreshing participants');
        loadParticipants();
      }
    });

    return () => {
      unsubJoined();
      unsubLeft();
    };
  }, [roomId, storeUpdateRoom, storeUpdateRoom]);

  /**
   * Load recent messages - only if user has joined
   */
  useEffect(() => {
    const loadRecentMessages = async () => {
      log.debug('loadRecentMessages called', { hasJoined, roomId });

      // Only load messages if user has joined the room
      if (!hasJoined) {
        log.debug('Skipping message fetch - user has not joined');
        setRecentMessages([]);
        return;
      }

      log.debug('Fetching messages for joined user');

      // Small delay to ensure backend join is fully processed
      // This prevents race condition where fetch happens before join completes
      await new Promise(resolve => setTimeout(resolve, 200));

      setIsLoadingMessages(true);
      try {
        const { messages } = await messageService.getHistory(roomId, { limit: 3 });
        setRecentMessages(messages);
      } catch (error: any) {
        log.error('Failed to load recent messages', error);

        // If error is "not in room", it might be because user just left
        // Silently clear messages instead of showing error
        const errorMessage = error?.message || '';
        if (errorMessage.includes('must be in the room') ||
          errorMessage.includes('not in room') ||
          error?.code === 'FORBIDDEN') {
          log.debug('User not in room (may have just left), clearing messages');
          setRecentMessages([]);
        } else {
          setRecentMessages([]);
        }
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadRecentMessages();
  }, [roomId, hasJoined]);

  /**
   * Handle leave room
   */
  const handleLeave = () => {
    // Prevent if already leaving
    if (isLeavingAction(roomId)) {
      log.warn('Leave already in progress');
      return;
    }

    Alert.alert(
      'Leave Room',
      'Are you sure you want to leave this room?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const result = await leaveRoom(roomId);
            if (result.success) {
              navigation.popToTop();
            } else {
              log.error('Leave error', result.error);
              Alert.alert('Error', 'Failed to leave room');
            }
          },
        },
      ]
    );
  };

  /**
   * Handle close room (creator only)
   */
  const handleCloseRoom = () => {
    Alert.alert(
      'Close Room',
      'This will prevent any new messages. The room will become read-only.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Room',
          style: 'destructive',
          onPress: async () => {
            const result = await closeRoom(roomId);
            if (result.success) {
              Alert.alert('Success', 'Room has been closed');
              navigation.goBack();
            } else {
              log.error('Close room error', result.error);
              Alert.alert('Error', 'Failed to close room');
            }
          },
        },
      ]
    );
  };

  /**
   * Handle report room
   */
  const handleReport = () => {
    setReportConfig({
      isOpen: true,
      targetType: 'room',
      targetData: room,
    });
  };

  const handleSubmitReport = async (data: {
    reason: ReportReason;
    details: string;
    blockUser: boolean;
  }) => {
    try {
      if (reportConfig.targetType === 'room') {
        try {
          await roomService.reportRoom(roomId, data.reason, data.details);
        } catch (reportError: any) {
          // Handle "already reported" as success (idempotent)
          if (reportError?.message?.includes('already reported') ||
            reportError?.code === 'ALREADY_REPORTED' ||
            reportError?.status === 409) {
            log.debug('Room already reported - treating as success');
          } else {
            // Re-throw other errors
            throw reportError;
          }
        }

        // Auto-leave after reporting room (UX improvement)
        const result = await leaveRoom(roomId);
        if (!result.success) {
          log.error('Failed to leave room after report', result.error);
        }
        navigation.popToTop();
      }
    } catch (error) {
      log.error('Report submission failed', error);
      throw error;
    }
  };

  /**
   * Handle join room - uses new useRoomActions hook
   */
  const handleJoin = async () => {
    // If already joined, replace this modal with chat screen
    if (hasJoined) {
      navigation.replace('ChatRoom', { roomId, initialRoom: room });
      return;
    }

    const result = await joinRoom(room);

    if (result.success) {
      navigation.replace('ChatRoom', { roomId, initialRoom: room });
    } else if (isUserBanned(result.error)) {
      Alert.alert(
        'Access Denied',
        'You are banned from this room.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Error', 'Failed to join room. Please try again.');
    }
  };

  /**
   * Handle share room
   */
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join "${room.title}" on LocalChat!\nhttps://localchat.app/room/${roomId}`,
        title: room.title,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <X size={24} color="#6b7280" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Room Info</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Room Info Card */}
        <View style={styles.roomCard}>
          <View style={styles.roomEmoji}>
            <Text style={styles.emojiText}>{room.emoji}</Text>
          </View>
          <Text style={styles.roomTitle}>{room.title}</Text>
          {room.description && (
            <Text style={styles.roomDescription}>{room.description}</Text>
          )}

          {room.isHighActivity && (
            <View style={styles.highActivityBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.highActivityText}>High Activity</Text>
            </View>
          )}

          <View style={styles.roomStats}>
            <View style={styles.statItem}>
              <Users size={16} color="#6b7280" />
              <Text style={styles.statText}>
                {room.participantCount}/{room.maxParticipants}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Clock size={16} color="#6b7280" />
              <Text style={styles.statText}>{room.timeRemaining}</Text>
            </View>
            {room.distanceDisplay && (
              <View style={styles.statItem}>
                <MapPin size={16} color="#6b7280" />
                <Text style={styles.statText}>{room.distanceDisplay}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Recent Messages Section - Only show when user has joined */}
        {hasJoined && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Messages</Text>
            </View>
            {isLoadingMessages ? (
              <ActivityIndicator size="small" color="#f97316" style={styles.loader} />
            ) : recentMessages.length > 0 ? (
              <View style={styles.recentMessagesList}>
                {recentMessages.map((msg) => (
                  <View key={msg.id} style={styles.recentMessageItem}>
                    <View style={styles.recentMessageHeader}>
                      <Text style={styles.recentMessageUser}>{msg.userName}</Text>
                      <Text style={styles.recentMessageTime}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={styles.recentMessageText} numberOfLines={2}>
                      {msg.content}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyRecentMessages}>
                <Text style={styles.emptyRecentMessagesText}>No messages yet. Be the first!</Text>
              </View>
            )}
          </View>
        )}

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          {/* Creator Actions */}
          {isCreator && (
            <>
              {room.status !== 'closed' && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleCloseRoom}
                  disabled={isClosingAction(roomId)}
                >
                  <View style={[styles.actionIcon, styles.actionIconWarning]}>
                    <Lock size={20} color="#f59e0b" />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionText}>Close Room</Text>
                    <Text style={styles.actionSubtext}>Make room read-only</Text>
                  </View>
                  {isClosingAction(roomId) && <ActivityIndicator size="small" color="#f59e0b" />}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowBannedUsersModal(true)}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#fee2e2' }]}>
                  <Ban size={20} color="#ef4444" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionText}>Manage Bans</Text>
                  <Text style={styles.actionSubtext}>View and unban users</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Share Room */}
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
              <Share2 size={20} color="#3b82f6" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionText}>Share Room</Text>
              <Text style={styles.actionSubtext}>Invite friends to this chat</Text>
            </View>
          </TouchableOpacity>

          {/* Report Room */}
          <TouchableOpacity style={styles.actionButton} onPress={handleReport}>
            <View style={styles.actionIcon}>
              <Flag size={20} color="#6b7280" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionText}>Report Room</Text>
              <Text style={styles.actionSubtext}>Flag inappropriate content</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Participants Section - moved to end */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Participants ({participants.length})
            </Text>
          </View>

          {isLoading ? (
            <ActivityIndicator size="small" color="#f97316" style={styles.loader} />
          ) : (
            <View style={styles.participantList}>
              {participants.map((participant) => (
                <ParticipantItem
                  key={participant.userId}
                  participant={participant}
                  isCreator={participant.role === 'creator'}
                  isCurrentUser={participant.userId === userId}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Unified Bottom Button (Join/Enter) - STICKY - Moved outside ScrollView */}
      <View style={styles.stickyFooter}>
        <TouchableOpacity
          style={[
            hasJoined ? styles.enterButton : styles.joinButton,
            isJoiningOptimistic && { opacity: 0.8 },
          ]}
          onPress={handleJoin}
          disabled={isJoiningOptimistic}
          activeOpacity={0.8}
        >
          {isJoiningOptimistic ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.joinButtonText}>Joining...</Text>
            </View>
          ) : hasJoined ? (
            <View style={styles.enterButtonContent}>
              <MessageCircle size={20} color="#ffffff" />
              <Text style={styles.enterButtonText}>Enter Room</Text>
            </View>
          ) : (
            <Text style={styles.joinButtonText}>Join Room</Text>
          )}
        </TouchableOpacity>

        {/* Small Leave link below main button - only for joined members */}
        {hasJoined && !isCreator && (
          <TouchableOpacity
            style={styles.leaveLinkContainer}
            onPress={handleLeave}
            disabled={isLeavingAction(roomId)}
            activeOpacity={0.7}
          >
            {isLeavingAction(roomId) ? (
              <ActivityIndicator size="small" color="#64748b" />
            ) : (
              <Text style={styles.leaveLink}>
                Leave Room • You can rejoin anytime
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <BannedUsersModal
        roomId={roomId}
        isOpen={showBannedUsersModal}
        onClose={() => setShowBannedUsersModal(false)}
      />

      <ReportModal
        isOpen={reportConfig.isOpen}
        onClose={() => setReportConfig(prev => ({ ...prev, isOpen: false }))}
        onSubmit={handleSubmitReport}
        targetType={reportConfig.targetType}
        targetName={room.title}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  roomCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roomEmoji: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emojiText: {
    fontSize: 32,
  },
  roomTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  roomDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  roomStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  loader: {
    paddingVertical: 20,
  },
  participantList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  participantInfo: {
    flex: 1,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  participantRole: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  participantActions: {
    flexDirection: 'row',
    gap: 8,
  },
  kickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    gap: 4,
  },
  banButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionIconWarning: {
    backgroundColor: '#fef3c7',
  },
  actionIconDanger: {
    backgroundColor: '#fef2f2',
  },
  actionContent: {
    flex: 1,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  actionTextDanger: {
    color: '#ef4444',
  },
  actionSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  recentMessagesList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
  },
  recentMessageItem: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 8,
  },
  recentMessageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  recentMessageUser: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  recentMessageTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  recentMessageText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 18,
  },
  emptyRecentMessages: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyRecentMessagesText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  footerAction: {
    marginTop: 8,
    marginBottom: 24,
  },
  stickyFooter: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  leaveLinkContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  leaveLink: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinButton: {
    backgroundColor: '#f97316',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  enterButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  enterButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  enterButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  highActivityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  highActivityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
});

