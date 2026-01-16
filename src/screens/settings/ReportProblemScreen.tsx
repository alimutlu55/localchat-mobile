/**
 * Report Problem Screen
 * 
 * A fullScreenModal screen for users to report problems/issues.
 * Matches the design: "Report a Problem" header with back and Submit buttons,
 * and a large text area for the report message.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { theme } from '../../core/theme';
import { api } from '../../services/api';
import { deviceStorage } from '../../services/storage';
import { APP_VERSION } from '../../version';

export default function ReportProblemScreen() {
    const navigation = useNavigation();
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (message.trim().length < 10) {
            Alert.alert('Error', 'Please describe your issue in at least 10 characters.');
            return;
        }

        setIsSubmitting(true);

        try {
            const deviceId = await deviceStorage.getDeviceId();
            const appVersion = APP_VERSION;
            const devicePlatform = Platform.OS;

            await api.post('/problem-reports', {
                deviceId: deviceId,
                message: message.trim(),
                appVersion,
                devicePlatform,
            }, { skipAuth: true });

            Alert.alert(
                'Thank You!',
                'Your report has been submitted. We appreciate your feedback!',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
            setMessage('');
        } catch (error) {
            console.error('Failed to submit report:', error);
            Alert.alert('Error', 'Failed to submit your report. Please try again later.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const canSubmit = message.trim().length >= 10 && !isSubmitting;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Header with centered title */}
                <View style={styles.header}>
                    {/* Back button - left side */}
                    <View style={styles.headerLeft}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <ArrowLeft size={24} color={theme.tokens.text.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Title - centered absolutely */}
                    <View style={styles.headerCenter}>
                        <Text style={styles.title}>Report a Problem</Text>
                    </View>

                    {/* Submit button - right side */}
                    <View style={styles.headerRight}>
                        <TouchableOpacity
                            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={!canSubmit}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator size="small" color={theme.tokens.text.primary} />
                            ) : (
                                <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>
                                    Submit
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Please describe your issue..."
                        placeholderTextColor={theme.tokens.text.tertiary}
                        multiline
                        textAlignVertical="top"
                        value={message}
                        onChangeText={setMessage}
                        maxLength={5000}
                        autoFocus
                    />
                </View>

                {/* Footer with character count */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        {message.length}/5000 characters
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

export { ReportProblemScreen };

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.tokens.bg.canvas,
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.tokens.border.subtle,
        position: 'relative',
    },
    headerLeft: {
        position: 'absolute',
        left: 16,
        zIndex: 10,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerRight: {
        position: 'absolute',
        right: 16,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.tokens.text.primary,
        textAlign: 'center',
    },
    submitButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: theme.tokens.bg.subtle,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitText: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.tokens.text.primary,
    },
    submitTextDisabled: {
        color: theme.tokens.text.tertiary,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: theme.tokens.text.primary,
        lineHeight: 24,
    },
    footer: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        paddingTop: 8,
        backgroundColor: theme.tokens.bg.canvas,
        borderTopWidth: 1,
        borderTopColor: theme.tokens.border.subtle,
    },
    footerText: {
        fontSize: 13,
        fontWeight: '500',
        color: theme.tokens.text.secondary,
        textAlign: 'right',
    },
});
