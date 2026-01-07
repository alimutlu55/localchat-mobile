/**
 * RoomListView Component
 *
 * List view displaying nearby rooms with search, category filters, and sorting.
 * Uses decomposed components for search, filters, and room items.
 */

import React, { useState, useMemo, useCallback, memo, useEffect, useRef } from 'react';
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
import { useMyRooms, useRoomStore, selectSelectedCategory } from '../../rooms';
import { CATEGORIES } from '../../../constants';
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
 * NOTE: isJoined is now passed from parent to avoid hook-per-item performance issue
 */
function RoomListItemWrapper({
    room,
    onJoin,
    onEnterRoom,
    userLocation,
    isJoined,
}: {
    room: Room;
    onJoin?: (room: Room) => void;
    onEnterRoom?: (room: Room) => void;
    userLocation?: { latitude: number; longitude: number; lat?: number; lng?: number } | null;
    isJoined: boolean;
}) {
    // Convert userLocation to format expected by ListViewItem
    const normalizedLocation = userLocation ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
    } : null;

    return (
        <ListViewItem
            room={room}
            hasJoined={isJoined}
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
 * Memoized to prevent unnecessary re-renders during map movement
 */
export const RoomListView = memo(function RoomListView({
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
    const lastFirstRoomIdRef = useRef<string | null>(null);

    // Deferred rendering - prevents initial lag by showing loading state first
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        // Defer heavy computation until after first paint
        const timer = requestAnimationFrame(() => {
            setIsReady(true);
        });
        return () => cancelAnimationFrame(timer);
    }, []);

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

    // Auto-scroll to top when rooms update from a fresh fetch (detected via first room ID change)
    useEffect(() => {
        if (rooms.length > 0) {
            const firstRoomId = rooms[0].id;

            // If the first room ID changed, it's a new list (not pagination)
            if (firstRoomId !== lastFirstRoomIdRef.current) {
                // Scroll to top with a tiny delay to allow content to layout
                const timer = setTimeout(() => {
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                }, 100);

                lastFirstRoomIdRef.current = firstRoomId;
                return () => clearTimeout(timer);
            }
        } else {
            lastFirstRoomIdRef.current = null;
        }
    }, [rooms]);

    // Subscribe to myRooms to force re-render when join/leave state changes
    // isJoined is extracted once here and passed to items (not called per-item)
    const { rooms: myRooms, isJoined } = useMyRooms();

    // Use prop values provided by DiscoveryScreen
    const isLoadingMore = isLoadingMoreProp || false;
    const hasMoreRooms = hasMoreProp || false;
    const loadMoreRooms = onLoadMore || (() => { });

    // Use passed user location or null
    const userLocation = userLocationProp;

    // Get room distance - use backend-calculated value directly
    // Backend calculates distance relative to user location when fetching
    const getRoomDistance = useCallback((room: Room): number | null => {
        // Return backend-calculated distance if available
        if (room.distance !== undefined && room.distance > 0) {
            return room.distance;
        }
        return null;
    }, []);

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
            // selectedCategory is a LABEL (e.g., "Traffic & Transit")
            // room.category is an ID from backend (e.g., "TRAFFIC_TRANSIT")
            const categoryConfig = CATEGORIES.find(cat =>
                cat.label === selectedCategory
            );

            if (categoryConfig) {
                const targetId = categoryConfig.id.toUpperCase();
                filtered = filtered.filter((room) => {
                    const roomCat = room.category?.toUpperCase() || '';
                    return roomCat === targetId;
                });
            } else {
                // Fallback: if no config found, try direct match
                filtered = filtered.filter((room) => {
                    const roomCat = room.category?.toUpperCase() || '';
                    return roomCat === selectedCategory.toUpperCase();
                });
            }
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'nearest': {
                    const distA = getRoomDistance(a) ?? 999999;
                    const distB = getRoomDistance(b) ?? 999999;
                    return distA - distB;
                }
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
    // Optimized in Phase 8 to avoid nested loops on every re-render
    const flattenedData = useMemo(() => {
        if (filteredRooms.length === 0) return [];

        const flattened: ({ type: 'header'; title: string } | { type: 'room'; room: Room })[] = [];

        // Directly flatten based on distance groups to avoid multiple passes
        const nearby: Room[] = [];
        const close: Room[] = [];
        const medium: Room[] = [];
        const far: Room[] = [];

        filteredRooms.forEach(room => {
            const dist = getRoomDistance(room);
            if (dist === null || dist >= 5000) far.push(room);
            else if (dist < 500) nearby.push(room);
            else if (dist < 1000) close.push(room);
            else medium.push(room);
        });

        if (nearby.length > 0) {
            flattened.push({ type: 'header', title: 'Nearby (< 500m)' });
            nearby.forEach(r => flattened.push({ type: 'room', room: r }));
        }
        if (close.length > 0) {
            flattened.push({ type: 'header', title: 'Close (< 1km)' });
            close.forEach(r => flattened.push({ type: 'room', room: r }));
        }
        if (medium.length > 0) {
            flattened.push({ type: 'header', title: 'Medium (< 5km)' });
            medium.forEach(r => flattened.push({ type: 'room', room: r }));
        }
        if (far.length > 0) {
            flattened.push({ type: 'header', title: userLocation ? 'Far (> 5km)' : 'Rooms in view' });
            far.forEach(r => flattened.push({ type: 'room', room: r }));
        }

        return flattened;
    }, [filteredRooms, getRoomDistance, userLocation]);

    // Remove early return for isLoading to keep header/filters mounted
    // if (isLoading) { ... }

    return (
        <View style={styles.container}>
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
            {!isReady || (isLoading && filteredRooms.length === 0) ? (
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
                                isJoined={isJoined(item.room.id)}
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
});

export default RoomListView;
