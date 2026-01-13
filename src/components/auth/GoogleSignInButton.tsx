/**
 * GoogleSignInButton
 *
 * Standalone, reusable Google Sign-In button with integrated OAuth flow.
 * Uses expo-auth-session for cross-platform OAuth.
 *
 * This component handles the entire OAuth flow:
 * 1. Opens Google sign-in in browser/webview
 * 2. Handles the OAuth response
 * 3. Sends the ID token to the backend
 * 4. Manages loading and error states
 */

import React, { useEffect, useState } from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useGoogleAuth, extractIdToken, isGoogleOAuthConfigured } from '../../services/oauth';
import { useAuth } from '../../features/auth';

interface GoogleSignInButtonProps {
    /** Callback when sign-in succeeds */
    onSuccess?: () => void;
    /** Callback when sign-in fails */
    onError?: (error: string) => void;
    /** Whether the button is disabled */
    disabled?: boolean;
    /** Custom button style */
    style?: object;
}

/**
 * Google "G" Logo SVG Component
 */
const GoogleLogo = () => (
    <Svg width="18" height="18" viewBox="0 0 48 48">
        <Path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <Path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <Path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <Path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
        <Path fill="none" d="M0 0h48v48H0z" />
    </Svg>
);

/**
 * Google Sign-In Button Component
 */
export function GoogleSignInButton({
    onSuccess,
    onError,
    disabled = false,
    style,
}: GoogleSignInButtonProps) {
    const { loginWithGoogle, isLoading: authLoading, clearError } = useAuth();
    const { request, response, promptAsync, isReady } = useGoogleAuth();
    const [isProcessing, setIsProcessing] = useState(false);

    // Check if OAuth is configured
    const isConfigured = isGoogleOAuthConfigured();

    useEffect(() => {
        // Handle OAuth response
        const handleResponse = async () => {
            if (response?.type === 'success') {
                const idToken = extractIdToken(response);
                if (idToken) {
                    await handleGoogleLogin(idToken);
                } else {
                    onError?.('Failed to get ID token from Google');
                    setIsProcessing(false);
                }
            } else if (response?.type === 'error') {
                onError?.(response.error?.message || 'Google sign-in was cancelled');
                setIsProcessing(false);
            } else if (response?.type === 'cancel' || response?.type === 'dismiss') {
                // User cancelled - not an error, just reset state
                setIsProcessing(false);
            }
        };

        handleResponse();
    }, [response]);

    const handleGoogleLogin = async (idToken: string) => {
        try {
            clearError();
            await loginWithGoogle(idToken);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSuccess?.();
        } catch (err) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const errorMessage = err instanceof Error ? err.message : 'Google sign-in failed';
            onError?.(errorMessage);
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePress = async () => {
        if (!isReady || authLoading || disabled || isProcessing || !isConfigured) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsProcessing(true);
        await promptAsync();
    };

    const isButtonDisabled = !isReady || authLoading || disabled || isProcessing || !isConfigured;
    const showLoading = authLoading || isProcessing;

    // Don't render if OAuth is not configured
    if (!isConfigured) {
        return null;
    }

    return (
        <TouchableOpacity
            style={[styles.button, isButtonDisabled && styles.buttonDisabled, style]}
            onPress={handlePress}
            disabled={isButtonDisabled}
            activeOpacity={0.8}
        >
            {showLoading ? (
                <ActivityIndicator color="#374151" />
            ) : (
                <>
                    <View style={styles.logoContainer}>
                        <GoogleLogo />
                    </View>
                    <Text style={styles.text}>Continue with Google</Text>
                </>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingVertical: 14,
        paddingHorizontal: 24,
        paddingLeft: 64,
        borderRadius: 12,
        gap: 12,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    logoContainer: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
});

export default GoogleSignInButton;
