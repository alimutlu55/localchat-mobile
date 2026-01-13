/**
 * OAuth Service
 *
 * Handles OAuth authentication flows for third-party providers.
 * Currently supports Google and Apple Sign-In.
 */

import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

// Complete auth session on web (required for expo-auth-session)
WebBrowser.maybeCompleteAuthSession();

/**
 * OAuth configuration for Google.
 * 
 * NOTE: These should be configured via environment variables in production.
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
 * Hook for Apple Sign-In.
 * 
 * This hook provides a way to start the Apple Sign-In flow.
 * Note: Apple Sign-In only works on iOS devices and some Android/Web flows.
 */
export function useAppleAuth() {
    const isAvailable = async (): Promise<boolean> => {
        return await AppleAuthentication.isAvailableAsync();
    };

    const promptAsync = async () => {
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });
            return credential;
        } catch (e: any) {
            if (e.code === 'ERR_CANCELED') {
                return null;
            }
            throw e;
        }
    };

    return {
        promptAsync,
        isAvailable,
        isSupported: Platform.OS === 'ios',
    };
}

/**
 * Check if Apple OAuth is available on this platform.
 */
export async function isAppleAuthAvailable(): Promise<boolean> {
    return Platform.OS === 'ios' && await AppleAuthentication.isAvailableAsync();
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
