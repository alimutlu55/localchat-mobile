/**
 * Email Entry Screen
 *
 * First step of OpenAI-style login flow.
 * User enters email, then proceeds to password screen.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MessageCircle, X, User } from 'lucide-react-native';
import { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../features/auth';
import { onboardingService } from '../../services/onboarding';
import { storage } from '../../services/storage';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'EmailEntry'>;

export default function EmailEntryScreen() {
    const navigation = useNavigation<NavigationProp>();
    const { loginAnonymous, isLoading: authLoading } = useAuth();

    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState<string | null>(null);
    const [isAnonymousLoading, setIsAnonymousLoading] = useState(false);

    const isLoading = authLoading || isAnonymousLoading;

    /**
     * Validate email format
     */
    const validateEmail = (emailValue: string): boolean => {
        if (!emailValue.trim()) {
            setEmailError('Please enter your email address');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailValue.trim())) {
            setEmailError('Please enter a valid email address');
            return false;
        }

        setEmailError(null);
        return true;
    };

    /**
     * Handle Continue button - go to password screen
     */
    const handleContinue = () => {
        if (!validateEmail(email)) {
            return;
        }

        // Navigate to password screen with email
        navigation.navigate('Login', { email: email.trim() });
    };

    /**
     * Handle Continue Anonymously
     */
    const handleContinueAnonymously = async () => {
        setIsAnonymousLoading(true);
        try {
            const randomName = `User${Math.floor(Math.random() * 10000)}`;
            await loginAnonymous(randomName);
            await onboardingService.markDeviceOnboarded();
            // Navigation handled by RootNavigator
        } catch (error) {
            console.error('[EmailEntryScreen] Anonymous login failed:', error);
            setIsAnonymousLoading(false);
        }
    };

    /**
     * Handle close button
     */
    const handleClose = () => {
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Header with close button */}
                <View style={styles.header}>
                    <View style={styles.headerPlaceholder} />
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={handleClose}
                    >
                        <X size={24} color="#6b7280" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Logo */}
                    <View style={styles.logoContainer}>
                        <View style={styles.logoCircle}>
                            <MessageCircle size={32} color="#f97316" />
                        </View>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>Log in or sign up</Text>
                    <Text style={styles.subtitle}>
                        Connect with people nearby
                    </Text>

                    {/* Email Input */}
                    <View style={styles.inputWrapper}>
                        <Text style={[
                            styles.floatingLabel,
                            email && styles.floatingLabelActive
                        ]}>
                            Email
                        </Text>
                        <TextInput
                            style={[
                                styles.input,
                                emailError && styles.inputError
                            ]}
                            placeholder=""
                            placeholderTextColor="#9ca3af"
                            value={email}
                            onChangeText={(text) => {
                                setEmail(text);
                                if (emailError) setEmailError(null);
                            }}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            textContentType="emailAddress"
                            returnKeyType="done"
                            onSubmitEditing={handleContinue}
                        />
                    </View>

                    {/* Email Error */}
                    {emailError && (
                        <Text style={styles.errorText}>{emailError}</Text>
                    )}

                    {/* Continue Button */}
                    <TouchableOpacity
                        style={[
                            styles.continueButton,
                            isLoading && styles.continueButtonDisabled
                        ]}
                        onPress={handleContinue}
                        disabled={isLoading}
                        activeOpacity={0.8}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#1f2937" />
                        ) : (
                            <Text style={styles.continueButtonText}>Continue</Text>
                        )}
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Continue Anonymously Button */}
                    <TouchableOpacity
                        style={styles.anonymousButton}
                        onPress={handleContinueAnonymously}
                        disabled={isLoading}
                        activeOpacity={0.8}
                    >
                        <User size={20} color="#374151" />
                        <Text style={styles.anonymousButtonText}>Continue Anonymously</Text>
                    </TouchableOpacity>
                </View>

                {/* Sign up link at bottom */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account?</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                        <Text style={styles.footerLink}>Sign up</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerPlaceholder: {
        width: 44,
        height: 44,
    },
    closeButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 22,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logoCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#fff7ed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1f2937',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 32,
    },
    inputWrapper: {
        position: 'relative',
        marginBottom: 8,
    },
    floatingLabel: {
        position: 'absolute',
        left: 16,
        top: 18,
        fontSize: 16,
        color: '#9ca3af',
        zIndex: 1,
    },
    floatingLabelActive: {
        top: 8,
        fontSize: 12,
        color: '#6b7280',
    },
    input: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingHorizontal: 16,
        paddingTop: 24,
        paddingBottom: 12,
        fontSize: 16,
        color: '#1f2937',
    },
    inputError: {
        borderColor: '#ef4444',
    },
    errorText: {
        fontSize: 13,
        color: '#ef4444',
        marginBottom: 16,
        marginLeft: 4,
    },
    continueButton: {
        backgroundColor: '#f3f4f6',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    continueButtonDisabled: {
        opacity: 0.6,
    },
    continueButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e5e7eb',
    },
    dividerText: {
        paddingHorizontal: 16,
        fontSize: 13,
        color: '#9ca3af',
        fontWeight: '500',
    },
    anonymousButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 10,
    },
    anonymousButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 24,
        gap: 4,
    },
    footerText: {
        fontSize: 14,
        color: '#6b7280',
    },
    footerLink: {
        fontSize: 14,
        fontWeight: '600',
        color: '#f97316',
    },
});
