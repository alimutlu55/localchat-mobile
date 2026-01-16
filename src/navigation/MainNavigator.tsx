import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainFlowStackParamList } from './types';
import { DiscoveryScreen } from '../features/discovery';
import { ChatRoomScreen } from '../features/chat';
import { RoomDetailsScreen, RoomInfoScreen, CreateRoomScreen } from '../features/rooms';
import { GlobalDrawers } from '../components/GlobalDrawers';
import ListScreen from '../screens/main/ListScreen';
import MapScreen from '../screens/main/MapScreen';
import RoomsScreen from '../screens/main/RoomsScreen';

const Stack = createNativeStackNavigator<MainFlowStackParamList>();

/**
 * MainNavigator hosts the primary app screens that should have
 * the Sidebar and ProfileDrawer available.
 * 
 * By nesting this inside RootNavigator, any other screens pushed to 
 * RootNavigator (like EditProfile) will naturally appear ON TOP of these drawers.
 */
export function MainNavigator() {
    return (
        <>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}
            >
                <Stack.Screen
                    name="Discovery"
                    component={DiscoveryScreen}
                    options={{ animation: 'fade' }}
                />
                <Stack.Screen
                    name="RoomDetails"
                    component={RoomDetailsScreen}
                />
                <Stack.Screen
                    name="ChatRoom"
                    component={ChatRoomScreen}
                />
                <Stack.Screen
                    name="RoomInfo"
                    component={RoomInfoScreen}
                />
                <Stack.Screen
                    name="CreateRoom"
                    component={CreateRoomScreen}
                />
                <Stack.Screen
                    name="List"
                    component={ListScreen}
                />
                <Stack.Screen
                    name="Map"
                    component={MapScreen}
                />
                <Stack.Screen
                    name="Rooms"
                    component={RoomsScreen}
                />
            </Stack.Navigator>

            {/* Render GlobalDrawers here so they are part of the MainFlow layout */}
            <GlobalDrawers />
        </>
    );
}

export default MainNavigator;
