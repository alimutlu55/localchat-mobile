import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useUIState, useUIActions } from '../context/UIContext';
import { useRooms, useAuth } from '../context';
import { Sidebar } from './Sidebar';
import { ProfileDrawer } from './ProfileDrawer';

export const GlobalDrawers = React.memo(function GlobalDrawers() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { isSidebarOpen, isProfileDrawerOpen } = useUIState();
    const { closeSidebar, openProfileDrawer, closeProfileDrawer } = useUIActions();
    const { myRooms } = useRooms();
    const { logout } = useAuth();

    const handleRoomSelect = useCallback((room: any) => {
        navigation.navigate('ChatRoom', { room });
        closeSidebar();
    }, [navigation, closeSidebar]);

    const handleProfilePress = useCallback(() => {
        closeSidebar();
        // Delay opening profile drawer slightly to ensure sidebar closing animation starts
        setTimeout(openProfileDrawer, 50);
    }, [closeSidebar, openProfileDrawer]);

    return (
        <>
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={closeSidebar}
                rooms={myRooms}
                onRoomSelect={handleRoomSelect}
                onProfilePress={handleProfilePress}
            />
            <ProfileDrawer
                isOpen={isProfileDrawerOpen}
                onClose={closeProfileDrawer}
                onSignOut={logout}
            />
        </>
    );
});
