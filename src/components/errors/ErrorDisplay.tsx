/**
 * Error Display Component
 *
 * Unified error display component that renders appropriate UI based on severity.
 * Used throughout the app for consistent error presentation.
 *
 * @example
 * ```tsx
 * // Toast-style error
 * <ErrorDisplay
 *   severity="medium"
 *   message="Failed to send message"
 *   onRetry={handleRetry}
 * />
 *
 * // Banner-style error
 * <ErrorDisplay
 *   severity="high"
 *   message="Connection lost"
 * />
 * ```
 */

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
} from 'react-native';
import {
    AlertCircle,
    AlertTriangle,
    Info,
    WifiOff,
    RefreshCw,
    X,
} from 'lucide-react-native';
import { theme } from '../../core/theme';
import type { ErrorSeverity } from '../../core/errors/types';

// =============================================================================
// Types
// =============================================================================

export interface ErrorDisplayProps {
    /** Error severity level */
    severity: ErrorSeverity;
    /** Error message to display */
    message: string;
    /** Called when user taps retry */
    onRetry?: () => void;
    /** Called when user dismisses (for non-critical errors) */
    onDismiss?: () => void;
    /** Whether the error is network-related */
    isNetworkError?: boolean;
    /** Additional style */
    style?: object;
}

// =============================================================================
// Component
// =============================================================================

export function ErrorDisplay({
    severity,
    message,
    onRetry,
    onDismiss,
    isNetworkError = false,
    style,
}: ErrorDisplayProps) {
    // Critical errors show a modal
    if (severity === 'critical') {
        return (
            <Modal
                visible
                transparent
                animationType="fade"
                onRequestClose={onDismiss}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <AlertCircle
                            size={48}
                            color={theme.tokens.status.error.main}
                            style={styles.modalIcon}
                        />
                        <Text style={styles.modalTitle}>Error</Text>
                        <Text style={styles.modalMessage}>{message}</Text>
                        <View style={styles.modalActions}>
                            {onRetry && (
                                <TouchableOpacity
                                    style={styles.modalPrimaryButton}
                                    onPress={onRetry}
                                >
                                    <RefreshCw size={18} color={theme.tokens.text.onPrimary} />
                                    <Text style={styles.modalPrimaryText}>Retry</Text>
                                </TouchableOpacity>
                            )}
                            {onDismiss && (
                                <TouchableOpacity
                                    style={styles.modalSecondaryButton}
                                    onPress={onDismiss}
                                >
                                    <Text style={styles.modalSecondaryText}>Dismiss</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        );
    }

    // High severity shows a persistent banner
    if (severity === 'high') {
        return (
            <View style={[styles.banner, style]}>
                {isNetworkError ? (
                    <WifiOff size={18} color={theme.tokens.text.onPrimary} />
                ) : (
                    <AlertTriangle size={18} color={theme.tokens.text.onPrimary} />
                )}
                <Text style={styles.bannerText} numberOfLines={2}>
                    {message}
                </Text>
                {onRetry && (
                    <TouchableOpacity style={styles.bannerButton} onPress={onRetry}>
                        <Text style={styles.bannerButtonText}>Retry</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    // Medium severity shows an inline card
    if (severity === 'medium') {
        return (
            <View style={[styles.card, style]}>
                <View style={styles.cardContent}>
                    <AlertCircle size={20} color={theme.tokens.status.warning.main} />
                    <Text style={styles.cardMessage} numberOfLines={2}>
                        {message}
                    </Text>
                </View>
                <View style={styles.cardActions}>
                    {onRetry && (
                        <TouchableOpacity style={styles.cardButton} onPress={onRetry}>
                            <RefreshCw size={16} color={theme.tokens.brand.primary} />
                            <Text style={styles.cardButtonText}>Retry</Text>
                        </TouchableOpacity>
                    )}
                    {onDismiss && (
                        <TouchableOpacity style={styles.cardDismiss} onPress={onDismiss}>
                            <X size={16} color={theme.tokens.text.tertiary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    }

    // Low severity shows an inline hint
    return (
        <View style={[styles.hint, style]}>
            <Info size={14} color={theme.tokens.text.tertiary} />
            <Text style={styles.hintText}>{message}</Text>
            {onRetry && (
                <TouchableOpacity onPress={onRetry}>
                    <Text style={styles.hintLink}>Retry</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    // Modal (critical)
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
    },
    modalIcon: {
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: theme.tokens.text.primary,
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 14,
        color: theme.tokens.text.secondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    modalActions: {
        width: '100%',
        gap: 12,
    },
    modalPrimaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: theme.tokens.brand.primary,
        paddingVertical: 12,
        borderRadius: 8,
    },
    modalPrimaryText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.tokens.text.onPrimary,
    },
    modalSecondaryButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    modalSecondaryText: {
        fontSize: 14,
        color: theme.tokens.text.secondary,
    },

    // Banner (high)
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: theme.tokens.status.error.main,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    bannerText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: theme.tokens.text.onPrimary,
    },
    bannerButton: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
    },
    bannerButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.tokens.text.onPrimary,
    },

    // Card (medium)
    card: {
        marginHorizontal: 16,
        marginVertical: 8,
        backgroundColor: theme.tokens.status.warning.bg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.tokens.status.warning.main,
        padding: 12,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    cardMessage: {
        flex: 1,
        fontSize: 14,
        color: theme.tokens.text.primary,
        lineHeight: 20,
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 12,
    },
    cardButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: theme.tokens.bg.surface,
        borderRadius: 6,
    },
    cardButtonText: {
        fontSize: 13,
        fontWeight: '500',
        color: theme.tokens.brand.primary,
    },
    cardDismiss: {
        padding: 6,
    },

    // Hint (low)
    hint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    hintText: {
        flex: 1,
        fontSize: 12,
        color: theme.tokens.text.tertiary,
    },
    hintLink: {
        fontSize: 12,
        fontWeight: '500',
        color: theme.tokens.brand.primary,
    },
});

export default ErrorDisplay;
