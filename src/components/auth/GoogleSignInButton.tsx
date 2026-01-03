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
 *
 * @example
 * ```tsx
 * <GoogleSignInButton
 *   onSuccess={() => console.log('Signed in!')}
 *   onError={(error) => console.error(error)}
 * />
 * ```
 */

import React, { useEffect, useState } from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    View,
} from 'react-native';
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
                <ActivityIndicator color="#1f2937" />
            ) : (
                <>
                    {/* Google "G" Logo */}
                    <View style={styles.logoContainer}>
                        <Text style={styles.googleLogo}>G</Text>
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
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        gap: 10,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    logoContainer: {
        width: 20,
        height: 20,
        borderRadius: 4,
        backgroundColor: '#4285F4',
        justifyContent: 'center',
        alignItems: 'center',
    },
    googleLogo: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    text: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
});

export default GoogleSignInButton;
