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
  Welcome: undefined;
  Onboarding: undefined;
  Login: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: undefined;
  List: undefined;
  ChatRoom: { room: Room };
  RoomDetails: { room: Room };
  CreateRoom: undefined;
  Settings: undefined;
  Profile: undefined;
  EditProfile: undefined;
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
 * Type helper for useNavigation hook
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList { }
  }
}

