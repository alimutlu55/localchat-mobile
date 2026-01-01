import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Crown, Shield, Ban, UserX } from 'lucide-react-native';
import { ParticipantDTO } from '../../services';
import { AvatarDisplay } from '../profile';
import { useRealtimeProfile } from '../../features/user/hooks/useRealtimeProfile';
import { theme } from '../../core/theme';

interface ParticipantItemProps {
    participant: ParticipantDTO;
    isCreator: boolean;
    isCurrentUser: boolean;
    canModerate?: boolean;
    isProcessing?: boolean;
    onKick?: (userId: string, displayName: string) => void;
    onBan?: (userId: string, displayName: string) => void;
    onPress?: (participant: ParticipantDTO) => void;
}

/**
 * Standardized Participant Item component with real-time profile synchronization.
 */
export function ParticipantItem({
    participant: initialParticipant,
    isCreator,
    isCurrentUser,
    canModerate,
    isProcessing,
    onKick,
    onBan,
    onPress,
}: ParticipantItemProps) {
    const participant = useRealtimeProfile(initialParticipant);

    const getRoleBadge = () => {
        if (participant.role === 'creator') {
            return (
                <View style={[styles.roleBadge, styles.creatorBadge]}>
                    <Crown size={10} color={theme.tokens.status.warning.main} />
                    <Text style={styles.creatorBadgeText}>Creator</Text>
                </View>
            );
        }
        if (participant.role === 'moderator') {
            return (
                <View style={[styles.roleBadge, styles.modBadge]}>
                    <Shield size={10} color={theme.tokens.status.info.main} />
                    <Text style={styles.modBadgeText}>Mod</Text>
                </View>
            );
        }
        return null;
    };

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => onPress?.(participant)}
            disabled={!onPress}
            activeOpacity={0.7}
        >
            <View style={styles.avatar}>
                <AvatarDisplay
                    avatarUrl={participant.profilePhotoUrl}
                    displayName={participant.displayName}
                    size="md"
                    style={{ width: 44, height: 44, borderRadius: 22 }}
                />
            </View>

            <View style={styles.info}>
                <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                        {participant.displayName}
                        {isCurrentUser && <Text style={styles.youLabel}> (You)</Text>}
                    </Text>
                    {getRoleBadge()}
                </View>
            </View>

            {canModerate && (
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => onKick?.(participant.userId, participant.displayName)}
                        disabled={isProcessing}
                    >
                        <UserX size={16} color="#FF6410" />
                        <Text style={styles.actionText}>Kick</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => onBan?.(participant.userId, participant.displayName)}
                        disabled={isProcessing}
                    >
                        <Ban size={16} color="#ef4444" />
                        <Text style={styles.actionText}>Ban</Text>
                    </TouchableOpacity>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.tokens.border.subtle,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
        backgroundColor: theme.tokens.bg.subtle,
    },
    info: {
        flex: 1,
        justifyContent: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    name: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1f2937',
        maxWidth: '60%',
    },
    youLabel: {
        fontSize: 13,
        color: theme.tokens.text.tertiary,
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
        backgroundColor: theme.tokens.status.warning.bg,
    },
    creatorBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: theme.tokens.status.warning.main,
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
        marginLeft: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        gap: 4,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
});
