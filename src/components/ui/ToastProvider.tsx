/**
 * Toast Context & Provider
 *
 * Provides global toast notification functionality via React Context.
 * Manages toast queue, stacking, and auto-dismissal.
 *
 * @example
 * ```tsx
 * // In App.tsx
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 *
 * // In any component
 * const { toast } = useToast();
 * toast.error('Something went wrong', { action: { label: 'Retry', onPress: retry } });
 * ```
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast, ToastType, ToastAction } from './Toast';

// =============================================================================
// Types
// =============================================================================

export interface ToastOptions {
    duration?: number;
    action?: ToastAction;
}

interface ToastItem {
    id: string;
    type: ToastType;
    message: string;
    duration: number;
    action?: ToastAction;
}

interface ToastContextValue {
    toast: {
        success: (message: string, options?: ToastOptions) => void;
        error: (message: string, options?: ToastOptions) => void;
        warning: (message: string, options?: ToastOptions) => void;
        info: (message: string, options?: ToastOptions) => void;
        show: (type: ToastType, message: string, options?: ToastOptions) => void;
    };
    dismiss: (id: string) => void;
    dismissAll: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_VISIBLE_TOASTS = 3;
const DEFAULT_DURATION = 4000;

// =============================================================================
// Context
// =============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const idCounter = useRef(0);
    const insets = useSafeAreaInsets();

    const generateId = useCallback(() => {
        idCounter.current += 1;
        return `toast-${idCounter.current}-${Date.now()}`;
    }, []);

    const show = useCallback(
        (type: ToastType, message: string, options?: ToastOptions) => {
            const id = generateId();
            const newToast: ToastItem = {
                id,
                type,
                message,
                duration: options?.duration ?? DEFAULT_DURATION,
                action: options?.action,
            };

            setToasts((prev) => {
                // Limit visible toasts
                const updated = [...prev, newToast];
                if (updated.length > MAX_VISIBLE_TOASTS) {
                    return updated.slice(-MAX_VISIBLE_TOASTS);
                }
                return updated;
            });
        },
        [generateId]
    );

    // Register toast function for safeAsync utility (allows non-component code to show toasts)
    React.useEffect(() => {
        // Lazy import to avoid circular dependencies
        import('../../shared/utils/safeAsync').then(({ registerToastFunction, unregisterToastFunction }) => {
            registerToastFunction(show);
            return () => unregisterToastFunction();
        });
    }, [show]);

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const dismissAll = useCallback(() => {
        setToasts([]);
    }, []);

    const toast = {
        success: (message: string, options?: ToastOptions) =>
            show('success', message, options),
        error: (message: string, options?: ToastOptions) =>
            show('error', message, options),
        warning: (message: string, options?: ToastOptions) =>
            show('warning', message, options),
        info: (message: string, options?: ToastOptions) =>
            show('info', message, options),
        show,
    };

    const value: ToastContextValue = {
        toast,
        dismiss,
        dismissAll,
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Toast container - positioned at top of screen */}
            <View
                style={[styles.container, { top: insets.top + 8 }]}
                pointerEvents="box-none"
            >
                {toasts.map((item) => (
                    <Toast
                        key={item.id}
                        id={item.id}
                        type={item.type}
                        message={item.message}
                        duration={item.duration}
                        action={item.action}
                        onDismiss={dismiss}
                    />
                ))}
            </View>
        </ToastContext.Provider>
    );
}

// =============================================================================
// Hook
// =============================================================================

export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }

    return context;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 9999,
    },
});

export default ToastProvider;
