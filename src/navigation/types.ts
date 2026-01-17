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
import { Room, SerializedRoom } from '../types';

/**
 * Room navigation params
 * 
 * NEW pattern: { roomId: string, initialRoom?: SerializedRoom }
 * LEGACY pattern: { room: Room }
 * 
 * Use serializeRoom() before passing room data to navigation.
 * Use deserializeRoom() when receiving room data from navigation.
 */
export interface RoomNavParams {
  /** NEW: Pass roomId for data fetching from store */
  roomId?: string;
  /** Room name for display (optional) */
  roomName?: string;
  /** NEW: Optional initial data for optimistic rendering (use serializeRoom before passing) */
  initialRoom?: SerializedRoom;
  /** LEGACY: Full room object (deprecated, use roomId instead) */
  room?: Room;
}

/**
 * Root Stack Navigator Params
 */
export type RootStackParamList = {
  Splash: undefined;
  // Consent flow (shown before auth on first launch)
  Consent: undefined;
  ConsentPreferences: undefined;
  // Auth flow
  Auth: NavigatorScreenParams<AuthStackParamList>;
  RegistrationAuth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;

  // Main Flow (Discovery + Chat + Global Drawers)
  MainFlow: NavigatorScreenParams<MainFlowStackParamList>;

  // Modals & Sub-screens pushed on top of MainFlow
  CreateRoom: { initialLocation?: { latitude: number; longitude: number } };
  Profile: undefined;
  EditProfile: undefined;
  BlockedUsers: undefined;
  Onboarding: undefined;
  Login: undefined;
  // Profile drawer sub-screens (pushed on top of drawer)
  LocationSettings: undefined;
  LanguageSettings: undefined;
  DataControls: undefined;
  ReportProblem: undefined;
  Subscription: undefined;
  CustomPaywall: undefined;

  // Legacy/Direct access (React Navigation handles nested lookup)
  Discovery: undefined;
  ChatRoom: RoomNavParams;
  RoomInfo: RoomNavParams & {
    isCreator: boolean;
    currentUserId?: string;
    onCloseRoom?: () => void;
  };
};

/**
 * Main Flow Stack Params (Screens that host the Global Drawers)
 */
export type MainFlowStackParamList = {
  Discovery: undefined;
  ChatRoom: RoomNavParams;
  RoomDetails: RoomNavParams;
  CreateRoom: { initialLocation?: { latitude: number; longitude: number } };
  RoomInfo: RoomNavParams & {
    isCreator: boolean;
    currentUserId?: string;
    onCloseRoom?: () => void;
  };
  List: undefined;
  Map: undefined;
  Rooms: undefined;
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

