/**
 * BlockedUsersPage Component
 * 
 * Full-page management of blocked users with unblock functionality
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { ArrowLeft, UserX, UserCheck } from 'lucide-react-native';
import { BlockedUser } from './shared/types';

interface BlockedUsersPageProps {
    blockedUsers: BlockedUser[];
    isLoading: boolean;
    unblockingId: string | null;
    onUnblock: (user: BlockedUser) => void;
    onBack: () => void;
}

export function BlockedUsersPage({
    blockedUsers,
    isLoading,
    unblockingId,
    onUnblock,
    onBack,
}: BlockedUsersPageProps) {
    return (
        <View>
            {/* Header */}
            <View style={styles.subPageHeader}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={onBack}
                >
                    <ArrowLeft size={20} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.subPageTitle}>Blocked Users</Text>
            </View>

            {/* Content */}
            <View style={styles.subPageContent}>
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#f97316" />
                    </View>
                ) : blockedUsers.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIcon}>
                            <UserX size={48} color="#9ca3af" />
                        </View>
                        <Text style={styles.emptyTitle}>No Blocked Users</Text>
                        <Text style={styles.emptyText}>
                            Users you block will appear here.
                        </Text>
                    </View>
                ) : (
                    <View>
                        {blockedUsers.map((item) => (
                            <View key={item.blockedId} style={styles.userItem}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {(item.displayName || 'U').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName}>{item.displayName || 'Unknown User'}</Text>
                                    <Text style={styles.blockedDate}>
                                        Blocked on {new Date(item.createdAt).toLocaleDateString()}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.unblockButton}
                                    onPress={() => onUnblock(item)}
                                    disabled={unblockingId === item.blockedId}
                                >
                                    {unblockingId === item.blockedId ? (
                                        <ActivityIndicator size="small" color="#22c55e" />
                                    ) : (
                                        <UserCheck size={20} color="#22c55e" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    subPageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        marginBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    subPageTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
    },
    subPageContent: {
        flex: 1,
    },
    loadingContainer: {
        paddingVertical: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fef2f2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ef4444',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
    },
    blockedDate: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 2,
    },
    unblockButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f0fdf4',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
