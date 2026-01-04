/**
 * ReportProblemModal Component
 * 
 * A simple white modal for users to report problems/issues.
 * Matches the design: "Report a Problem" header with X and Submit buttons,
 * and a large text area for the report message.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { deviceStorage } from '../../services/storage';
import { APP_VERSION } from '../../version';

interface ReportProblemModalProps {
    visible: boolean;
    onClose: () => void;
}

export function ReportProblemModal({ visible, onClose }: ReportProblemModalProps) {
    const insets = useSafeAreaInsets();
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
                [{ text: 'OK', onPress: onClose }]
            );
            setMessage('');
        } catch (error) {
            console.error('Failed to submit report:', error);
            Alert.alert('Error', 'Failed to submit your report. Please try again later.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setMessage('');
        onClose();
    };

    const canSubmit = message.trim().length >= 10 && !isSubmitting;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                style={[styles.container, { paddingTop: insets.top }]}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.leftButtonContainer}>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={handleClose}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <X size={24} color="#1f2937" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.title} numberOfLines={1}>Report a Problem</Text>

                    <View style={styles.rightButtonContainer}>
                        <TouchableOpacity
                            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={!canSubmit}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator size="small" color="#1f2937" />
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
                        placeholder="Please report your issue..."
                        placeholderTextColor="#9ca3af"
                        multiline
                        textAlignVertical="top"
                        value={message}
                        onChangeText={setMessage}
                        maxLength={5000}
                        autoFocus
                    />
                </View>

                {/* Footer hint */}
                <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
                    <Text style={styles.footerText}>
                        {message.length}/5000 characters
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        position: 'relative',
    },
    leftButtonContainer: {
        position: 'absolute',
        left: 16,
        zIndex: 10,
    },
    rightButtonContainer: {
        position: 'absolute',
        right: 16,
        zIndex: 10,
    },
    closeButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1f2937',
        textAlign: 'center',
        maxWidth: '60%',
    },
    submitButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    submitTextDisabled: {
        color: '#9ca3af',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: '#1f2937',
        lineHeight: 24,
    },
    footer: {
        paddingHorizontal: 16,
        alignItems: 'flex-end',
    },
    footerText: {
        fontSize: 12,
        color: '#9ca3af',
    },
});

export default ReportProblemModal;
