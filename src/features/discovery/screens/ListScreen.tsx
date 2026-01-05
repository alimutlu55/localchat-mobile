/**
 * ListScreen Component
 *
 * Dedicated list view screen for room discovery.
 * Thin wrapper that composes the ListContainer with RoomListView.
 *
 * This is an ADDITIVE component - the existing DiscoveryScreen continues to work.
 * Use this for new navigation flows or as a replacement when ready.
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Map as MapIcon } from 'lucide-react-native';

import { Room } from '../../../types';
import { RootStackParamList } from '../../../navigation/types';
import { theme } from '../../../core/theme';
import { useUIActions } from '../../../context';
import { useUserStore } from '../../user';
import { RoomListView, MapHeader } from '../components';
import { ListContainer, ListRenderProps } from '../containers';
import { ConnectionBanner } from '../../../components/chat/ConnectionBanner';

// =============================================================================
// Types
// =============================================================================

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export interface ListScreenProps {
    /** Callback when view should switch to map */
    onSwitchToMap?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function ListScreen({ onSwitchToMap }: ListScreenProps) {
    const navigation = useNavigation<NavigationProp>();
    const insets = useSafeAreaInsets();
    const { openSidebar } = useUIActions();

    // User info for header
    const currentUser = useUserStore((state) => state.currentUser);

    // ==========================================================================
    // Handlers
    // ==========================================================================

    const handleEnterRoom = useCallback((room: Room) => {
        // Navigate to RoomDetails first where user can join/enter
        navigation.navigate('RoomDetails', {
            roomId: room.id,
            initialRoom: serializeRoom(room),
        });
    }, [navigation]);

    const handleCreateRoom = useCallback(() => {
        navigation.navigate('CreateRoom', {});
    }, [navigation]);

    const handleProfilePress = useCallback(() => {
        navigation.navigate('Profile');
    }, [navigation]);

    // ==========================================================================
    // Render Props
    // ==========================================================================

    const renderList = useCallback((props: ListRenderProps) => (
        <RoomListView
            rooms={props.rooms}
            isLoading={props.isLoading}
            isLoadingMore={props.isLoadingMore}
            hasMore={props.hasMore}
            onLoadMore={props.onLoadMore}
            onJoinRoom={props.onJoinRoom}
            onEnterRoom={props.onEnterRoom}
            onCreateRoom={props.onCreateRoom}
            userLocation={props.userLocation}
        />
    ), []);

    // ==========================================================================
    // Render
    // ==========================================================================

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <MapHeader
                avatarUrl={currentUser?.profilePhotoUrl}
                displayName={currentUser?.displayName || 'User'}
                roomCount={0}
                isRefreshing={false}
                myRoomsCount={0}
                onProfilePress={handleProfilePress}
                onRefreshPress={() => { }}
                onMyRoomsPress={openSidebar}
                topInset={insets.top}
            />

            {/* View Toggle */}
            {onSwitchToMap && (
                <View style={styles.toggleContainer}>
                    <TouchableOpacity
                        style={styles.toggleButton}
                        onPress={onSwitchToMap}
                    >
                        <MapIcon size={20} color={theme.tokens.text.secondary} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Connection Banner */}
            <ConnectionBanner />

            {/* List */}
            <ListContainer
                onEnterRoom={handleEnterRoom}
                onCreateRoom={handleCreateRoom}
                renderList={renderList}
            />
        </SafeAreaView>
    );
}

// =============================================================================
// Helpers
// =============================================================================

const serializeRoom = (room: Room): any => ({
    ...room,
    expiresAt: room.expiresAt instanceof Date ? room.expiresAt.toISOString() : room.expiresAt,
    createdAt: room.createdAt instanceof Date ? room.createdAt.toISOString() : room.createdAt,
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.tokens.bg.canvas,
    },
    toggleContainer: {
        position: 'absolute',
        right: 16,
        top: 100,
        zIndex: 10,
    },
    toggleButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: theme.tokens.bg.surface,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
});

export default ListScreen;
