# LocalChat Mobile

React Native mobile application for LocalChat - a location-based chat platform.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Xcode (for iOS) - Run: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- Android Studio (for Android)
- Expo CLI: `npm install -g expo-cli`

### Installation

```bash
cd localchat-mobile

# Install dependencies
npm install

# Start development server
npm start
```

### Running the App

```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Physical device (scan QR code with Expo Go app)
npm start
```

## 📁 Project Structure

```
localchat-mobile/
├── App.tsx                     # Main entry point
├── app.json                    # Expo configuration
├── src/
│   ├── components/             # Reusable UI components
│   │   └── ui/                 # Base UI components (Button, Input, Avatar, etc.)
│   ├── screens/                # Screen components
│   │   ├── auth/               # Authentication screens
│   │   │   ├── WelcomeScreen.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   ├── AnonymousLoginScreen.tsx
│   │   │   └── ForgotPasswordScreen.tsx
│   │   ├── main/               # Main app screens
│   │   │   ├── MapScreen.tsx
│   │   │   ├── RoomsScreen.tsx
│   │   │   └── ProfileScreen.tsx
│   │   ├── ChatRoomScreen.tsx
│   │   ├── CreateRoomScreen.tsx
│   │   ├── RoomDetailsScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── EditProfileScreen.tsx
│   ├── navigation/             # React Navigation setup
│   │   ├── types.ts            # Type-safe navigation types
│   │   ├── RootNavigator.tsx   # Main auth-aware navigator
│   │   ├── AuthNavigator.tsx   # Auth stack
│   │   └── MainTabNavigator.tsx# Bottom tabs
│   ├── services/               # API and business logic
│   │   ├── api.ts              # REST API client
│   │   ├── auth.ts             # Authentication service
│   │   ├── room.ts             # Room operations
│   │   ├── message.ts          # Message operations
│   │   ├── websocket.ts        # Real-time WebSocket
│   │   └── storage.ts          # Secure/async storage
│   ├── context/                # React Context providers
│   │   └── AuthContext.tsx     # Global auth state
│   ├── types/                  # TypeScript definitions
│   ├── constants/              # App configuration
│   └── i18n/                   # Internationalization
└── assets/                     # Images, fonts, etc.
```

## 🔧 Configuration

### Backend API

Update the API URL in `src/constants/index.ts`:

```typescript
export const API_CONFIG = {
  BASE_URL: 'http://your-backend-url/api/v1',
  WS_URL: 'ws://your-backend-url/ws',
};
```

### Google Maps

Add your Google Maps API key to `app.json`:

```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "YOUR_API_KEY"
      }
    },
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_API_KEY"
        }
      }
    }
  }
}
```

## 📱 Features

### Authentication
- ✅ Anonymous login (quick start)
- ✅ Email/password login
- ✅ User registration
- ✅ Password reset
- ✅ Secure token storage

### Discovery
- ✅ Interactive map with room markers
- ✅ Location-based room search
- ✅ Room categories and filtering

### Chat
- ✅ Real-time messaging via WebSocket
- ✅ Typing indicators
- ✅ Message history
- ✅ Optimistic updates

### Room Management
- ✅ Create rooms with categories
- ✅ Join/leave rooms
- ✅ Participant list
- ✅ Kick/ban users (creator only)
- ✅ Close room (creator only)

### Profile
- ✅ Edit display name
- ✅ View joined/created rooms
- ✅ Settings and preferences

## 🏗 Architecture

### Navigation
- **React Navigation v7** with type-safe routing
- Automatic auth state handling
- Modal presentation for room creation

### State Management
- **React Context** for global auth state
- Local component state for UI
- **AsyncStorage** for persistence
- **SecureStore** for tokens

### API Communication
- REST API for CRUD operations
- WebSocket for real-time updates
- Automatic token refresh
- Error handling and retry logic

## 🧪 Development

### Type Checking
```bash
npx tsc --noEmit
```

### Linting
```bash
npm run lint
```

## 📦 Building for Production

### iOS
```bash
npx expo build:ios
# or with EAS
npx eas build --platform ios
```

### Android
```bash
npx expo build:android
# or with EAS
npx eas build --platform android
```

## 🔗 Backend Integration

This mobile app is designed to work with the LocalChat Spring Boot backend. Ensure:

1. Backend is running and accessible
2. API URL is correctly configured
3. WebSocket endpoint is available
4. CORS is properly configured for mobile clients

## 📄 License

Private - All rights reserved.
