/**
 * useSession Hook
 *
 * React hook for accessing session state in components.
 * Provides reactive session state with automatic updates.
 */

import { useState, useEffect, useCallback } from 'react';
import { sessionManager } from './SessionManager';
import { SessionState, SessionStatus, initialSessionState } from './types';
import { eventBus } from '../events';

// =============================================================================
// Hook Return Type
// =============================================================================

export interface UseSessionReturn {
    /** Current session state */
    state: SessionState;

    /** Current session status (convenience accessor) */
    status: SessionStatus;

    /** Whether session is still initializing */
    isInitializing: boolean;

    /** Whether user is authenticated */
    isAuthenticated: boolean;

    /** Whether consent is required */
    needsConsent: boolean;

    /** Whether auth screens should be shown */
    needsAuth: boolean;

    /** Re-initialize session (e.g., after error) */
    reinitialize: () => Promise<void>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook to access session state in React components.
 * Automatically subscribes to session events for reactive updates.
 */
export function useSession(): UseSessionReturn {
    const [state, setState] = useState<SessionState>(
        sessionManager.isInitialized() ? sessionManager.getState() : initialSessionState
    );
    const [isInitializing, setIsInitializing] = useState(!sessionManager.isInitialized());

    // Initialize session on mount if not already initialized
    useEffect(() => {
        if (!sessionManager.isInitialized()) {
            sessionManager.initialize().then(() => {
                setState(sessionManager.getState());
                setIsInitializing(false);
            });
        }
    }, []);

    // Subscribe to session events
    useEffect(() => {
        const handleSessionReady = () => {
            setState(sessionManager.getState());
            setIsInitializing(false);
        };

        const handleAuthChanged = () => {
            setState(sessionManager.getState());
        };

        const handleConsentChanged = () => {
            setState(sessionManager.getState());
        };

        const handleSessionReset = () => {
            setState(sessionManager.getState());
        };

        // Subscribe to events
        eventBus.on('session.ready', handleSessionReady);
        eventBus.on('session.authChanged', handleAuthChanged);
        eventBus.on('session.consentChanged', handleConsentChanged);
        eventBus.on('session.reset', handleSessionReset);

        return () => {
            eventBus.off('session.ready', handleSessionReady);
            eventBus.off('session.authChanged', handleAuthChanged);
            eventBus.off('session.consentChanged', handleConsentChanged);
            eventBus.off('session.reset', handleSessionReset);
        };
    }, []);

    // Re-initialize function
    const reinitialize = useCallback(async () => {
        setIsInitializing(true);
        await sessionManager.initialize();
        setState(sessionManager.getState());
        setIsInitializing(false);
    }, []);

    return {
        state,
        status: state.status,
        isInitializing,
        isAuthenticated: state.status === 'authenticated',
        needsConsent: state.status === 'needsConsent',
        needsAuth: state.status === 'needsAuth',
        reinitialize,
    };
}

export default useSession;
