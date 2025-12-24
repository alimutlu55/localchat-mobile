/**
 * RoomPreviewModal Component
 *
 * A centered card modal showing room details before joining.
 * Matches the design screenshot provided by the user.
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Dimensions,
    Share,
} from 'react-native' Pu
import {
    X,
    Users,
    Clock,
    MapPin,
    MessageCircle,
    Share2,
    Flag,
} from 'lucide-react-native';
import { Room } from '../../types';

const { width } = Dimensions.get('window');

interface RoomPreviewModalProps {
    room: Room | null;
    isOpen: boolean;
    onClose: () => void;
    onEnter: () => void;
    onReport: () => void;
}

export function RoomPreviewModal({
    room,
    isOpen,
    onClose,
    onEnter,
    onReport,
}: RoomPreviewModalProps) {
    if (!room) return null;

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out "${room.title}" on LocalChat! Nearby conversations happening now.`,
                url: 'https://localchat.app',
            });
        } catch (error) {
            console.error('Error sharing room:', error);
        }
    };

    return (
        <Modal
            visible={isOpen}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    style={styles.card}
                    activeOpacity={1}
                    onPress={() => { }} // Prevent closing when tapping the card
                >
                    {/* Close Button */}
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <X size={24} color="#64748b" />
                    </TouchableOpacity>

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={[styles.emojiContainer, { backgroundColor: '#fff5f5' }]}>
                            <Text style={styles.emoji}>{room.emoji || '💬'}</Text>
                        </View>
                        <View style={styles.headerText}>
                            <Text style={styles.title} numberOfLines={1}>{room.title}</Text>
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryText}>{room.category || 'general'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Stats Grid */}
                    <View style={styles.grid}>
                        <View style={styles.gridItem}>
                            <View style={styles.gridLabelRow}>
                                <MapPin size={16} color="#64748b" />
                                <Text style={styles.gridLabel}>Distance</Text>
                            </View>
                            <Text style={styles.gridValue}>{room.distanceDisplay || 'Nearby'}</Text>
                        </View>

                        <View style={styles.gridItem}>
                            <View style={styles.gridLabelRow}>
                                <Users size={16} color="#64748b" />
                                <Text style={styles.gridLabel}>Participants</Text>
                            </View>
                            <Text style={styles.gridValue}>{room.participantCount}/{room.maxParticipants}</Text>
                        </View>

                        <View style={styles.gridItem}>
                            <View style={styles.gridLabelRow}>
                                <Clock size={16} color="#64748b" />
                                <Text style={styles.gridLabel}>Expires in</Text>
                            </View>
                            <Text style={styles.gridValue}>{room.timeRemaining || 'Soon'}</Text>
                        </View>

                        <View style={styles.gridItem}>
                            <View style={styles.gridLabelRow}>
                                <MessageCircle size={16} color="#64748b" />
                                <Text style={styles.gridLabel}>Created</Text>
                            </View>
                            <Text style={styles.gridValue}>Just now</Text>
                        </View>
                    </View>

                    {/* Recent Messages Section */}
                    <View style={styles.messagesSection}>
                        <View style={styles.messagesHeader}>
                            <MessageCircle size={18} color="#64748b" />
                            <Text style={styles.messagesTitle}>Recent Messages</Text>
                        </View>
                        <View style={styles.emptyMessages}>
                            <Text style={styles.emptyMessagesText}>No messages yet. Be the first!</Text>
                            <Text style={styles.joinPrompt}>Join to see more messages</Text>
                        </View>
                    </View>

                    {/* Action Button */}
                    <TouchableOpacity style={styles.enterButton} onPress={onEnter}>
                        <MessageCircle size={20} color="#ffffff" />
                        <Text style={styles.enterButtonText}>Enter Room</Text>
                    </TouchableOpacity>

                    {/* Footer Actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.footerAction} onPress={handleShare}>
                            <Share2 size={20} color="#334155" />
                            <Text style={styles.footerActionText}>Share</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.footerAction} onPress={onReport}>
                            <Flag size={20} color="#334155" />
                            <Text style={styles.footerActionText}>Report</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 28,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    emojiContainer: {
        width: 56,
        height: 56,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    emoji: {
        fontSize: 28,
    },
    headerText: {
        flex: 1,
        gap: 2,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#0f172a',
        paddingRight: 32,
    },
    categoryBadge: {
        backgroundColor: '#f3e8ff',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#9333ea',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    gridItem: {
        width: (width - 48 - 40 - 10) / 2, // Accounting for overlay padding (48), card padding (40), and gap (10)
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 12,
        gap: 6,
    },
    gridLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    gridLabel: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    gridValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
    },
    messagesSection: {
        marginBottom: 24,
    },
    messagesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    messagesTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#475569',
    },
    emptyMessages: {
        alignItems: 'center',
        paddingVertical: 8,
        gap: 4,
    },
    emptyMessagesText: {
        fontSize: 15,
        color: '#64748b',
    },
    joinPrompt: {
        fontSize: 13,
        color: '#94a3b8',
    },
    enterButton: {
        backgroundColor: '#22c55e',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
        marginBottom: 16,
    },
    enterButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 40,
    },
    footerAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    footerActionText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#334155',
    },
});
