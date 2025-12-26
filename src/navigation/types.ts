/**
 * Navigation Types
 *
 * Type definitions for React Navigation.
 * This file provides type safety for navigation throughout the app.
 */

import { NavigatorScreenParams } from '@react-navigation/native';
import { Room } from '../types';

/**
 * Root Stack Navigator Params
 */
export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Discovery: undefined;
  ChatRoom: { room: Room };
  RoomDetails: { room: Room };
  RoomInfo: {
    room: Room;
    isCreator: boolean;
    currentUserId?: string;
    onCloseRoom?: () => void;
  };
  CreateRoom: undefined;
  Settings: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Onboarding: undefined;
  List: undefined;
  Login: undefined;
};

/**
 * Auth Stack Navigator Params
 */
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  AnonymousLogin: undefined;
  ForgotPassword: undefined;
};

/**
 * Main Tab Navigator Params
 */
export type MainTabParamList = {
  MapTab: undefined;
  RoomsTab: undefined;
  ProfileTab: undefined;
};


/**
    interface RootParamList extends RootStackParamList { }
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList { }
  }
}

