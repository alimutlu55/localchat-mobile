/**
 * ListContainer Component
 *
 * Container component that orchestrates list-related hooks and data.
 * Separates business logic from presentation following the container/presenter pattern.
 *
 * Responsibilities:
 * - Coordinate room discovery and filtering hooks
 * - Handle room join/enter operations
 * - Provide data and callbacks to RoomListView
 *
 * Does NOT:
 * - Render specific list item implementations (uses render props)
 * - Handle navigation (receives callbacks)
 * - Manage view mode switching (handled by parent)
 */

import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Room, RoomCategory } from '../../../types';
import { useRoomDiscovery, useRoomOperations, useMyRooms, useRoomStore, selectSelectedCategory } from '../../rooms';
import { useUserLocation } from '../hooks';
import { CATEGORIES } from '../../../constants';
import { createLogger } from '../../../shared/utils/logger';

const log = createLogger('ListContainer');

// =============================================================================
// Types
// =============================================================================

export interface ListContainerProps {
    /** Callback when join room succeeds and should navigate to chat */
    onEnterRoom?: (room: Room) => void;
    /** Callback to navigate to create room screen */
    onCreateRoom?: () => void;
    /** Render prop for the list view */
    renderList?: (props: ListRenderProps) => React.ReactNode;
}

export interface ListRenderProps {
    /** Rooms to display */
    rooms: Room[];
    /** Whether initial load is in progress */
    isLoading: boolean;
    /** Whether more rooms are being loaded */
    isLoadingMore: boolean;
    /** Whether more rooms are available */
    hasMore: boolean;
    /** Load more rooms */
    onLoadMore: () => void;
    /** Handle room join */
    onJoinRoom: (room: Room) => Promise<boolean>;
    /** Handle entering joined room */
    onEnterRoom: (room: Room) => void;
    /** Handle create room */
    onCreateRoom?: () => void;
    /** User location for distance calculation */
    userLocation: { latitude: number; longitude: number } | null;
}

// =============================================================================
// Component
// =============================================================================

export function ListContainer({
    onEnterRoom,
    onCreateRoom,
    renderList,
}: ListContainerProps) {
    // Global filter state
    const selectedCategory = useRoomStore(selectSelectedCategory);
    const categoryConfig = CATEGORIES.find(c => c.label === selectedCategory);
    const categoryFilter = selectedCategory === 'All' ? undefined : (categoryConfig?.id || selectedCategory);

    // ==========================================================================
    // Hooks
    // ==========================================================================

    const {
        location: userLocation,
    } = useUserLocation();

    const {
        rooms,
        isLoading,
        isLoadingMore,
        hasMore,
        loadMore,
        error,
    } = useRoomDiscovery({
        latitude: userLocation?.latitude || 0,
        longitude: userLocation?.longitude || 0,
        autoFetch: !!userLocation,
        category: categoryFilter as RoomCategory | undefined,
    });

    const { join, isJoining } = useRoomOperations();

    // ==========================================================================
    // Handlers
    // ==========================================================================

    const handleJoinRoom = useCallback(async (room: Room): Promise<boolean> => {
        if (!userLocation) {
            log.warn('Cannot join room without location');
            return false;
        }

        try {
            const result = await join(room, { latitude: userLocation.latitude, longitude: userLocation.longitude });
            if (result.success) {
                log.info('Joined room', { roomId: room.id });
                return true;
            } else {
                log.error('Failed to join room', result.error);
                return false;
            }
        } catch (error) {
            log.error('Failed to join room', error);
            return false;
        }
    }, [userLocation, join]);

    const handleEnterRoom = useCallback((room: Room) => {
        onEnterRoom?.(room);
    }, [onEnterRoom]);

    const handleLoadMore = useCallback(() => {
        if (!isLoadingMore && hasMore) {
            loadMore();
        }
    }, [isLoadingMore, hasMore, loadMore]);

    // ==========================================================================
    // Render Props
    // ==========================================================================

    const listProps: ListRenderProps = useMemo(() => ({
        rooms,
        isLoading,
        isLoadingMore,
        hasMore,
        onLoadMore: handleLoadMore,
        onJoinRoom: handleJoinRoom,
        onEnterRoom: handleEnterRoom,
        onCreateRoom,
        userLocation,
    }), [
        rooms,
        isLoading,
        isLoadingMore,
        hasMore,
        handleLoadMore,
        handleJoinRoom,
        handleEnterRoom,
        onCreateRoom,
        userLocation,
    ]);

    // ==========================================================================
    // Render
    // ==========================================================================

    return (
        <View style={styles.container}>
            {renderList?.(listProps)}
        </View>
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default ListContainer;
