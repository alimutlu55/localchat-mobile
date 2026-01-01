/**
 * Navigation Types
 *
 * Type definitions for React Navigation.
 * This file provides type safety for navigation throughout the app.
 *
 * MIGRATION NOTE:
 * We're transitioning from passing full Room objects to passing roomId.
 * During migration, screens handle both patterns via runtime checks.
 */

import { NavigatorScreenParams } from '@react-navigation/native';
import { Room } from '../types';

/**
 * Room navigation params
 * 
 * NEW pattern: { roomId: string, initialRoom?: Room }
 * LEGACY pattern: { room: Room }
 * 
 * Screens should check which fields are present at runtime.
 */
export interface RoomNavParams {
  /** NEW: Pass roomId for data fetching from store */
  roomId?: string;
  /** Room name for display (optional) */
  roomName?: string;
  /** NEW: Optional initial data for optimistic rendering */
  initialRoom?: Room;
  /** LEGACY: Full room object (deprecated, use roomId instead) */
  room?: Room;
}

/**
 * Root Stack Navigator Params
 */
export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Discovery: undefined;
  // Room screens support both new and legacy param patterns
  ChatRoom: RoomNavParams;
  RoomDetails: RoomNavParams;
  RoomInfo: RoomNavParams & {
    isCreator: boolean;
    currentUserId?: string;
    onCloseRoom?: () => void;
    onCloseSuccess?: () => void;
  };
  CreateRoom: undefined;
  Settings: undefined;
  Profile: undefined;
  EditProfile: undefined;
  BlockedUsers: undefined;
  Onboarding: undefined;
  List: undefined;
  Login: undefined;
};

/**
 * Auth Stack Navigator Params
 */
export type AuthStackParamList = {
  Welcome: undefined;
  EmailEntry: undefined;
  Login: { email: string };
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

