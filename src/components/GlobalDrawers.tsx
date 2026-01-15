import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useUIState, useUIActions } from '../context/UIContext';
import { useAuth } from '../features/auth';
import { useMyRooms } from '../features/rooms/hooks';
import { Sidebar } from './Sidebar';
import { ProfileDrawer } from './ProfileDrawer';

export const GlobalDrawers = React.memo(function GlobalDrawers() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { isSidebarOpen, isProfileDrawerOpen } = useUIState();
    const { closeSidebar, openProfileDrawer, closeProfileDrawer } = useUIActions();
    const { rooms: myRooms } = useMyRooms();
    const { logout } = useAuth();

    const handleRoomSelect = useCallback((room: any) => {
        // Serialize room for safe navigation (Dates to strings)
        const serializedRoom = {
            ...room,
            expiresAt: room.expiresAt instanceof Date ? room.expiresAt.toISOString() : room.expiresAt,
            createdAt: room.createdAt instanceof Date ? room.createdAt.toISOString() : room.createdAt,
        };

        // If user hasn't joined (e.g., creator left the room), show RoomDetails to allow rejoining
        if (!room.hasJoined) {
            navigation.navigate('RoomDetails', { roomId: room.id, initialRoom: serializedRoom });
        } else {
            navigation.navigate('ChatRoom', { roomId: room.id, initialRoom: serializedRoom });
        }
        closeSidebar();
    }, [navigation, closeSidebar]);


    const handleProfilePress = useCallback(() => {
        // If already open (in state) but visually closed, we force a toggle
        // and using requestAnimationFrame to ensure the state update is clean
        if (isProfileDrawerOpen) {
            closeProfileDrawer();
            requestAnimationFrame(() => {
                openProfileDrawer();
            });
        } else {
            openProfileDrawer();
        }
    }, [isProfileDrawerOpen, openProfileDrawer, closeProfileDrawer]);

    return (
        <>
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={closeSidebar}
                rooms={myRooms}
                onRoomSelect={handleRoomSelect}
                onProfilePress={handleProfilePress}
            />
            <View style={[StyleSheet.absoluteFill, { zIndex: 2000 }]} pointerEvents="box-none">
                <ProfileDrawer
                    isOpen={isProfileDrawerOpen}
                    onClose={closeProfileDrawer}
                    onSignOut={logout}
                />
            </View>
        </>
    );
});
