/**
 * ActiveRoomsList Component
 * 
 * Displays user's active rooms in a horizontal scroll view
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Room } from '../../types';

interface ActiveRoomsListProps {
    rooms: Room[];
    onRoomPress: (room: Room) => void;
}

function ActiveRoomItem({ room, onPress }: { room: Room; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.activeRoomItem} onPress={onPress}>
            <View style={styles.activeRoomEmoji}>
                <Text style={{ fontSize: 20 }}>{room.emoji}</Text>
            </View>
            <View style={styles.activeRoomInfo}>
                <Text style={styles.activeRoomTitle} numberOfLines={1}>{room.title}</Text>
                <Text style={styles.activeRoomMeta}>
                    {room.participantCount} members • {room.isCreator ? 'Host' : 'Member'}
                </Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
        </TouchableOpacity>
    );
}

export function ActiveRoomsList({ rooms, onRoomPress }: ActiveRoomsListProps) {
    if (rooms.length === 0) {
        return null;
    }

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>YOUR ACTIVE ROOMS</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.activeRoomsScroll}
                contentContainerStyle={styles.activeRoomsContent}
            >
                {rooms.map(room => (
                    <ActiveRoomItem
                        key={room.id}
                        room={room}
                        onPress={() => onRoomPress(room)}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9ca3af',
        letterSpacing: 0.5,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    activeRoomsScroll: {
        marginBottom: 8,
    },
    activeRoomsContent: {
        paddingRight: 16,
    },
    activeRoomItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 10,
        marginRight: 12,
        width: 200,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    activeRoomEmoji: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    activeRoomInfo: {
        flex: 1,
    },
    activeRoomTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    activeRoomMeta: {
        fontSize: 11,
        color: '#9ca3af',
    },
});
