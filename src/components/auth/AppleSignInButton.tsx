/**
 * AppleSignInButton
 *
 * Standalone, reusable Apple Sign-In button with integrated OAuth flow.
 * Uses expo-apple-authentication for the native Apple Sign-In flow.
 */

import React, { useState } from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useAppleAuth } from '../../services/oauth';
import { useAuth } from '../../features/auth';

interface AppleSignInButtonProps {
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
 * Apple Logo SVG Component
 */
const AppleLogo = () => (
    <Svg width="18" height="18" viewBox="0 0 384 512">
        <Path
            fill="#FFFFFF"
            d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
        />
    </Svg>
);

/**
 * Apple Sign-In Button Component
 */
export function AppleSignInButton({
    onSuccess,
    onError,
    disabled = false,
    style,
}: AppleSignInButtonProps) {
    const { loginWithApple, isLoading: authLoading, clearError } = useAuth();
    const { promptAsync, isSupported } = useAppleAuth();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAppleLogin = async () => {
        if (!isSupported || authLoading || disabled || isProcessing) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsProcessing(true);

        try {
            clearError();
            const credential = await promptAsync();

            if (credential && credential.identityToken) {
                // Construct full name if provided
                const fullName = credential.fullName
                    ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
                    : undefined;

                await loginWithApple(credential.identityToken, fullName || undefined);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onSuccess?.();
            } else {
                // User cancelled or no token
                setIsProcessing(false);
            }
        } catch (err) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const errorMessage = err instanceof Error ? err.message : 'Apple sign-in failed';
            onError?.(errorMessage);
            setIsProcessing(false);
        }
    };

    const isButtonDisabled = !isSupported || authLoading || disabled || isProcessing;
    const showLoading = authLoading || isProcessing;

    // Only show on supported platforms
    if (!isSupported) {
        return null;
    }

    return (
        <TouchableOpacity
            style={[styles.button, isButtonDisabled && styles.buttonDisabled, style]}
            onPress={handleAppleLogin}
            disabled={isButtonDisabled}
            activeOpacity={0.8}
        >
            {showLoading ? (
                <ActivityIndicator color="#FFFFFF" />
            ) : (
                <>
                    <View style={styles.logoContainer}>
                        <AppleLogo />
                    </View>
                    <Text style={styles.text}>Continue with Apple</Text>
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
        backgroundColor: '#000000',
        paddingVertical: 14,
        paddingHorizontal: 24,
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
        color: '#FFFFFF',
    },
});

export default AppleSignInButton;
