/**
 * Terms of Service Screen
 *
 * Opens the terms of service from the external website.
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

const TERMS_OF_SERVICE_URL = 'https://bubbleupapp.com/terms.html';

/**
 * Terms of Service Screen Component
 * Opens the external terms of service URL and navigates back when closed.
 */
export default function TermsOfServiceScreen() {
    const navigation = useNavigation();

    useEffect(() => {
        const openTermsOfService = async () => {
            try {
                await WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL, {
                    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                    controlsColor: theme.tokens.brand.primary,
                    toolbarColor: theme.tokens.bg.surface,
                });
            } catch (error) {
                console.error('Failed to open terms of service:', error);
            } finally {
                // Navigate back when browser is closed
                navigation.goBack();
            }
        };

        openTermsOfService();
    }, [navigation]);

    // Show loading state while browser is opening
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.tokens.brand.primary} />
                <Text style={styles.loadingText}>Opening Terms of Service...</Text>
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

export { TermsOfServiceScreen };
