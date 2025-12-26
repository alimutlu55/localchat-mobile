/**
 * RoomListView Component
 *
 * List view displaying nearby rooms with search, category filters, and sorting.
 * Matches web RoomListView.tsx design.
 */

import React, { useState, useMemo, useCallback, memo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Modal,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Search,
    X,
    SlidersHorizontal,
    MapPin,
    Users,
    Clock,
    ChevronRight,
    LogIn,
    Check,
    Zap,
    Sparkles,
    Plus,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Room } from '../types';
import { useRooms, useIsRoomJoined } from '../context';
import { CATEGORIES } from '../constants';
import { calculateDistance } from '../utils/format';

// Build category filter options: ['All', 'Food & Dining', 'Events', ...]
const CATEGORY_FILTERS = ['All', ...CATEGORIES.map(cat => cat.label)];

// Helper to get category label from ID
const getCategoryLabel = (categoryId: string): string => {
    const category = CATEGORIES.find(cat => cat.id === categoryId);
    return category?.label || categoryId;
};

type SortOption = 'nearest' | 'most-active' | 'expiring-soon' | 'newest';

interface RoomListViewProps {
    rooms: Room[];
    isLoading?: boolean;
    onJoinRoom?: (room: Room) => Promise<boolean>;
    onEnterRoom?: (room: Room) => void;
    onCreateRoom?: () => void;
    userLocation?: { latitude: number; longitude: number } | null;
}

/**
 * Category Chip Component
 * Memoized to prevent unnecessary re-renders
 */
const CategoryChip = memo(function CategoryChip({
    label,
    isSelected,
    onPress,
}: {
    label: string;
    isSelected: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text
                style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );
});

/**
 * Room List Item Wrapper - connects to RoomContext
 * NOT memoized because it needs to re-render when RoomContext changes
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
    // Use centralized hook to check if room is joined
    const hasJoined = useIsRoomJoined(room.id);

    return (
        <RoomListItem
            room={room}
            hasJoined={hasJoined}
            onJoin={onJoin}
            onEnterRoom={onEnterRoom}
            userLocation={userLocation}
        />
    );
}

/**
 * Room List Item Component
 * Memoized with custom comparison to prevent unnecessary re-renders
 */
