/**
 * Error Boundary Component
 *
 * React Error Boundary for catching and handling JavaScript errors in the component tree.
 * Supports multiple levels (app, screen, feature) with appropriate fallback UI.
 *
 * @example
 * ```tsx
 * // Screen-level boundary
 * <ErrorBoundary level="screen" onReset={() => navigation.goBack()}>
 *   <ChatRoomScreen />
 * </ErrorBoundary>
 *
 * // Feature-level boundary with custom fallback
 * <ErrorBoundary
 *   level="feature"
 *   fallback={(error, reset) => (
 *     <ErrorCard message={error.message} onRetry={reset} />
 *   )}
 * >
 *   <MessageList />
 * </ErrorBoundary>
 * ```
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
} from 'react-native';
import { AlertTriangle, RefreshCw, ArrowLeft, Home } from 'lucide-react-native';
import { theme } from '../../core/theme';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('ErrorBoundary');

// =============================================================================
// Types
// =============================================================================

export type ErrorBoundaryLevel = 'app' | 'screen' | 'feature';

export interface ErrorBoundaryProps {
    children: ReactNode;
    /** Error boundary level determines fallback UI style */
    level?: ErrorBoundaryLevel;
    /** Custom fallback renderer */
    fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
    /** Called when an error is caught */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    /** Called when user tries to recover */
    onReset?: () => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

// =============================================================================
// Error Boundary Component
// =============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    static defaultProps = {
        level: 'feature' as ErrorBoundaryLevel,
    };

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        log.error('Error caught by boundary', {
            level: this.props.level,
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        });

        this.props.onError?.(error, errorInfo);
    }

    reset = (): void => {
        this.setState({ hasError: false, error: null });
        this.props.onReset?.();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            const { fallback, level = 'feature' } = this.props;
            const error = this.state.error!;

            // Custom fallback
            if (fallback) {
                if (typeof fallback === 'function') {
                    return fallback(error, this.reset);
                }
                return fallback;
            }

            // Default fallback based on level
            switch (level) {
                case 'app':
                    return <AppLevelFallback error={error} onReset={this.reset} />;
                case 'screen':
                    return <ScreenLevelFallback error={error} onReset={this.reset} />;
                case 'feature':
                default:
                    return <FeatureLevelFallback error={error} onReset={this.reset} />;
            }
        }

        return this.props.children;
    }
}

// =============================================================================
// Fallback Components
// =============================================================================

interface FallbackProps {
    error: Error;
    onReset: () => void;
}

/**
 * App-level fallback - full screen error
 */
function AppLevelFallback({ error, onReset }: FallbackProps) {
    return (
        <SafeAreaView style={styles.appContainer}>
            <View style={styles.appContent}>
                <AlertTriangle
                    size={64}
                    color={theme.tokens.status.error.main}
                    style={styles.icon}
                />
                <Text style={styles.appTitle}>Something went wrong</Text>
                <Text style={styles.appMessage}>
                    We're sorry, but something unexpected happened. Please restart the app.
                </Text>
                {__DEV__ && (
                    <View style={styles.debugContainer}>
                        <Text style={styles.debugTitle}>Debug Info:</Text>
                        <Text style={styles.debugText}>{error.message}</Text>
                    </View>
                )}
                <TouchableOpacity style={styles.appButton} onPress={onReset}>
                    <RefreshCw size={20} color={theme.tokens.text.onPrimary} />
                    <Text style={styles.appButtonText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

/**
 * Screen-level fallback - takes up screen space
 */
function ScreenLevelFallback({ error, onReset }: FallbackProps) {
    return (
        <View style={styles.screenContainer}>
            <AlertTriangle
                size={48}
                color={theme.tokens.status.error.main}
                style={styles.icon}
            />
            <Text style={styles.screenTitle}>This screen encountered an error</Text>
            <Text style={styles.screenMessage}>
                {error.message || 'An unexpected error occurred'}
            </Text>
            <View style={styles.screenActions}>
                <TouchableOpacity style={styles.screenButton} onPress={onReset}>
                    <RefreshCw size={18} color={theme.tokens.brand.primary} />
                    <Text style={styles.screenButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

/**
 * Feature-level fallback - inline error card
 */
function FeatureLevelFallback({ error, onReset }: FallbackProps) {
    return (
        <View style={styles.featureContainer}>
            <View style={styles.featureContent}>
                <AlertTriangle
                    size={24}
                    color={theme.tokens.status.error.main}
                />
                <Text style={styles.featureMessage} numberOfLines={2}>
                    {error.message || 'Something went wrong'}
                </Text>
            </View>
            <TouchableOpacity style={styles.featureButton} onPress={onReset}>
                <RefreshCw size={16} color={theme.tokens.brand.primary} />
            </TouchableOpacity>
        </View>
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    // App-level styles
    appContainer: {
        flex: 1,
        backgroundColor: theme.tokens.bg.canvas,
    },
    appContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    icon: {
        marginBottom: 24,
    },
    appTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: theme.tokens.text.primary,
        textAlign: 'center',
        marginBottom: 12,
    },
    appMessage: {
        fontSize: 16,
        color: theme.tokens.text.secondary,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    debugContainer: {
        backgroundColor: theme.tokens.bg.subtle,
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
        width: '100%',
    },
    debugTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.tokens.text.tertiary,
        marginBottom: 8,
    },
    debugText: {
        fontSize: 12,
        fontFamily: 'monospace',
        color: theme.tokens.status.error.main,
    },
    appButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: theme.tokens.brand.primary,
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 12,
    },
    appButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.tokens.text.onPrimary,
    },

    // Screen-level styles
    screenContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: theme.tokens.bg.canvas,
    },
    screenTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: theme.tokens.text.primary,
        textAlign: 'center',
        marginBottom: 8,
    },
    screenMessage: {
        fontSize: 14,
        color: theme.tokens.text.secondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    screenActions: {
        flexDirection: 'row',
        gap: 12,
    },
    screenButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: theme.tokens.bg.subtle,
    },
    screenButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.tokens.brand.primary,
    },

    // Feature-level styles
    featureContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        marginHorizontal: 16,
        marginVertical: 8,
        backgroundColor: theme.tokens.status.error.bg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.tokens.status.error.main,
    },
    featureContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    featureMessage: {
        flex: 1,
        fontSize: 14,
        color: theme.tokens.status.error.main,
    },
    featureButton: {
        padding: 8,
    },
});

export default ErrorBoundary;
