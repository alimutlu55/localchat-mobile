/**
 * Location Permission Screen
 * 
 * Shown after consent is given to request location permission from the system.
 * This creates a better UX by explaining why we need location access BEFORE
 * the system dialog appears (pre-permission priming).
 * 
 * Legal Note: Location is the core functionality of LocalChat. Without it,
 * the app cannot discover nearby rooms. We clearly state that exact coordinates
 * are NOT stored permanently.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ScrollView,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MapPin, Compass, MessageSquare, Lock } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useTheme } from '../../core/theme';
import { useAuth } from '../../features/auth';
import { consentService } from '../../services/consent';

type NavigationProp = NativeStackNavigationProp<any>;

export default function LocationPermissionScreen() {
    const navigation = useNavigation<NavigationProp>();
    const theme = useTheme();
    const { status: authStatus } = useAuth();
    const [isRequesting, setIsRequesting] = useState(false);

    const handleEnableLocation = async () => {
        setIsRequesting(true);
        try {
            // Request permission - this will show the system dialog
            const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

            if (status === 'granted') {
                // Permission granted, save consent and navigate
                await consentService.updatePreferences(undefined, undefined, true);
                if (authStatus === 'authenticated') {
                    if (navigation.canGoBack()) {
                        navigation.goBack();
                    } else {
                        navigation.navigate('Discovery');
                    }
                } else {
                    navigation.replace('Auth');
                }
                return;
            }

            // Permission denied - check if we can ask again
            if (!canAskAgain) {
                // User set to "Never" - inform them and offer settings
                Alert.alert(
                    'Location Disabled',
                    'Location access is disabled for LocalChat. To use location features, please enable it in your device settings.',
                    [
                        {
                            text: 'Continue without location',
                            onPress: async () => {
                                await consentService.updatePreferences(undefined, undefined, false);
                                if (authStatus === 'authenticated') {
                                    if (navigation.canGoBack()) {
                                        navigation.goBack();
                                    } else {
                                        navigation.navigate('Discovery');
                                    }
                                } else {
                                    navigation.replace('Auth');
                                }
                            },
                            style: 'cancel'
                        },
                        {
                            text: 'Open Settings',
                            onPress: async () => {
                                setIsRequesting(false);
                                await Linking.openSettings();
                            },
                            style: 'default'
                        }
                    ]
                );
            } else {
                // User can be asked again - show retry option
                Alert.alert(
                    'Location Required',
                    'LocalChat needs your location to discover nearby rooms. Without it, core features won\'t work.',
                    [
                        {
                            text: 'Continue without location',
                            onPress: async () => {
                                await consentService.updatePreferences(undefined, undefined, false);
                                if (authStatus === 'authenticated') {
                                    if (navigation.canGoBack()) {
                                        navigation.goBack();
                                    } else {
                                        navigation.navigate('Discovery');
                                    }
                                } else {
                                    navigation.replace('Auth');
                                }
                            },
                            style: 'destructive'
                        },
                        {
                            text: 'Try again',
                            onPress: () => setIsRequesting(false),
                            style: 'default'
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Error requesting location permission:', error);
            Alert.alert(
                'Permission Error',
                'Could not request location permission. Please try again.',
                [{ text: 'OK', onPress: () => setIsRequesting(false) }]
            );
        }
    };

    const handleNotNow = () => {
        Alert.alert(
            'Continue without location?',
            'You won\'t be able to discover or create rooms near you. LocalChat\'s core features require location access.',
            [
                {
                    text: 'Continue anyway',
                    onPress: async () => {
                        await consentService.updatePreferences(undefined, undefined, false);

                        if (authStatus === 'authenticated') {
                            if (navigation.canGoBack()) {
                                navigation.goBack();
                            } else {
                                navigation.navigate('Discovery');
                            }
                        } else {
                            navigation.replace('Auth');
                        }
                    },
                    style: 'destructive'
                },
                {
                    text: 'Enable location',
                    onPress: handleEnableLocation,
                    style: 'default'
                }
            ]
        );
    };

    const handleViewTerms = () => {
        navigation.navigate('Auth', {
            screen: 'TermsOfService'
        });
    };

    const handleViewPrivacy = () => {
        navigation.navigate('Auth', {
            screen: 'PrivacyPolicy'
        });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.tokens.bg.surface }]}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Illustration */}
                <View style={styles.illustrationContainer}>
                    <View style={[styles.mainCircle, { backgroundColor: theme.tokens.bg.subtle }]}>
                        <MapPin size={44} color={theme.tokens.brand.primary} strokeWidth={1.5} />
                    </View>
                    <View style={[styles.floatingBubble1, { backgroundColor: theme.tokens.status.success.bg }]}>
                        <Compass size={20} color={theme.tokens.status.success.main} strokeWidth={2} />
                    </View>
                    <View style={[styles.floatingBubble2, { backgroundColor: theme.tokens.status.warning.bg }]}>
                        <MessageSquare size={18} color={theme.tokens.status.warning.main} strokeWidth={2} />
                    </View>
                </View>

                {/* Title */}
                <Text style={[styles.title, { color: theme.tokens.text.primary }]}>Enable location access</Text>

                {/* Description */}
                <Text style={[styles.description, { color: theme.tokens.text.secondary }]}>
                    LocalChat connects you with people and conversations nearby.
                    Location is essential for discovering rooms around you.
                </Text>

                {/* Features List */}
                <View style={styles.featuresList}>
                    <View style={styles.featureItem}>
                        <View style={[styles.featureDot, { backgroundColor: theme.tokens.brand.primary }]} />
                        <Text style={[styles.featureText, { color: theme.tokens.text.secondary }]}>
                            Discover chat rooms within walking distance
                        </Text>
                    </View>
                    <View style={styles.featureItem}>
                        <View style={[styles.featureDot, { backgroundColor: theme.tokens.brand.primary }]} />
                        <Text style={[styles.featureText, { color: theme.tokens.text.secondary }]}>
                            Create rooms at your current location
                        </Text>
                    </View>
                    <View style={styles.featureItem}>
                        <View style={[styles.featureDot, { backgroundColor: theme.tokens.brand.primary }]} />
                        <Text style={[styles.featureText, { color: theme.tokens.text.secondary }]}>
                            See nearby activity on the map in real-time
                        </Text>
                    </View>
                </View>

                {/* Privacy Assurance */}
                <View style={[styles.privacyCard, { backgroundColor: theme.tokens.status.success.bg }]}>
                    <Lock size={16} color={theme.tokens.status.success.main} />
                    <Text style={[styles.privacyText, { color: theme.tokens.status.success.main }]}>
                        Your exact location is used in real-time only and is{' '}
                        <Text style={styles.privacyBold}>never stored</Text> on our servers.
                    </Text>
                </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
                {/* Legal links - Sticky to buttons */}
                <View style={[styles.legalLinks, { borderTopColor: theme.tokens.border.subtle }]}>
                    <Text style={[styles.legalText, { color: theme.tokens.text.tertiary }]}>
                        By continuing, you agree to our{' '}
                        <Text style={[styles.link, { color: theme.tokens.brand.primary }]} onPress={handleViewTerms}>Terms of Service</Text>
                        {' '}and{' '}
                        <Text style={[styles.link, { color: theme.tokens.brand.primary }]} onPress={handleViewPrivacy}>Privacy Policy</Text>.
                    </Text>
                </View>

                <TouchableOpacity
                    style={[
                        styles.primaryButton,
                        { backgroundColor: theme.tokens.bg.subtle },
                        isRequesting && styles.buttonDisabled
                    ]}
                    onPress={handleEnableLocation}
                    activeOpacity={0.8}
                    disabled={isRequesting}
                >
                    <Text style={[styles.primaryButtonText, { color: theme.tokens.text.primary }]}>
                        {isRequesting ? 'Requesting access...' : 'Allow location access'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={handleNotNow}
                    activeOpacity={0.8}
                    disabled={isRequesting}
                >
                    <Text style={[styles.skipButtonText, { color: theme.tokens.text.tertiary }]}>Not now</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 48,
        paddingBottom: 20,
        alignItems: 'center',
    },
    illustrationContainer: {
        width: 140,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    mainCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    floatingBubble1: {
        position: 'absolute',
        top: 8,
        right: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    floatingBubble2: {
        position: 'absolute',
        bottom: 16,
        left: 8,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 12,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 28,
        paddingHorizontal: 8,
    },
    featuresList: {
        alignSelf: 'stretch',
        gap: 14,
        marginBottom: 24,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    featureDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    featureText: {
        fontSize: 15,
        flex: 1,
    },
    privacyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 8,
    },
    privacyText: {
        fontSize: 14,
        flex: 1,
        lineHeight: 20,
    },
    privacyBold: {
        fontWeight: '600',
    },
    legalLinks: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
    },
    legalText: {
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'center',
    },
    link: {
        textDecorationLine: 'underline',
    },
    buttonContainer: {
        paddingHorizontal: 24,
        paddingBottom: 24,
        gap: 8,
    },
    primaryButton: {
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    skipButton: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    skipButtonText: {
        fontSize: 15,
        fontWeight: '500',
    },
});
