/**
 * Room Details Screen
 *
 * Shows room information, participants, and actions.
 * Refactored to display as a Full Screen View (Page Layout).
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  X,
  Users,
  Clock,
  Crown,
  Lock,
  Flag,
  Share2,
} from 'lucide-react-native';
import { RootStackParamList } from '../../../navigation/types';
import { roomService, ParticipantDTO, messageService } from '../../../services';
import { eventBus } from '../../../core/events';
import { ChatMessage } from '../../../types';
import { useUserId } from '../../user/store';
import { useRoom, useRoomOperations, useRoomMembership } from '../hooks';
import { useUserLocation } from '../../discovery/hooks';
import { useRoomStore } from '../store';
import { BannedUsersModal } from '../components';
import { ParticipantItem } from '../../../components/room';
import { ReportModal, ReportReason } from '../../../components/chat/ReportModal';
import { AvatarDisplay } from '../../../components/profile';
import { createLogger } from '../../../shared/utils/logger';
import { isUserBanned, isAlreadyReported } from '../../../shared/utils/errors';

const log = createLogger('RoomDetails');

/**
 * Serializes a room object for safe navigation (replaces Dates with strings)
 */
const serializeRoom = (room: any): any => {
  if (!room) return room;
  return {
    ...room,
    expiresAt: room.expiresAt instanceof Date ? room.expiresAt.toISOString() : room.expiresAt,
    createdAt: room.createdAt instanceof Date ? room.createdAt.toISOString() : room.createdAt,
  };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoomDetails'>;
type RoomDetailsRouteProp = RouteProp<RootStackParamList, 'RoomDetails'>;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Participant Item Component
 */
interface ParticipantItemProps {
  participant: ParticipantDTO;
  isCreator: boolean;
  isCurrentUser: boolean;
  canModerate?: boolean;
  onKick?: (userId: string, displayName: string) => void;
  onBan?: (userId: string, displayName: string) => void;
}

function RoomParticipantItem({
  participant,
  isCreator,
  isCurrentUser,
  canModerate,
  onKick,
  onBan,
}: ParticipantItemProps) {
  return (
    <ParticipantItem
      participant={participant}
      isCreator={isCreator}
      isCurrentUser={isCurrentUser}
      canModerate={canModerate}
      onKick={onKick}
      onBan={onBan}
    />
  );
}

/**
 * Room Details Screen Component
 * Full Screen Layout (Not Card, Not Modal in visual style)
 */
export default function RoomDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoomDetailsRouteProp>();
  const insets = useSafeAreaInsets();

  // Support both new (roomId) and legacy (room) navigation params
  const params = route.params;
  const roomId = params.roomId || params.room?.id;
  const initialRoom = params.initialRoom || params.room;

  // Helpers to close modal
  const handleClose = () => navigation.goBack();

  // Guard: roomId is required
  if (!roomId) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContent}>
          <Text style={styles.errorTitle}>Room Not Found</Text>
        </View>
      </View>
    );
  }

  const userId = useUserId();

  // Use RoomStore for updates
  const storeUpdateRoom = useRoomStore((s) => s.updateRoom);
  const storeGetRoom = useRoomStore((s) => s.getRoom);

  // Use useRoom hook for room data with caching
  const { room: fetchedRoom, isLoading: isRoomLoading } = useRoom(roomId, {
    skipFetchIfCached: false,
  });

  // Priority: fetched room > initial room from params
  const room = fetchedRoom || initialRoom;

  // Use new hooks for membership and operations
  const {
    isJoined,
    isCreator,
    roleLabel,
  } = useRoomMembership(roomId);

  const {
    join,
    leave,
    close,
    isJoining,
    isLeaving,
    isClosing,
  } = useRoomOperations();

  // Get user location for join proximity validation
  const { location: userLocation } = useUserLocation();

  const isJoiningOptimistic = isJoining(roomId);

  // Handle case where room data is not available
  if (!room && !isRoomLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Unavailable</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContent}>
          <Text style={styles.errorTitle}>Room Not Found</Text>
          <Text style={styles.errorText}>This room is no longer available.</Text>
        </View>
      </View>
    );
  }

  // Show loading
  if (!room) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#FF6410" />
          <Text style={styles.loadingText}>Loading room...</Text>
        </View>
      </View>
    );
  }

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

  /**
   * Load participants
   */
  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const data = await roomService.getParticipants(roomId);
        setParticipants(data);
        storeUpdateRoom(roomId, { participantCount: data.length });
      } catch (error) {
        log.error('Failed to load participants', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadParticipants();

    const unsubJoined = eventBus.on('room.userJoined', (payload) => {
      if (payload.roomId === roomId) {
        loadParticipants();
      }
    });

    const unsubLeft = eventBus.on('room.userLeft', (payload) => {
      if (payload.roomId === roomId) {
        loadParticipants();
      }
    });

    return () => {
      unsubJoined();
      unsubLeft();
    };
  }, [roomId, storeUpdateRoom]);

  /**
   * Load recent messages
   */
  useEffect(() => {
    const loadRecentMessages = async () => {
      if (!isJoined) {
        setRecentMessages([]);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      setIsLoadingMessages(true);
      try {
        const { messages } = await messageService.getHistory(roomId, { limit: 3 });
        setRecentMessages(messages);
      } catch (error: any) {
        setRecentMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadRecentMessages();
  }, [roomId, isJoined]);

  const handleLeave = () => {
    if (isLeaving(roomId)) return;
    Alert.alert(
      'Leave Room',
      'Are you sure you want to leave this room?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const result = await leave(roomId);
            if (result.success) {
              navigation.popToTop();
            } else {
              Alert.alert('Error', result.error?.message || 'Failed to leave room');
            }
          },
        },
      ]
    );
  };

  const handleCloseRoom = () => {
    if (isClosing(roomId)) return;
    Alert.alert(
      'Close Room',
      'This will prevent any new messages. The room will become read-only.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Room',
          style: 'destructive',
          onPress: async () => {
            const result = await close(roomId);
            if (result.success) {
              Alert.alert('Success', 'Room has been closed');
              handleClose();
            } else {
              Alert.alert('Error', result.error?.message || 'Failed to close room');
            }
          },
        },
      ]
    );
  };

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
      await roomService.reportRoom(roomId, data.reason, data.details);
    } catch (error) {
      if (isAlreadyReported(error)) {
        log.info('Room already reported, treating as success', { roomId });
        return;
      }
      log.error('Report submission failed', error);
      throw error;
    }
  };

  const handleJoin = async () => {
    const serializedRoom = serializeRoom(room);
    if (isJoined) {
      navigation.replace('ChatRoom', { roomId, initialRoom: serializedRoom });
      return;
    }

    // Use user location if available, otherwise fallback to room location (assume user is there)
    // This allows users without location permission to join rooms they can see.
    const effectiveLocation = userLocation || {
      latitude: room.latitude ?? 0,
      longitude: room.longitude ?? 0
    };

    const result = await join(room, { latitude: effectiveLocation.latitude, longitude: effectiveLocation.longitude });

    if (result.success) {
      // Get fresh room data from store
      const freshRoom = storeGetRoom(roomId);
      const freshSerializedRoom = freshRoom ? serializeRoom(freshRoom) : serializedRoom;
      navigation.replace('ChatRoom', { roomId, initialRoom: freshSerializedRoom });
    } else if (result.error && isUserBanned(result.error)) {
      Alert.alert(
        'Access Denied',
        'You are banned from this room.',
        [{ text: 'OK', onPress: handleClose }]
      );
    } else {
      Alert.alert('Error', result.error?.message || 'Failed to join room. Please try again.');
    }
  };


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

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Room Details</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Room Info */}
        <View style={styles.roomHeaderSection}>
          <View style={styles.roomEmoji}>
            <Text style={styles.emojiText}>{room.emoji}</Text>
          </View>
          <Text style={styles.roomTitle}>{room.title}</Text>
          {room.description && (
            <Text style={styles.roomDescription}>{room.description}</Text>
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
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionSection}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <TouchableOpacity style={styles.actionRow} onPress={handleShare}>
            <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
              <Share2 size={20} color="#3b82f6" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>Share Room</Text>
              <Text style={styles.actionSub}>Invite friends to this chat</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={handleReport}>
            <View style={[styles.actionIcon, { backgroundColor: '#f3f4f6' }]}>
              <Flag size={20} color="#6b7280" />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>Report Room</Text>
              <Text style={styles.actionSub}>Flag inappropriate content</Text>
            </View>
          </TouchableOpacity>

          {isCreator && (
            <TouchableOpacity style={styles.actionRow} onPress={handleCloseRoom}>
              <View style={[styles.actionIcon, { backgroundColor: '#fff7ed' }]}>
                <Lock size={20} color="#FF6410" />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionLabel}>Close Room</Text>
                <Text style={styles.actionSub}>Make room read-only</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Participants */}
        <View style={styles.participantsSection}>
          <Text style={styles.sectionTitle}>Participants ({participants.length})</Text>
          {participants.map((p) => (
            <RoomParticipantItem
              key={p.userId}
              participant={p}
              isCreator={p.role === 'creator'}
              isCurrentUser={p.userId === userId}
            />
          ))}
        </View>
      </ScrollView>

      {/* Footer Button - Fixed at bottom safe area */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          style={[
            styles.mainButton,
            isJoiningOptimistic && { opacity: 0.8 },
            isJoined && styles.enterButton
          ]}
          onPress={handleJoin}
          disabled={isJoiningOptimistic}
        >
          {isJoiningOptimistic ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.mainButtonText}>
              {isJoined ? 'Enter Room' : 'Join Room'}
            </Text>
          )}
        </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  roomHeaderSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  roomEmoji: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emojiText: {
    fontSize: 40,
  },
  roomTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  roomDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  roomStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  actionSection: {
    marginBottom: 32,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 16,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  actionSub: {
    fontSize: 13,
    color: '#6b7280',
  },
  participantsSection: {
    marginBottom: 40,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  participantInfo: {
    marginLeft: 12,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  participantRole: {
    fontSize: 13,
    color: '#9ca3af',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  mainButton: {
    backgroundColor: '#FF6410',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#FF6410',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  enterButton: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
  },
  mainButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  // Error Styles
  errorContent: {
    padding: 24,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
  },
  errorText: {
    marginTop: 8,
    color: '#6b7280',
    textAlign: 'center',
  },
  loadingContent: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#6b7280',
  }
});