const RoomListItem = memo(function RoomListItem({
    room,
    hasJoined,
    onJoin,
    onEnterRoom,
    userLocation,
}: {
    room: Room;
    hasJoined: boolean;
    onJoin?: (room: Room) => void;
    onEnterRoom?: (room: Room) => void;
    userLocation?: { latitude: number; longitude: number; lat?: number; lng?: number } | null;
}) {
    const [isJoining, setIsJoining] = useState(false);

    // Debug logging for participant count changes
    console.log('[RoomListItem] Room:', room.id, 'participantCount:', room.participantCount);

    // No local joinSuccess state - rely entirely on hasJoined from context
    // This prevents stale state when user leaves and returns

    // Calculate room distance
    const roomDistance = useMemo(() => {
        if (room.distance !== undefined) {
            return room.distance;
        }
        // Calculate distance from user location if available
        if (room.latitude && room.longitude && userLocation) {
            const userLat = userLocation.lat || userLocation.latitude;
            const userLng = userLocation.lng || userLocation.longitude;
            if (userLat && userLng) {
                return calculateDistance(userLat, userLng, room.latitude, room.longitude);
            }
        }
        return 0;
    }, [room.distance, room.latitude, room.longitude, userLocation]);

    const getTimeColor = () => {
        const hoursLeft = (room.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursLeft < 0.25) return '#dc2626';
        if (hoursLeft < 1) return '#ea580c';
        return '#16a34a';
    };

    const formatDistance = (meters: number): string => {
        if (meters < 1000) {
            return `${Math.round(meters)}m away`;
        }
        const km = meters / 1000;
        if (km < 10) {
            return `${km.toFixed(1)}km away`;
        }
        return `${Math.round(km)}km away`;
    };

    const getDistanceColor = (meters: number): string => {
        if (meters < 500) return '#16a34a'; // Green - very close
        if (meters < 2000) return '#ea580c'; // Orange - nearby
        return '#6b7280'; // Gray - far
    };

    const getGradientColors = () => {
        // Soft Peach/Apricot Palette - "Just enough color"
        if (room.isExpiringSoon) return ['#fb923c', '#fdba74']; // Warmer orange-peach

        // Smooth Peach - A step up from cream, elegant and visible
        return ['#fff7ed', '#ffedd5']; // Very light peach to soft apricot
    };

    const handlePress = () => {
        if (hasJoined) {
            onEnterRoom?.(room);
        } else {
            onJoin?.(room);
        }
    };

    return (
        <TouchableOpacity
            style={styles.roomCard}
            onPress={handlePress}
            activeOpacity={0.8}
        >
            <View style={styles.roomCardContent}>
                {/* Emoji with Gradient Background */}
                <View style={styles.emojiContainer}>
                    <LinearGradient
                        colors={getGradientColors() as [string, string, ...string[]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.roomEmoji}
                    >
                        <Text style={styles.roomEmojiText}>{room.emoji}</Text>
                    </LinearGradient>

                    {/* Status Badges */}
                    <View style={styles.statusBadgesContainer}>
                        {room.isNew && (
                            <View style={[styles.statusBadge, styles.newBadge]}>
                                <Sparkles size={8} color="#ffffff" />
                                <Text style={styles.statusBadgeText}>New</Text>
                            </View>
                        )}
                        {room.isHighActivity && (
                            <View style={[styles.statusBadge, styles.activeBadge]}>
                                <Zap size={8} color="#ffffff" />
                                <Text style={styles.statusBadgeText}>Active</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Info */}
                <View style={styles.roomInfo}>
                    <View style={styles.titleRow}>
                        <Text style={styles.roomTitle} numberOfLines={1}>
                            {room.title}
                        </Text>
                        <View style={styles.topRightMeta}>
                            {room.isExpiringSoon && (
                                <Clock size={12} color="#ea580c" strokeWidth={3} />
                            )}
                            <Text style={[styles.metaText, { color: getDistanceColor(roomDistance), fontWeight: '600' }]}>
                                {formatDistance(roomDistance)}
                            </Text>
                        </View>
                    </View>

                    {/* Meta Row: People & Time */}
                    <View style={styles.roomMeta}>
                        <View style={styles.metaItem}>
                            <Users size={12} color="#6b7280" />
                            <Text style={styles.metaText}>
                                {room.participantCount}
                            </Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Clock size={12} color={getTimeColor()} />
                            <Text style={[styles.timeText, { color: getTimeColor() }]}>
                                {room.timeRemaining}
                            </Text>
                        </View>
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{getCategoryLabel(room.category)}</Text>
                        </View>
                    </View>

                    {room.description ? (
                        <Text style={styles.roomDescription} numberOfLines={1}>
                            {room.description}
                        </Text>
                    ) : null}
                </View>
            </View>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for optimal re-render control
    return (
        prevProps.room.id === nextProps.room.id &&
        prevProps.room.participantCount === nextProps.room.participantCount &&
        prevProps.room.isExpiringSoon === nextProps.room.isExpiringSoon &&
        prevProps.hasJoined === nextProps.hasJoined
    );
});

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
                        <Search size={32} color="#9ca3af" />
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
                        <MapPin size={40} color="#f97316" />
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
    onJoinRoom,
    onEnterRoom,
    onCreateRoom,
    userLocation: userLocationProp,
}: RoomListViewProps) {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [sortBy, setSortBy] = useState<SortOption>('nearest');
    const [showFilters, setShowFilters] = useState(false);

    // Join Confirmation State
    const [joinPendingRoom, setJoinPendingRoom] = useState<Room | null>(null);
    const [isJoining, setIsJoining] = useState(false);

    // Subscribe to myRooms to force re-render when join/leave state changes
    // NEW: Also subscribe to pagination state
    const { myRooms, isLoadingMore, hasMoreRooms, loadMoreRooms } = useRooms();

    // Use passed user location or default
    const userLocation = userLocationProp || { lat: 41.0082, lng: 28.9784 };

    // Helper to get room distance (calculate if not provided)
    const getRoomDistance = useCallback((room: Room): number => {
        if (room.distance !== undefined) {
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

    // Filter and sort rooms
    const filteredRooms = useMemo(() => {
        let filtered = [...rooms];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (room) =>
                    room.title.toLowerCase().includes(query) ||
                    room.description?.toLowerCase().includes(query) ||
                    room.category.toLowerCase().includes(query)
            );
        }

        // Category filter
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
    }, [rooms, searchQuery, selectedCategory, sortBy, getRoomDistance]);

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
            console.log('[RoomListView] Loading more rooms...');
            loadMoreRooms(userLocation.lat, userLocation.lng);
        }
    }, [isLoadingMore, hasMoreRooms, searchQuery, loadMoreRooms, userLocation]);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f97316" />
                <Text style={styles.loadingText}>Loading rooms...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Nearby Rooms</Text>
                    <TouchableOpacity
                        style={[styles.filterButton, showFilters && styles.filterButtonActive]}
                        onPress={() => setShowFilters(!showFilters)}
                    >
                        <SlidersHorizontal size={20} color={showFilters ? '#f97316' : '#6b7280'} />
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchContainer}>
                    <Search size={18} color="#9ca3af" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search rooms..."
                        placeholderTextColor="#9ca3af"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity style={styles.clearButton} onPress={handleClearSearch}>
                            <X size={16} color="#6b7280" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Sort Options (when filter visible) */}
            {showFilters && (
                <View style={styles.filterPanel}>
                    <View style={styles.filterRow}>
                        <Text style={styles.filterLabel}>Sort by:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {(['nearest', 'most-active', 'expiring-soon', 'newest'] as SortOption[]).map(
                                (option) => (
                                    <TouchableOpacity
                                        key={option}
                                        style={[styles.sortChip, sortBy === option && styles.sortChipSelected]}
                                        onPress={() => setSortBy(option)}
                                    >
                                        <Text
                                            style={[
                                                styles.sortChipText,
                                                sortBy === option && styles.sortChipTextSelected,
                                            ]}
                                        >
                                            {option.replace('-', ' ')}
                                        </Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </ScrollView>
                    </View>
                </View>
            )}

            {/* Category Chips */}
            <View style={styles.categoriesContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoriesContent}
                >
                    {CATEGORY_FILTERS.map((category) => (
                        <CategoryChip
                            key={category}
                            label={category}
                            isSelected={selectedCategory === category}
                            onPress={() => setSelectedCategory(category)}
                        />
                    ))}
                </ScrollView>
            </View>

            {/* Room List */}
            {filteredRooms.length === 0 ? (
                <EmptyState
                    hasSearch={searchQuery.length > 0}
                    onClearSearch={handleClearSearch}
                    onCreateRoom={onCreateRoom}
                />
            ) : (
                <FlatList
                    data={groupedRooms}
                    keyExtractor={(item) => item.title}
                    extraData={myRooms}
                    renderItem={({ item: group }) => (
                        <View style={styles.group}>
                            <Text style={styles.groupTitle}>{group.title}</Text>
                            {group.rooms.map((room) => (
                                <RoomListItemWrapper
                                    key={room.id}
                                    room={room}
                                    onJoin={handleRoomPress}
                                    onEnterRoom={onEnterRoom}
                                    userLocation={userLocation}
                                />
                            ))}
                        </View>
                    )}
                    ListFooterComponent={() => (
                        <>
                            {/* Loading more indicator */}
                            {isLoadingMore && (
                                <View style={styles.loadingMoreContainer}>
                                    <ActivityIndicator size="small" color="#f97316" />
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
                    maxToRenderPerBatch={5}
                    updateCellsBatchingPeriod={50}
                    windowSize={10}
                    initialNumToRender={5}
                />
            )}

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
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <>
                                        <Text style={styles.confirmButtonText}>Join Room</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6b7280',
    },
    header: {
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
    },
    filterButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterButtonActive: {
        backgroundColor: '#fff7ed',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        fontSize: 15,
        color: '#1f2937',
    },
    clearButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#e5e7eb',
    },
    filterPanel: {
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterLabel: {
        fontSize: 14,
        color: '#6b7280',
        marginRight: 12,
    },
    sortChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        marginRight: 8,
    },
    sortChipSelected: {
        backgroundColor: '#fff7ed',
    },
    sortChipText: {
        fontSize: 13,
        color: '#6b7280',
        textTransform: 'capitalize',
    },
    sortChipTextSelected: {
        color: '#f97316',
        fontWeight: '500',
    },
    categoriesContainer: {
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingVertical: 12,
    },
    categoriesContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        marginRight: 8,
    },
    categoryChipSelected: {
        backgroundColor: '#f97316',
    },
    categoryChipText: {
        fontSize: 14,
        color: '#6b7280',
    },
    categoryChipTextSelected: {
        color: '#ffffff',
        fontWeight: '500',
    },
    roomList: {
        flex: 1,
    },
    roomListContent: {
        padding: 16,
    },
    group: {
        marginBottom: 24,
    },
    groupTitle: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6b7280',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    roomCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    roomCardContent: {
        flexDirection: 'row',
        gap: 12,
    },
    emojiContainer: {
        position: 'relative',
    },
    roomEmoji: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#f3f4f6', // Softer default gray
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#f97316',
        borderWidth: 2,
        borderColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    roomEmojiText: {
        fontSize: 20,
    },
    roomInfo: {
        flex: 1,
    },
    roomTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    roomDescription: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
        lineHeight: 16,
    },
    roomMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: '#6b7280',
    },
    bottomMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    badgesWrapper: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    categoryBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: '#f3e8ff',
    },
    categoryBadgeText: {
        fontSize: 10,
        color: '#7c3aed',
        fontWeight: '600',
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f9fafb',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    timeText: {
        fontSize: 11,
        fontWeight: '500',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    newBadge: {
        backgroundColor: '#10b981',
    },
    activeBadge: {
        backgroundColor: '#f43f5e',
    },
    statusBadgeText: {
        color: '#ffffff',
        fontSize: 7,
        fontWeight: '700',
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    topRightMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 28,
        padding: 20,
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 15,
        elevation: 8,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    modalEmojiContainer: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: '#fff7ed',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalEmoji: {
        fontSize: 28,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        textAlign: 'center',
        marginBottom: 6,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#f97316',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#f97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },
    statusBadgesContainer: {
        position: 'absolute',
        bottom: -6,
        left: -4,
        right: -4,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff7ed',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyIconSearch: {
        width: 64,
        height: 64,
        borderRadius: 32,
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
    emptySubtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    emptyButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#f97316',
        borderRadius: 16,
    },
    emptyButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
    },
    emptyButtonSecondary: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#f3f4f6',
        borderRadius: 8,
        marginBottom: 16,
    },
    emptyButtonSecondaryText: {
        fontSize: 14,
        color: '#6b7280',
    },
    footer: {
        textAlign: 'center',
        fontSize: 13,
        color: '#6b7280',
        paddingVertical: 16,
    },
    loadingMoreContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        gap: 12,
    },
    loadingMoreText: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    endOfListContainer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    endOfListText: {
        fontSize: 13,
        color: '#16a34a',
        fontWeight: '600',
    },
});

export default RoomListView;
