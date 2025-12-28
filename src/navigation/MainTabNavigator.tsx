/**
 * Main Tab Navigator
 *
 * Bottom tab navigation for main app screens.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { Map, MessageCircle, User } from 'lucide-react-native';
import { MainTabParamList } from './types';
import { theme } from '../core/theme';

// Screens
import {
  MapScreen,
  RoomsScreen,
  ProfileScreen,
} from '../screens';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Tab bar icon component
 */
interface TabIconProps {
  focused: boolean;
  color: string;
  size: number;
}

const ACTIVE_COLOR = theme.tokens.brand.primary;
const INACTIVE_COLOR = theme.tokens.text.tertiary;

/**
 * Main Tab Navigator Component
 */
export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="MapTab"
        component={MapScreen}
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: ({ focused, color, size }: TabIconProps) => (
            <Map
              size={size}
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tab.Screen
        name="RoomsTab"
        component={RoomsScreen}
        options={{
          tabBarLabel: 'My Rooms',
          tabBarIcon: ({ focused, color, size }: TabIconProps) => (
            <MessageCircle
              size={size}
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color, size }: TabIconProps) => (
            <User
              size={size}
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: theme.tokens.bg.surface,
    borderTopWidth: 1,
    borderTopColor: theme.tokens.border.subtle,
    paddingTop: 8,
    paddingBottom: 8,
    height: 60,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});

export default MainTabNavigator;
