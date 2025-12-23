/**
 * Room Details Screen
 *
 * Shows room information, participants, and actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  UserX,
  Shield,
  Share2,
  MessageCircle,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/types';
import { roomService, ParticipantDTO, messageService } from '../services';
import { Room, ChatMessage } from '../types';
import { useAuth } from '../context/AuthContext';
import { BannedUsersModal } from '../components/room/BannedUsersModal';
import { ReportModal, ReportReason } from '../components/chat/ReportModal';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RoomDetails'>;
type RoomDetailsRouteProp = RouteProp<RootStackParamList, 'RoomDetails'>;

/**
 * Participant Item Component
 */
interface ParticipantItemProps {
  participant: ParticipantDTO;
  isCreator: boolean;
  isCurrentUser: boolean;
  canModerate: boolean;
  onKick: () => void;
  onBan: () => void;
}

function ParticipantItem({
  participant,
  isCreator,
  isCurrentUser,
  canModerate,
  onKick,
  onBan,
}: ParticipantItemProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <TouchableOpacity
      style={styles.participantItem}
      onPress={() => canModerate && !isCurrentUser && setShowActions(!showActions)}
      activeOpacity={canModerate && !isCurrentUser ? 0.7 : 1}
    >
      <View style={styles.participantAvatar}>
        <Text style={styles.participantAvatarText}>
          {participant.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
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

      {showActions && canModerate && !isCurrentUser && participant.role !== 'creator' && (
        <View style={styles.participantActions}>
          <TouchableOpacity style={styles.kickButton} onPress={onKick}>
            <UserX size={16} color="#f97316" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.banButton} onPress={onBan}>
            <Ban size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * Room Details Screen Component
 */
export default function RoomDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoomDetailsRouteProp>();
  const { room } = route.params;
  const { user } = useAuth();

  const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showBannedUsersModal, setShowBannedUsersModal] = useState(false);

  // Report State
  const [reportConfig, setReportConfig] = useState<{
    isOpen: boolean;
    targetType: 'message' | 'room' | 'user';
    targetData?: any;
  }>({
    isOpen: false,
    targetType: 'room',
  });

  const isCreator = room.isCreator || false;
  const hasJoined = room.hasJoined || false;

  /**
   * Load participants
   */
  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const data = await roomService.getParticipants(room.id);
        setParticipants(data);
      } catch (error) {
        console.error('Failed to load participants:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadParticipants();
  }, [room.id]);

  /**
   * Load recent messages - only if user has joined
   */
  useEffect(() => {
    const loadRecentMessages = async () => {
      console.log('[RoomDetailsScreen] loadRecentMessages called, hasJoined:', hasJoined, 'roomId:', room.id);

      // Only load messages if user has joined the room
      if (!hasJoined) {
        console.log('[RoomDetailsScreen] Skipping message fetch - user has not joined');
        setRecentMessages([]);
        return;
      }

      console.log('[RoomDetailsScreen] Fetching messages for joined user');
      setIsLoadingMessages(true);
      try {
        const { messages } = await messageService.getHistory(room.id, { limit: 3 });
        setRecentMessages(messages);
      } catch (error) {
        console.error('Failed to load recent messages:', error);
        setRecentMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadRecentMessages();
  }, [room.id, hasJoined]);

  /**
   * Handle leave room
   */
  const handleLeave = () => {
    Alert.alert(
      'Leave Room',
      'Are you sure you want to leave this room?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setIsLeaving(true);
            try {
              await roomService.leaveRoom(room.id);
              navigation.popToTop();
            } catch (error) {
              Alert.alert('Error', 'Failed to leave room');
            } finally {
              setIsLeaving(false);
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
            setIsClosing(true);
            try {
              await roomService.closeRoom(room.id);
              Alert.alert('Success', 'Room has been closed');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to close room');
            } finally {
              setIsClosing(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Handle kick user
   */
  const handleKick = (participant: ParticipantDTO) => {
    Alert.alert(
      'Remove User',
      `Remove ${participant.displayName} from this room?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await roomService.kickUser(room.id, participant.userId);
              setParticipants(prev => prev.filter(p => p.userId !== participant.userId));
            } catch (error) {
              Alert.alert('Error', 'Failed to remove user');
            }
          },
        },
      ]
    );
  };

  /**
   * Handle ban user
   */
  const handleBan = (participant: ParticipantDTO) => {
    Alert.alert(
      'Ban User',
      `Ban ${participant.displayName} from this room? They won't be able to rejoin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban',
          style: 'destructive',
          onPress: async () => {
            try {
              await roomService.banUser(room.id, participant.userId);
              setParticipants(prev => prev.filter(p => p.userId !== participant.userId));
            } catch (error) {
              Alert.alert('Error', 'Failed to ban user');
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
    leaveRoom: boolean;
  }) => {
    try {
      if (reportConfig.targetType === 'room') {
        await roomService.reportRoom(room.id, data.reason, data.details);
      }

      if (data.leaveRoom) {
        await roomService.leaveRoom(room.id);
        navigation.popToTop();
      }
    } catch (error) {
      console.error('Report submission failed:', error);
      throw error;
    }
  };

  /**
   * Handle join room
   */
  const handleJoin = async () => {
    setIsJoining(true);
    try {
      // We need user location to join (privacy randomization happens in service)
      // Since map already has it, we might want to pass it or get it again
      // For now, let's assume we can use a default or get it if available
      // In a real app, we'd probably have a LocationContext
      await roomService.joinRoom(room.id, room.latitude || 0, room.longitude || 0);
      Alert.alert('Success', 'Joined room successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('ChatRoom', { room: { ...room, hasJoined: true } }) }
      ]);
    } catch (error) {
      console.error('Join error:', error);
      Alert.alert('Error', 'Failed to join room. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  /**
   * Handle share room
   */
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join "${room.title}" on LocalChat!\nhttps://localchat.app/room/${room.id}`,
        title: room.title,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  /**
   * Render participant item
   */
  const renderParticipant = ({ item }: { item: ParticipantDTO }) => (
    <ParticipantItem
      participant={item}
      isCreator={item.role === 'creator'}
      isCurrentUser={item.userId === user?.id}
      canModerate={isCreator}
      onKick={() => handleKick(item)}
      onBan={() => handleBan(item)}
    />
  );

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

        {/* Participants Section */}
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
                  isCurrentUser={participant.userId === user?.id}
                  canModerate={isCreator}
                  onKick={() => handleKick(participant)}
                  onBan={() => handleBan(participant)}
                />
              ))}
            </View>
          )}
        </View>

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
                  disabled={isClosing}
                >
                  <View style={[styles.actionIcon, styles.actionIconWarning]}>
                    <Lock size={20} color="#f59e0b" />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionText}>Close Room</Text>
                    <Text style={styles.actionSubtext}>Make room read-only</Text>
                  </View>
                  {isClosing && <ActivityIndicator size="small" color="#f59e0b" />}
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

          {/* Leave Room */}
          {hasJoined && !isCreator && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleLeave}
              disabled={isLeaving}
            >
              <View style={[styles.actionIcon, styles.actionIconDanger]}>
                <LogOut size={20} color="#ef4444" />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionText, styles.actionTextDanger]}>Leave Room</Text>
                <Text style={styles.actionSubtext}>Exit this chat</Text>
              </View>
              {isLeaving && <ActivityIndicator size="small" color="#ef4444" />}
            </TouchableOpacity>
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

        {/* Join Button (Sticky at bottom if not joined) */}
        {!hasJoined && (
          <View style={styles.footerAction}>
            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleJoin}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.joinButtonText}>Join Room</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Enter Room Button (for users who have already joined) */}
        {hasJoined && (
          <View style={styles.footerAction}>
            <TouchableOpacity
              style={styles.enterButton}
              onPress={() => navigation.navigate('ChatRoom', { room })}
            >
              <View style={styles.enterButtonContent}>
                <MessageCircle size={20} color="#ffffff" />
                <Text style={styles.enterButtonText}>Enter Room</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <BannedUsersModal
        roomId={room.id}
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  banButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
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

