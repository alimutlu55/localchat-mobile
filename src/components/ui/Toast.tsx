/**
 * Toast Component
 *
 * A non-blocking notification component for transient feedback.
 * Supports success, error, warning, and info variants with optional action button.
 *
 * @example
 * ```tsx
 * <Toast
 *   type="error"
 *   message="Failed to send message"
 *   action={{ label: 'Retry', onPress: handleRetry }}
 *   onDismiss={() => {}}
 * />
 * ```
 */

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    AccessibilityInfo,
} from 'react-native';
import {
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    Info,
    X,
} from 'lucide-react-native';
import { theme } from '../../core/theme';

// =============================================================================
// Types
// =============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
    label: string;
    onPress: () => void;
}

export interface ToastProps {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
    action?: ToastAction;
    onDismiss: (id: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_DURATION = 4000;
const ANIMATION_DURATION = 300;

const ICON_MAP = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

// =============================================================================
// Component
// =============================================================================

export function Toast({
    id,
    type,
    message,
    duration = DEFAULT_DURATION,
    action,
    onDismiss,
}: ToastProps) {
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Get icon and colors based on type
    const Icon = ICON_MAP[type];
    const statusColors = theme.tokens.status[type];

    useEffect(() => {
        // Announce to screen readers
        AccessibilityInfo.announceForAccessibility(message);

        // Slide in
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: ANIMATION_DURATION,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: ANIMATION_DURATION,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto-dismiss after duration (0 means no auto-dismiss)
        if (duration > 0) {
            timeoutRef.current = setTimeout(() => {
                dismiss();
            }, duration);
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const dismiss = () => {
        // Clear any pending timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Animate out
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: ANIMATION_DURATION,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: ANIMATION_DURATION,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss(id);
        });
    };

    const handleAction = () => {
        action?.onPress();
        dismiss();
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: statusColors.bg,
                    borderLeftColor: statusColors.main,
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                },
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
        >
            <View style={styles.content}>
                <Icon
                    size={20}
                    color={statusColors.main}
                    style={styles.icon}
                />
                <Text
                    style={[styles.message, { color: theme.tokens.text.primary }]}
                    numberOfLines={2}
                >
                    {message}
                </Text>
            </View>

            <View style={styles.actions}>
                {action && (
                    <TouchableOpacity
                        onPress={handleAction}
                        style={styles.actionButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={[styles.actionText, { color: statusColors.main }]}>
                            {action.label}
                        </Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={dismiss}
                    style={styles.closeButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Dismiss notification"
                >
                    <X size={18} color={theme.tokens.text.secondary} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 16,
        marginVertical: 4,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        marginRight: 12,
    },
    message: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
        gap: 8,
    },
    actionButton: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    actionText: {
        fontSize: 14,
        fontWeight: '600',
    },
    closeButton: {
        padding: 4,
    },
});

export default Toast;
