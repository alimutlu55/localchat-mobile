/**
 * Participant List Component
 *
 * Displays room participants with:
 * - Role badges (Creator, Moderator)
 * - Kick/Ban actions for creators
 * - Online status
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import {
  X,
  Users,
  Crown,
  Shield,
  UserX,
  Ban,
} from 'lucide-react-native';
import { roomService, ParticipantDTO } from '../../services';
import { AvatarDisplay } from '../profile';

interface ParticipantListProps {
  roomId: string;
  isCreator: boolean;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ParticipantList({
  roomId,
  isCreator,
  currentUserId,
  isOpen,
  onClose,
}: ParticipantListProps) {
  const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [showBanDialog, setShowBanDialog] = useState<{
    userId: string;
    displayName: string;
  } | null>(null);
  const [banReason, setBanReason] = useState('');

  // Fetch participants
  useEffect(() => {
    if (isOpen) {
      fetchParticipants();
    }
  }, [isOpen, roomId]);

  const fetchParticipants = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await roomService.getParticipants(roomId);
      setParticipants(data);
    } catch (err) {
      console.error('Failed to fetch participants:', err);
      setError('Failed to load participants');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKick = (userId: string, displayName: string) => {
    Alert.alert(
      'Remove User',
      `Are you sure you want to remove ${displayName} from this room?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionInProgress(userId);
            try {
              await roomService.kickUser(roomId, userId);
              setParticipants(prev => prev.filter(p => p.userId !== userId));
            } catch (err) {
              Alert.alert('Error', 'Failed to remove user');
            } finally {
              setActionInProgress(null);
            }
          },
        },
      ]
    );
  };

  const handleBanClick = (userId: string, displayName: string) => {
    setShowBanDialog({ userId, displayName });
    setBanReason('');
  };

  const handleBanConfirm = async () => {
    if (!showBanDialog) return;

    setActionInProgress(showBanDialog.userId);
    try {
      await roomService.banUser(roomId, showBanDialog.userId, banReason || undefined);
      setParticipants(prev => prev.filter(p => p.userId !== showBanDialog.userId));
      setShowBanDialog(null);
    } catch (err) {
      Alert.alert('Error', 'Failed to ban user');
    } finally {
      setActionInProgress(null);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'creator':
        return <Crown size={14} color="#f59e0b" />;
      case 'moderator':
        return <Shield size={14} color="#3b82f6" />;
      default:
        return null;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'creator':
        return (
          <View style={[styles.roleBadge, styles.creatorBadge]}>
            <Crown size={10} color="#f59e0b" />
            <Text style={styles.creatorBadgeText}>Creator</Text>
          </View>
        );
      case 'moderator':
        return (
          <View style={[styles.roleBadge, styles.modBadge]}>
            <Shield size={10} color="#3b82f6" />
            <Text style={styles.modBadgeText}>Mod</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const renderParticipant = ({ item }: { item: ParticipantDTO }) => {
    const isCurrentUser = item.userId === currentUserId;
    const canModerate = isCreator && !isCurrentUser && item.role !== 'creator';
    const isProcessing = actionInProgress === item.userId;

    return (
      <View style={styles.participantItem}>
        <View style={styles.avatar}>
          <AvatarDisplay
            avatarUrl={item.profilePhotoUrl}
            displayName={item.displayName}
            size="md"
            style={{ width: 44, height: 44, borderRadius: 22 }}
          />
        </View>

        <View style={styles.participantInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.participantName}>
              {item.displayName}
              {isCurrentUser && <Text style={styles.youLabel}> (You)</Text>}
            </Text>
            {getRoleBadge(item.role)}
          </View>
        </View>

        {canModerate && (
          <View style={styles.actions}>
            {isProcessing ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.actionButtonWithLabel}
                  onPress={() => handleKick(item.userId, item.displayName)}
                >
                  <UserX size={16} color="#f97316" />
                  <Text style={styles.actionButtonText}>Kick</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButtonWithLabel}
                  onPress={() => handleBanClick(item.userId, item.displayName)}
                >
                  <Ban size={16} color="#ef4444" />
                  <Text style={styles.actionButtonText}>Ban</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Users size={20} color="#f97316" />
              </View>
              <Text style={styles.title}>
                Participants ({participants.length})
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f97316" />
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchParticipants}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={participants}
                renderItem={renderParticipant}
                keyExtractor={(item) => item.userId}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Ban Dialog */}
      <Modal
        visible={!!showBanDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBanDialog(null)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Ban User</Text>
            <Text style={styles.dialogMessage}>
              {showBanDialog?.displayName} will not be able to rejoin this room.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Reason (optional)"
              placeholderTextColor="#9ca3af"
              value={banReason}
              onChangeText={setBanReason}
              multiline
            />

            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={styles.dialogButtonCancel}
                onPress={() => setShowBanDialog(null)}
              >
                <Text style={styles.dialogButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogButtonConfirm}
                onPress={handleBanConfirm}
              >
                <Text style={styles.dialogButtonConfirmText}>Ban User</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 34,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  list: {
    padding: 16,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  participantInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  youLabel: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '400',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  creatorBadge: {
    backgroundColor: '#fef3c7',
  },
  creatorBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#f59e0b',
  },
  modBadge: {
    backgroundColor: '#dbeafe',
  },
  modBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#3b82f6',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  // Ban Dialog
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  dialogMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  reasonInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  dialogButtonCancel: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  dialogButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  dialogButtonConfirm: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  dialogButtonConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default ParticipantList;

