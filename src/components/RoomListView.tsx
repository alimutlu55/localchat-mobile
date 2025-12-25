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
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Room } from '../types';
import { useRooms, useIsRoomJoined } from '../context';

const CATEGORIES = ['All', 'Food', 'Social', 'Technology', 'Music', 'Gaming', 'Health', 'Education'];

type SortOption = 'nearest' | 'most-active' | 'expiring-soon' | 'newest';

interface RoomListViewProps {
    rooms: Room[];
    isLoading?: boolean;
    onJoinRoom?: (room: Room) => Promise<boolean>;
    onEnterRoom?: (room: Room) => void;
    onCreateRoom?: () => void;
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
}: {
    room: Room;
    onJoin?: (room: Room) => Promise<boolean>;
    onEnterRoom?: (room: Room) => void;
}) {
    // Use centralized hook to check if room is joined
    const hasJoined = useIsRoomJoined(room.id);
    
    return (
        <RoomListItem
            room={room}
            hasJoined={hasJoined}
            onJoin={onJoin}
            onEnterRoom={onEnterRoom}
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
}: {
    room: Room;
    hasJoined: boolean;
    onJoin?: (room: Room) => Promise<boolean>;
    onEnterRoom?: (room: Room) => void;
}) {
    const [isJoining, setIsJoining] = useState(false);
    
    // No local joinSuccess state - rely entirely on hasJoined from context
    // This prevents stale state when user leaves and returns

    const getTimeColor = () => {
        const hoursLeft = (room.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursLeft < 0.25) return '#dc2626';
        if (hoursLeft < 1) return '#ea580c';
        return '#16a34a';
    };

    const formatDistance = (meters: number): string => {
        if (meters < 1000) return `${Math.round(meters)}m`;
        return `${(meters / 1000).toFixed(1)}km`;
    };

    const handlePress = async () => {
        // If already joined, enter room
        if (hasJoined) {
            onEnterRoom?.(room);
            return;
        }

        if (!onJoin) return;

        setIsJoining(true);
        try {
            const success = await onJoin(room);
            if (success) {
                // Auto-enter after short delay for visual feedback
                setTimeout(() => {
                    onEnterRoom?.(room);
                }, 500);
            }
        } catch (error) {
            console.error('Failed to join:', error);
        } finally {
            setIsJoining(false);
        }
    };

    const buttonText = hasJoined ? 'Enter Room' : 'Join';
    const ButtonIcon = hasJoined ? LogIn : isJoining ? null : ChevronRight;

    const getGradientColors = () => {
        if (room.isFull) return ['#9ca3af', '#6b7280'];
        if (room.isExpiringSoon) return ['#f97316', '#ea580c'];
        return ['#fb923c', '#f43f5e'];
    };

    return (
        <View style={styles.roomCard}>
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
                                <Sparkles size={10} color="#ffffff" />
                                <Text style={styles.statusBadgeText}>New</Text>
                            </View>
                        )}
                        {room.isHighActivity && (
                            <View style={[styles.statusBadge, styles.activeBadge]}>
                                <Zap size={10} color="#ffffff" />
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
                        {room.isExpiringSoon && (
                            <Clock size={14} color="#ea580c" strokeWidth={3} />
                        )}
                    </View>

                    {/* Meta */}
                    <View style={styles.roomMeta}>
                        <View style={styles.metaItem}>
                            <Users size={14} color="#6b7280" />
                            <Text style={styles.metaText}>
                                {room.participantCount} {room.participantCount === 1 ? 'person' : 'people'}
                            </Text>
                        </View>
                        <View style={styles.metaItem}>
                            <MapPin size={14} color="#6b7280" />
                            <Text style={styles.metaText}>{formatDistance(room.distance || 0)}</Text>
                        </View>
                    </View>

                    {/* Category & Time */}
                    <View style={styles.bottomMetaRow}>
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{room.category}</Text>
                        </View>
                        <View style={styles.timeBadge}>
                            <Clock size={12} color={getTimeColor()} />
                            <Text style={[styles.timeText, { color: getTimeColor() }]}>
                                {room.timeRemaining}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Action Button */}
            <TouchableOpacity
                style={[
                    styles.actionButton,
                    hasJoined && styles.actionButtonEnter,
                ]}
                onPress={handlePress}
                disabled={isJoining}
                activeOpacity={0.8}
            >
                {isJoining ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                    <>
                        {ButtonIcon && <ButtonIcon size={18} color="#ffffff" />}
                        <Text style={styles.actionButtonText}>{buttonText}</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>
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
}: RoomListViewProps) {
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [sortBy, setSortBy] = useState<SortOption>('nearest');
    const [showFilters, setShowFilters] = useState(false);
    
    // Subscribe to myRooms to force re-render when join/leave state changes
    const { myRooms } = useRooms();

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
            filtered = filtered.filter((room) =>
                room.category.toLowerCase() === selectedCategory.toLowerCase()
            );
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'nearest':
                    return (a.distance || 0) - (b.distance || 0);
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
    }, [rooms, searchQuery, selectedCategory, sortBy]);

    // Group rooms by distance
    const groupedRooms = useMemo(() => {
        const groups: { title: string; rooms: Room[] }[] = [
            { title: 'Nearby (< 500m)', rooms: [] },
            { title: 'Close (< 1km)', rooms: [] },
            { title: 'Medium (< 5km)', rooms: [] },
            { title: 'Far (> 5km)', rooms: [] },
        ];

        filteredRooms.forEach((room) => {
            const distance = room.distance || 0;
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
    }, [filteredRooms]);

    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
    }, []);

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
                    {CATEGORIES.map((category) => (
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
                                    onJoin={onJoinRoom}
                                    onEnterRoom={onEnterRoom}
                                />
                            ))}
                        </View>
                    )}
                    ListFooterComponent={() => (
                        <Text style={styles.footer}>
                            {filteredRooms.length} {filteredRooms.length === 1 ? 'room' : 'rooms'} found
                        </Text>
                    )}
                    contentContainerStyle={styles.roomListContent}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={5}
                    updateCellsBatchingPeriod={50}
                    windowSize={10}
                    initialNumToRender={5}
                />
            )}
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
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
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
    roomEmoji: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#fff7ed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    roomEmojiText: {
        fontSize: 24,
    },
    roomInfo: {
        flex: 1,
    },
    roomTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 8,
    },
    roomMeta: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 6,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 13,
        color: '#6b7280',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 6,
    },
    categoryBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        backgroundColor: '#f3e8ff',
    },
    categoryBadgeText: {
        fontSize: 11,
        color: '#7c3aed',
        fontWeight: '600',
    },
    emojiContainer: {
        position: 'relative',
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
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 8,
        borderWidth: 1.5,
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
        fontSize: 8,
        fontWeight: '700',
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    bottomMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f9fafb',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    timeText: {
        fontSize: 11,
        fontWeight: '500',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#f97316',
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 12,
    },
    actionButtonEnter: {
        backgroundColor: '#16a34a',
    },
    actionButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
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
});

export default RoomListView;
