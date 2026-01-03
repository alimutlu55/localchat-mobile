/**
 * OAuth Service
 *
 * Handles OAuth authentication flows for third-party providers.
 * Currently supports Google Sign-In using expo-auth-session.
 */

import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// Complete auth session on web (required for expo-auth-session)
WebBrowser.maybeCompleteAuthSession();

/**
 * OAuth configuration for Google.
 * 
 * NOTE: These should be configured via environment variables in production.
 * The client IDs are obtained from Google Cloud Console:
 * https://console.cloud.google.com/apis/credentials
 * 
 * You need to create OAuth 2.0 Client IDs for:
 * - iOS (iOS bundle ID)
 * - Android (Android package name + SHA-1 fingerprint)
 * - Web (for Expo Go development)
 */
export const GOOGLE_OAUTH_CONFIG = {
    // Web client ID (used for Expo Go development and web)
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
    // iOS client ID
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
    // Android client ID
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
};

/**
 * Google Auth Session Result type.
 */
export type GoogleAuthResult = ReturnType<typeof Google.useIdTokenAuthRequest>[1];

/**
 * Hook for Google Sign-In using ID token authentication.
 * 
 * This hook provides:
 * - `request`: The auth request object (null if not ready)
 * - `response`: The auth response after user completes sign-in
 * - `promptAsync`: Function to start the sign-in flow
 * - `isReady`: Whether the auth request is ready
 * 
 * @example
 * ```tsx
 * const { request, response, promptAsync, isReady } = useGoogleAuth();
 * 
 * useEffect(() => {
 *   if (response?.type === 'success') {
 *     const idToken = response.params.id_token;
 *     // Send token to your backend
 *   }
 * }, [response]);
 * 
 * return (
 *   <Button onPress={() => promptAsync()} disabled={!isReady}>
 *     Sign in with Google
 *   </Button>
 * );
 * ```
 */
export function useGoogleAuth() {
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        clientId: GOOGLE_OAUTH_CONFIG.webClientId,
        iosClientId: GOOGLE_OAUTH_CONFIG.iosClientId,
        androidClientId: GOOGLE_OAUTH_CONFIG.androidClientId,
    });

    return {
        request,
        response,
        promptAsync,
        isReady: !!request,
    };
}

/**
 * Extract ID token from Google auth response.
 * 
 * @param response The auth response from useGoogleAuth
 * @returns The ID token string if successful, null otherwise
 */
export function extractIdToken(
    response: GoogleAuthResult
): string | null {
    if (response?.type === 'success' && response.params?.id_token) {
        return response.params.id_token;
    }
    return null;
}

/**
 * Check if Google OAuth is configured.
 * Returns true if at least one client ID is configured.
 */
export function isGoogleOAuthConfigured(): boolean {
    return !!(
        GOOGLE_OAUTH_CONFIG.webClientId ||
        GOOGLE_OAUTH_CONFIG.iosClientId ||
        GOOGLE_OAUTH_CONFIG.androidClientId
    );
}
