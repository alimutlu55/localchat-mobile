/**
 * List Screen
 *
 * List view of nearby rooms with search, filters, and room cards.
 * Uses RoomContext for centralized state management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { Menu, Plus, Map as MapIcon, List } from 'lucide-react-native';
import { RootStackParamList } from '../../navigation/types';
import { Room } from '../../types';
import { ROOM_CONFIG } from '../../constants';
import { useAuth } from '../../features/auth';
import { useRoomDiscovery, useJoinRoom, useMyRooms } from '../../features/rooms/hooks';
import { RoomListView } from '../../features/discovery/components';
import { Sidebar } from '../../components/Sidebar';
import { ProfileDrawer } from '../../components/ProfileDrawer';
import { theme } from '../../core/theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ListScreen() {
    const navigation = useNavigation<NavigationProp>();
    const { logout } = useAuth();

    // Use hooks instead of RoomContext
    const {
        rooms: discoveredRooms,
        isLoading: isLoadingRooms,
        refresh: refreshRooms,
    } = useRoomDiscovery({
        latitude: 0,
        longitude: 0,
        autoFetch: false,
    });

    const { join: joinRoomHook } = useJoinRoom();
    const { rooms: myRooms, activeRooms: myActiveRooms, expiredRooms: myExpiredRooms } = useMyRooms();

    // Wrapper for joinRoom
    const joinRoom = async (room: Room): Promise<boolean> => {
        const result = await joinRoomHook(room);
        return result.success;
    };

    // Wrapper for fetchDiscoveredRooms
    const fetchDiscoveredRooms = async (lat: number, lng: number, radius?: number) => {
        await refreshRooms();
    };

    // Compute activeRooms from discovered rooms
    const activeRooms = React.useMemo(() => {
        const now = Date.now();
        return discoveredRooms.filter(room => {
            const isExpired = room.expiresAt && room.expiresAt.getTime() < now;
            return !isExpired && room.status !== 'closed' && room.status !== 'expired';
        });
    }, [discoveredRooms]);

    // Sidebar rooms
    const sidebarRooms = { activeRooms: myActiveRooms, expiredRooms: myExpiredRooms };

    // Local UI state
    const [isLoading, setIsLoading] = useState(true);
    const [userLocation, setUserLocation] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);

    // Sidebar and profile drawer state
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

    // Track if initial fetch has been done (prevents double-fetch)
    const hasFetchedRef = React.useRef(false);

    // Get location and fetch rooms
    useEffect(() => {
        // Prevent double-fetch
        if (hasFetchedRef.current) return;

        const getLocationAndRooms = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Location Permission', 'Location permission is needed to show nearby rooms.');
                    setIsLoading(false);
                    return;
                }

                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

                const coords = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                };
                setUserLocation(coords);

                // Fetch rooms using context
                hasFetchedRef.current = true;
                await fetchDiscoveredRooms(coords.latitude, coords.longitude, ROOM_CONFIG.DEFAULT_RADIUS);
            } catch (error) {
                console.error('Failed to get location or rooms:', error);
            } finally {
                setIsLoading(false);
            }
        };

        getLocationAndRooms();
    }, [fetchDiscoveredRooms]);

    // Note: User's rooms are fetched automatically by RoomContext when user logs in

    const handleCreateRoom = () => {
        navigation.navigate('CreateRoom');
    };

    const handleJoinRoom = async (room: Room): Promise<boolean> => {
        return joinRoom(room);
    };

    const handleEnterRoom = (room: Room) => {
        // Check if user needs to join first (e.g., after being kicked)
        if (!room.hasJoined && !room.isCreator) {
            navigation.navigate('RoomDetails', { roomId: room.id, initialRoom: room });
        } else {
            navigation.navigate('ChatRoom', { roomId: room.id, initialRoom: room });
        }
    };

    const handleBackToMap = () => {
        // Navigate back to the previous screen (Discovery/Map)
        navigation.goBack();
    };

    return (
        <View style={styles.container}>
            {/* Header - matching web and MapScreen */}
            <SafeAreaView style={styles.header} edges={['top']}>
                <View style={styles.headerContent}>
                    {/* Left: Hamburger */}
                    <TouchableOpacity
                        style={styles.hamburgerButton}
                        onPress={() => setIsSidebarOpen(true)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Menu size={24} color={theme.tokens.text.primary} />
                    </TouchableOpacity>

                    {/* Center: Title */}
                    <Text style={styles.headerTitle}>Huddle</Text>

                    {/* Right: Create Room */}
                    <TouchableOpacity
                        style={styles.headerCreateButton}
                        onPress={handleCreateRoom}
                        activeOpacity={0.8}
                    >
                        <Plus size={20} color={theme.tokens.text.onPrimary} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Room List View - uses activeRooms (non-expired, non-closed) */}
            <RoomListView
                rooms={activeRooms}
                isLoading={isLoading || isLoadingRooms}
                onJoinRoom={handleJoinRoom}
                onEnterRoom={handleEnterRoom}
                onCreateRoom={handleCreateRoom}
                userLocation={userLocation}
            />

            {/* Floating Map/List Toggle - Bottom Center */}
            <View style={styles.viewToggleContainer}>
                <View style={styles.viewToggle}>
                    <TouchableOpacity
                        style={styles.viewToggleButton}
                        onPress={handleBackToMap}
                    >
                        <MapIcon size={18} color={theme.tokens.text.tertiary} />
                        <Text style={styles.viewToggleText}>Map</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, styles.viewToggleButtonActive]}
                    >
                        <List size={18} color={theme.tokens.text.onPrimary} />
                        <Text style={styles.viewToggleTextActive}>List</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Sidebar */}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                rooms={myRooms}
                onRoomSelect={(room) => {
                    // Check if user needs to join first (e.g., after being kicked)
                    if (!room.hasJoined && !room.isCreator) {
                        navigation.navigate('RoomDetails', { roomId: room.id, initialRoom: room });
                    } else {
                        navigation.navigate('ChatRoom', { roomId: room.id, initialRoom: room });
                    }
                }}
                onProfilePress={() => {
                    setIsSidebarOpen(false);
                    setIsProfileDrawerOpen(true);
                }}
            />

            {/* Profile Drawer */}
            <ProfileDrawer
                isOpen={isProfileDrawerOpen}
                onClose={() => setIsProfileDrawerOpen(false)}
                onSignOut={logout}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.tokens.bg.canvas,
    },
    header: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: theme.tokens.border.subtle,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    hamburgerButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '400',
        color: theme.tokens.text.primary,
    },
    headerCreateButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f97316',
    },
    viewToggleContainer: {
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 16,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: theme.tokens.border.subtle,
    },
    viewToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 6,
    },
    viewToggleButtonActive: {
        backgroundColor: '#f97316',
    },
    viewToggleText: {
        fontSize: 14,
        color: theme.tokens.text.tertiary,
    },
    viewToggleTextActive: {
        fontSize: 14,
        color: theme.tokens.text.onPrimary,
        fontWeight: '500',
    },
});
