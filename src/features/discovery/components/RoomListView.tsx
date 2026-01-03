/**
 * RoomListView Component
 *
 * List view displaying nearby rooms with search, category filters, and sorting.
 * Uses decomposed components for search, filters, and room items.
 */

import React, { useState, useMemo, useCallback, memo, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Modal,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Search,
    SlidersHorizontal,
    MapPin,
    ArrowUp,
} from 'lucide-react-native';
import { Room } from '../../../types';
import { useMyRooms, useRoomDiscovery, useRoomStore, selectSelectedCategory } from '../../rooms';
import { CATEGORIES } from '../../../constants';
import { calculateDistance } from '../../../utils/format';
import { theme } from '../../../core/theme';
import { roomService } from '../../../services/room';

// Decomposed components
import { ListViewSearch } from '../list/ListViewSearch';
import { ListViewFilters, type ListViewSortOption } from '../list/ListViewFilters';
import { ListViewItem } from '../list/ListViewItem';

// Styles
import { styles } from './RoomListView.styles';


interface RoomListViewProps {
    rooms: Room[];
    isLoading?: boolean;
    isLoadingMore?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    onJoinRoom?: (room: Room) => Promise<boolean>;
    onEnterRoom?: (room: Room) => void;
    onCreateRoom?: () => void;
    userLocation?: { latitude: number; longitude: number; lat?: number; lng?: number } | null;
}

/**
 * Room List Item Wrapper - connects to RoomContext
 * Uses the decomposed ListViewItem component
 */
function RoomListItemWrapper({
    room,
    onJoin,
    onEnterRoom,
    userLocation,
}: {
    room: Room;
    onJoin?: (room: Room) => void;
    onEnterRoom?: (room: Room) => void;
    userLocation?: { latitude: number; longitude: number; lat?: number; lng?: number } | null;
}) {
    const { isJoined } = useMyRooms();
    const hasJoined = isJoined(room.id);

    // Convert userLocation to format expected by ListViewItem
    const normalizedLocation = userLocation ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
    } : null;

    return (
        <ListViewItem
            room={room}
            hasJoined={hasJoined}
            onJoin={onJoin}
            onEnter={onEnterRoom}
            userLocation={normalizedLocation}
        />
    );
}

// RoomListItem is now provided by ListViewItem component

/**
 * Empty State Component
 * Memoized to prevent re-renders
 */
