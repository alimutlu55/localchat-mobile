/**
 * Screen Exports
 */

// Splash & Loading
export { default as SplashScreen } from './SplashScreen';
export { default as LoadingScreen } from './LoadingScreen';

// Auth screens
export { default as WelcomeScreen } from './auth/WelcomeScreen';
export { default as EmailEntryScreen } from './auth/EmailEntryScreen';
export { default as LoginScreen } from './auth/LoginScreen';
export { default as RegisterScreen } from './auth/RegisterScreen';
export { default as AnonymousLoginScreen } from './auth/AnonymousLoginScreen';
export { default as ForgotPasswordScreen } from './auth/ForgotPasswordScreen';
export { default as OnboardingScreen } from './auth/OnboardingScreen';

// Main screens
// DiscoveryScreen now uses feature-based architecture with hooks
export { DiscoveryScreen } from '../features/discovery';
export { default as RoomsScreen } from './main/RoomsScreen';
export { default as ProfileScreen } from './main/ProfileScreen';
export { default as MapScreen } from './main/MapScreen';
export { default as ListScreen } from './main/ListScreen';

// Chat & Room screens
// These screens now live in feature modules for better organization
export { ChatRoomScreen } from '../features/chat';
export { RoomDetailsScreen, RoomInfoScreen, CreateRoomScreen } from '../features/rooms';

// Settings screens
export { default as SettingsScreen } from './SettingsScreen';
export { default as EditProfileScreen } from './EditProfileScreen';
