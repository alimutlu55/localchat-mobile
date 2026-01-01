/**
 * ProfileHeader Component
 * 
 * Displays user profile information including avatar, name, email, bio, and stats
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Hash, MessageSquare, Calendar } from 'lucide-react-native';
import { User } from '../../types';
import { AvatarDisplay } from '../profile';
import { StatItem } from './shared';
import { UserStats } from './shared/types';

interface ProfileHeaderProps {
    user: User | null;
    stats: UserStats;
    onEditProfile: () => void;
}

export function ProfileHeader({ user, stats, onEditProfile }: ProfileHeaderProps) {
    return (
        <View style={styles.profileHeader}>
            <TouchableOpacity
                onPress={onEditProfile}
                activeOpacity={0.7}
            >
                <AvatarDisplay
                    avatarUrl={user?.profilePhotoUrl}
                    displayName={user?.displayName || 'User'}
                    size="lg"
                    style={{ width: 64, height: 64, borderRadius: 32 }}
                />
            </TouchableOpacity>
            <Text style={styles.profileName}>{user?.displayName || 'Guest'}</Text>
            <Text style={styles.profileEmail}>
                {user?.email || 'Anonymous User'}
            </Text>
            <TouchableOpacity
                style={styles.editProfileButton}
                onPress={onEditProfile}
            >
                <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <StatItem label="Rooms" value={stats.roomsJoined} icon={Hash} />
                <View style={styles.statDivider} />
                <StatItem label="Messages" value={stats.messagesSent} icon={MessageSquare} />
                <View style={styles.statDivider} />
                <StatItem label="Joined" value={stats.memberSince} icon={Calendar} />
            </View>

            {/* Bio (if available) */}
            {user?.bio && (
                <Text style={styles.bioText} numberOfLines={2}>
                    {user.bio}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        marginBottom: 16,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 13,
        color: '#9ca3af',
        marginBottom: 8,
    },
    bioText: {
        fontSize: 13,
        color: '#4b5563',
        textAlign: 'center',
        marginHorizontal: 32,
        marginBottom: 16,
        lineHeight: 18,
    },
    editProfileButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginBottom: 20,
    },
    editProfileText: {
        fontSize: 14,
        color: '#FF6410',
        fontWeight: '500',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        marginBottom: 16,
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#e5e7eb',
    },
});
