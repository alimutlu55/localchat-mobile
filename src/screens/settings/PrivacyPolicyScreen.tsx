/**
 * Privacy Policy Screen
 *
 * Opens the privacy policy from the external website.
 * This ensures users always see the most up-to-date version.
 */

import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { theme } from '../../core/theme';

const PRIVACY_POLICY_URL = 'https://bubbleupapp.com/privacy.html';

/**
 * Privacy Policy Screen Component
 * Opens the external privacy policy URL and navigates back when closed.
 */
export default function PrivacyPolicyScreen() {
    const navigation = useNavigation();

    useEffect(() => {
        const openPrivacyPolicy = async () => {
            try {
                await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL, {
                    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                    controlsColor: theme.tokens.brand.primary,
                    toolbarColor: theme.tokens.bg.surface,
                });
            } catch (error) {
                console.error('Failed to open privacy policy:', error);
            } finally {
                // Navigate back when browser is closed
                navigation.goBack();
            }
        };

        openPrivacyPolicy();
    }, [navigation]);

    // Show loading state while browser is opening
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.tokens.brand.primary} />
                <Text style={styles.loadingText}>Opening Privacy Policy...</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.tokens.bg.canvas,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: theme.tokens.text.secondary,
    },
});

export { PrivacyPolicyScreen };