const EmptyState = memo(function EmptyState({
    hasSearch,
    onClearSearch,
    onCreateRoom,
}: {
    hasSearch: boolean;
    onClearSearch: () => void;
    onCreateRoom?: () => void;
}) {
    return (
        <View style={styles.emptyState}>
            {hasSearch ? (
                <>
                    <View style={styles.emptyIconSearch}>
                        <Search size={32} color={theme.tokens.text.tertiary} />
                    </View>
                    <Text style={styles.emptyTitle}>No rooms found</Text>
                    <Text style={styles.emptySubtitle}>
                        Try a different search term
                    </Text>
                    <TouchableOpacity style={styles.emptyButtonSecondary} onPress={onClearSearch}>
                        <Text style={styles.emptyButtonSecondaryText}>Clear Search</Text>
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    <View style={styles.emptyIcon}>
                        <MapPin size={40} color={theme.tokens.brand.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>No rooms nearby</Text>
                    <Text style={styles.emptySubtitle}>
                        Be the first to start a conversation!
                    </Text>
                </>
            )}
            {onCreateRoom && (
                <TouchableOpacity style={styles.emptyButton} onPress={onCreateRoom}>
                    <Text style={styles.emptyButtonText}>Create Room</Text>
                </TouchableOpacity>
            )}
        </View>
    );
});

/**
 * Main RoomListView Component
 * NOT memoized to ensure context updates trigger re-renders
 */
export function RoomListView({
    rooms,
    isLoading = false,
    isLoadingMore: isLoadingMoreProp,
    hasMore: hasMoreProp,
    onLoadMore,
    onJoinRoom,
    onEnterRoom,
    onCreateRoom,
    userLocation: userLocationProp,
}: RoomListViewProps) {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<Room[]>([]);

    // Global filter state
    const selectedCategory = useRoomStore(selectSelectedCategory);
    const setSelectedCategory = useRoomStore((state) => state.setSelectedCategory);

    const [sortBy, setSortBy] = useState<ListViewSortOption>('nearest');
    const [showFilters, setShowFilters] = useState(false);

    // Join Confirmation State
    const [joinPendingRoom, setJoinPendingRoom] = useState<Room | null>(null);
    const [isJoining, setIsJoining] = useState(false);

    // Scroll to Top Logic
    const flatListRef = React.useRef<FlatList>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const scrollButtonTranslateY = React.useRef(new Animated.Value(-100)).current;
    const scrollButtonOpacity = React.useRef(new Animated.Value(0)).current; // Start invisible

    const handleScroll = useCallback((event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        if (offsetY > 300 && !showScrollTop) {
            setShowScrollTop(true);
            Animated.parallel([
                Animated.spring(scrollButtonTranslateY, {
                    toValue: 4, // Slide down just below categories (tighter gap)
                    useNativeDriver: true,
                    damping: 20,
                    stiffness: 200,
                }),
                Animated.timing(scrollButtonOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();
        } else if (offsetY <= 300 && showScrollTop) {
            setShowScrollTop(false);
            Animated.parallel([
                Animated.timing(scrollButtonTranslateY, {
                    toValue: -100,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(scrollButtonOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [showScrollTop, scrollButtonTranslateY, scrollButtonOpacity]);

    const scrollToTop = () => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    };

    // Reset scroll button when category changes
    useEffect(() => {
        if (showScrollTop) {
            setShowScrollTop(false);
            // Immediately hide without animation to avoid glitching during list update
            scrollButtonTranslateY.setValue(-100);
            scrollButtonOpacity.setValue(0);
        }
    }, [selectedCategory]);

    // Subscribe to myRooms to force re-render when join/leave state changes
    const { rooms: myRooms } = useMyRooms();

    // Use pagination from props or fallback to internal hook
    const { isLoadingMore: isLoadingMoreInternal, hasMore: hasMoreInternal, loadMore: loadMoreInternal } = useRoomDiscovery({
        latitude: userLocationProp?.latitude || 0,
        longitude: userLocationProp?.longitude || 0,
        autoFetch: false,
    });

    // Use prop values if provided, otherwise use internal
    const isLoadingMore = isLoadingMoreProp ?? isLoadingMoreInternal;
    const hasMoreRooms = hasMoreProp ?? hasMoreInternal;
    const loadMoreRooms = onLoadMore ?? loadMoreInternal;

    // Use passed user location or null
    const userLocation = userLocationProp;

    // Helper to get room distance (calculate if not provided)
    const getRoomDistance = useCallback((room: Room): number => {
        // Only use pre-calculated distance if it's a valid positive value
        if (room.distance !== undefined && room.distance > 0) {
            return room.distance;
        }
        // Calculate distance from user location if room has coordinates
        if (room.latitude !== undefined && room.longitude !== undefined && userLocation) {
            return calculateDistance(
                userLocation.lat || userLocation.latitude,
                userLocation.lng || userLocation.longitude,
                room.latitude,
                room.longitude
            );
        }
        // Fallback to 0 if no coordinates
        return 0;
    }, [userLocation]);

    // Backend search effect - debounced
    React.useEffect(() => {
        if (!searchQuery || searchQuery.trim().length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        const timer = setTimeout(async () => {
            try {
                const results = await roomService.searchRooms(
                    searchQuery,
                    userLocation?.latitude || userLocation?.lat,
                    userLocation?.longitude || userLocation?.lng,
                    undefined, // No radius filter for global search
                    100 // Get up to 100 results
                );
                setSearchResults(results);
            } catch (error) {
                console.error('Search error:', error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [searchQuery, userLocation]);

    // Filter and sort rooms
    const filteredRooms = useMemo(() => {
        // Use search results if searching, otherwise use provided rooms
        let filtered = searchQuery && searchQuery.trim().length >= 2
            ? [...searchResults]
            : [...rooms];

        // Category filter (apply to both search results and regular rooms)
        if (selectedCategory !== 'All') {
            const query = selectedCategory.toLowerCase().trim();
            filtered = filtered.filter((room) => {
                const roomCat = room.category?.toLowerCase() || '';
                // Check if it matches label OR ID of the selected category
                const categoryConfig = CATEGORIES.find(cat =>
                    cat.label.toLowerCase() === query ||
                    cat.id.toLowerCase() === query
                );

                if (!categoryConfig) return false;

                return roomCat === categoryConfig.id.toLowerCase() ||
                    roomCat === categoryConfig.label.toLowerCase();
            });
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'nearest':
                    return getRoomDistance(a) - getRoomDistance(b);
                case 'most-active':
                    return b.participantCount - a.participantCount;
                case 'expiring-soon':
                    return a.expiresAt.getTime() - b.expiresAt.getTime();
                case 'newest':
                    return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
                default:
                    return 0;
            }
        });

        return filtered;
    }, [rooms, searchResults, searchQuery, selectedCategory, sortBy, getRoomDistance]);

    // Group rooms by distance
    const groupedRooms = useMemo(() => {
        const groups: { title: string; rooms: Room[] }[] = [
            { title: 'Nearby (< 500m)', rooms: [] },
            { title: 'Close (< 1km)', rooms: [] },
            { title: 'Medium (< 5km)', rooms: [] },
            { title: 'Far (> 5km)', rooms: [] },
        ];

        filteredRooms.forEach((room) => {
            const distance = getRoomDistance(room);
            if (distance < 500) {
                groups[0].rooms.push(room);
            } else if (distance < 1000) {
                groups[1].rooms.push(room);
            } else if (distance < 5000) {
                groups[2].rooms.push(room);
            } else {
                groups[3].rooms.push(room);
            }
        });

        return groups.filter((group) => group.rooms.length > 0);
    }, [filteredRooms, getRoomDistance]);

    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
    }, []);

    const handleRoomPress = useCallback((room: Room) => {
        setJoinPendingRoom(room);
    }, []);

    const handleConfirmJoin = async () => {
        if (!joinPendingRoom || !onJoinRoom) return;

        setIsJoining(true);
        try {
            const success = await onJoinRoom(joinPendingRoom);
            if (success) {
                const room = joinPendingRoom;
                setJoinPendingRoom(null);
                // Auto-enter after short delay
                setTimeout(() => {
                    onEnterRoom?.(room);
                }, 300);
            }
        } catch (error) {
            console.error('Failed to join:', error);
        } finally {
            setIsJoining(false);
        }
    };

    // NEW: Handle infinite scroll - load more rooms when user reaches bottom
    const handleLoadMore = useCallback(() => {
        if (!isLoadingMore && hasMoreRooms && !searchQuery) {
            // Only load more if not searching (search results are locally filtered)
            loadMoreRooms();
        }
    }, [isLoadingMore, hasMoreRooms, searchQuery, loadMoreRooms]);

    // Memoize flattened list data for FlatList
    const flattenedData = useMemo(() => {
        const flattened: ({ type: 'header'; title: string } | { type: 'room'; room: Room })[] = [];
        groupedRooms.forEach(group => {
            flattened.push({ type: 'header', title: group.title });
            group.rooms.forEach(room => {
                flattened.push({ type: 'room', room });
            });
        });
        return flattened;
    }, [groupedRooms]);

    // Remove early return for isLoading to keep header/filters mounted
    // if (isLoading) { ... }

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Explore Rooms</Text>
                    <TouchableOpacity
                        style={[styles.filterButton, showFilters && styles.filterButtonActive]}
                        onPress={() => setShowFilters(!showFilters)}
                    >
                        <SlidersHorizontal size={20} color={showFilters ? theme.tokens.brand.primary : theme.tokens.text.tertiary} />
                    </TouchableOpacity>
                </View>

                {/* Search - Using decomposed component */}
                <ListViewSearch
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onClear={handleClearSearch}
                    isSearching={isSearching}
                />
            </View>

            {/* Filters - Using decomposed component */}
            <ListViewFilters
                selectedCategory={selectedCategory}
                onCategorySelect={setSelectedCategory}
                sortBy={sortBy}
                onSortSelect={setSortBy}
                showFilters={showFilters}
            />

            {/* Room List Content */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.tokens.brand.primary} />
                    <Text style={styles.loadingText}>Loading rooms...</Text>
                </View>
            ) : filteredRooms.length === 0 ? (
                <EmptyState
                    hasSearch={searchQuery.length > 0}
                    onClearSearch={handleClearSearch}
                    onCreateRoom={onCreateRoom}
                />
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={flattenedData}
                    keyExtractor={(item, index) => item.type === 'header' ? `header-${item.title}` : `room-${item.room.id}`}
                    extraData={myRooms}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    renderItem={({ item }) => {
                        if (item.type === 'header') {
                            return <Text style={styles.groupTitle}>{item.title}</Text>;
                        }
                        return (
                            <RoomListItemWrapper
                                room={item.room}
                                onJoin={handleRoomPress}
                                onEnterRoom={onEnterRoom}
                                userLocation={userLocation}
                            />
                        );
                    }}
                    ListFooterComponent={() => (
                        <>
                            {/* Loading more indicator */}
                            {isLoadingMore && (
                                <View style={styles.loadingMoreContainer}>
                                    <ActivityIndicator size="small" color={theme.tokens.brand.primary} />
                                    <Text style={styles.loadingMoreText}>Loading more rooms...</Text>
                                </View>
                            )}

                            {/* End of list message */}
                            {!isLoadingMore && !hasMoreRooms && !searchQuery && filteredRooms.length > 0 && (
                                <View style={styles.endOfListContainer}>
                                    <Text style={styles.endOfListText}>
                                        ✓ All nearby rooms loaded
                                    </Text>
                                </View>
                            )}

                            {/* Room count */}
                            <Text style={styles.footer}>
                                {filteredRooms.length} {filteredRooms.length === 1 ? 'room' : 'rooms'} found
                            </Text>
                        </>
                    )}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    contentContainerStyle={styles.roomListContent}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    updateCellsBatchingPeriod={50}
                    windowSize={21}
                    initialNumToRender={10}
                />
            )}

            {/* Scroll to Top Button */}
            <Animated.View
                style={[
                    styles.scrollTopButtonContainer,
                    {
                        transform: [{ translateY: scrollButtonTranslateY }],
                        opacity: scrollButtonOpacity
                    }
                ]}
                pointerEvents={showScrollTop ? 'auto' : 'none'}
            >
                <TouchableOpacity
                    style={styles.scrollTopButton}
                    onPress={scrollToTop}
                    activeOpacity={0.8}
                >
                    <ArrowUp size={20} color={theme.tokens.text.secondary} strokeWidth={2.5} />
                </TouchableOpacity>
            </Animated.View>
            {/* Join Confirmation Modal */}
            <Modal
                visible={joinPendingRoom !== null}
                transparent={true}
                animationType="fade"
                onRequestClose={() => !isJoining && setJoinPendingRoom(null)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => !isJoining && setJoinPendingRoom(null)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalEmojiContainer}>
                                <Text style={styles.modalEmoji}>{joinPendingRoom?.emoji}</Text>
                            </View>
                            <Text style={styles.modalTitle}>{joinPendingRoom?.title}</Text>
                            <Text style={styles.modalSubtitle}>
                                Would you like to join this conversation?
                            </Text>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setJoinPendingRoom(null)}
                                disabled={isJoining}
                            >
                                <Text style={styles.cancelButtonText}>Not now</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={handleConfirmJoin}
                                disabled={isJoining}
                            >
                                {isJoining ? (
                                    <ActivityIndicator size="small" color={theme.tokens.text.onPrimary} />
                                ) : (
                                    <Text style={styles.confirmButtonText}>Join Room</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}


export default RoomListView;
