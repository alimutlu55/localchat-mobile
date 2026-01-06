/**
 * SessionManager
 *
 * Standalone component for unified session management.
 * Coordinates authentication status and consent status atomically.
 *
 * Design Principles:
 * - Single source of truth for session state
 * - Backend-first validation (no trusting stale local state)
 * - Atomic initialization (consent + auth checked together)
 * - Clear boundaries with explicit interfaces
 *
 * Architecture:
 * - Uses deviceStorage for consistent device ID
 * - Validates tokens with backend before trusting
 * - Falls back gracefully on network errors
 * - Emits events for cross-module communication
 */

import { deviceStorage, secureStorage } from '../../services/storage';
import { consentService } from '../../services/consent';
import { authService } from '../../services/auth';
import { eventBus } from '../events';
import { createLogger } from '../../shared/utils/logger';
import { STORAGE_KEYS } from '../../constants';
import { SessionState, SessionStatus, SessionInitResult, initialSessionState } from './types';

const log = createLogger('SessionManager');

// =============================================================================
// Session Manager Class
// =============================================================================

class SessionManagerImpl {
    private state: SessionState = { ...initialSessionState };
    private initialized: boolean = false;
    private initPromise: Promise<SessionInitResult> | null = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
        // Subscribe to auth events to keep internal state in sync
        // Note: We use emit=false to prevent feedback loops since these events 
        // usually originate from the stores themselves.
        this.unsubscribers.push(
            eventBus.on('session.authChanged', (payload) => {
                this.onAuthStateChange(payload.isAuthenticated, payload.user, false);
            })
        );

        this.unsubscribers.push(
            eventBus.on('session.consentChanged', (payload) => {
                this.onConsentChange(payload.hasConsent, payload.needsReconsent, payload.version, false);
            })
        );
    }

    /**
     * Initialize session state.
     * Validates existing session with backend or determines fresh state.
     * This is idempotent - multiple calls return the same promise.
     */
    async initialize(): Promise<SessionInitResult> {
        // Return existing promise if already initializing
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.doInitialize();
        return this.initPromise;
    }

    /**
     * Internal initialization logic.
     */
    private async doInitialize(): Promise<SessionInitResult> {
        log.debug('Starting session initialization...');
        const startTime = Date.now();

        try {
            // 1. Get device ID (single source of truth)
            const deviceId = await deviceStorage.getDeviceId();
            this.updateState({ deviceId, status: 'loading' });
            log.debug('Device ID obtained', { deviceId: deviceId.substring(0, 8) + '...' });

            // 2. Check for existing auth token
            const token = await secureStorage.get(STORAGE_KEYS.AUTH_TOKEN);
            let user = null;
            let wasRestored = false;

            if (token) {
                log.debug('Found existing token, validating with backend...');
                try {
                    // Validate session with backend
                    user = await authService.getCurrentUser();
                    wasRestored = true;
                    log.debug('Session restored from token', { userId: user.id });
                } catch (error) {
                    log.debug('Token validation failed, trying refresh...');
                    // Token invalid, try refresh
                    const refreshed = await authService.refreshToken();
                    if (refreshed) {
                        try {
                            user = await authService.getCurrentUser();
                            wasRestored = true;
                            log.debug('Session restored after token refresh', { userId: user.id });
                        } catch (refreshError) {
                            log.warn('Failed to get user after refresh', { error: refreshError });
                        }
                    }
                }
            }

            // 3. Check consent status from backend
            log.debug('Checking consent status...');
            const consentStatus = await consentService.checkConsentStatus();
            const consent = {
                hasConsent: consentStatus.hasConsent,
                needsReconsent: consentStatus.needsReconsent,
                version: consentStatus.version,
            };
            log.debug('Consent status obtained', { hasConsent: consent.hasConsent, needsReconsent: consent.needsReconsent });

            // 4. Determine final session status
            let status: SessionStatus;
            if (!consent.hasConsent || consent.needsReconsent) {
                status = 'needsConsent';
            } else if (!user) {
                status = 'needsAuth';
            } else {
                status = 'authenticated';
            }

            // 5. Update state atomically
            this.updateState({
                status,
                deviceId,
                user,
                consent,
                error: null,
            });

            this.initialized = true;
            const elapsed = Date.now() - startTime;
            log.info('Session initialization complete', { status, elapsed: `${elapsed}ms` });

            // 6. Emit session ready event
            eventBus.emit('session.ready', { state: this.state });

            return {
                state: this.state,
                isNewSession: !wasRestored && !user,
                wasRestored,
            };
        } catch (error) {
            log.error('Session initialization failed', { error });

            // On error, fall back to safe defaults
            const deviceId = await deviceStorage.getDeviceId().catch(() => null);
            this.updateState({
                status: 'sessionError',
                deviceId,
                user: null,
                consent: { hasConsent: false, needsReconsent: true, version: null },
                error: error instanceof Error ? error.message : 'Session initialization failed',
            });

            this.initialized = true;
            return {
                state: this.state,
                isNewSession: true,
                wasRestored: false,
            };
        }
    }

    /**
     * Get current session state synchronously.
     * Returns initial state if not yet initialized.
     */
    getState(): SessionState {
        return { ...this.state };
    }

    /**
     * Check if session manager has been initialized.
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Update session status after auth state change.
     * Called by AuthStore when login/logout occurs.
     */
    onAuthStateChange(isAuthenticated: boolean, user: typeof this.state.user, emit: boolean = true): void {
        if (!this.initialized) return;

        const newStatus: SessionStatus = isAuthenticated ? 'authenticated' : 'needsAuth';

        this.updateState({
            status: newStatus,
            user,
        });

        log.debug('Auth state changed', { status: newStatus, userId: user?.id });

        if (emit) {
            eventBus.emit('session.authChanged', { isAuthenticated, user });
        }
    }

    /**
     * Update session status after consent change.
     * Called by ConsentService when consent is given/revoked.
     */
    onConsentChange(hasConsent: boolean, needsReconsent: boolean, version: string | null, emit: boolean = true): void {
        if (!this.initialized) return;

        this.updateState({
            consent: { hasConsent, needsReconsent, version },
            // Recalculate status based on new consent
            status: (!hasConsent || needsReconsent) ? 'needsConsent' :
                this.state.user ? 'authenticated' : 'needsAuth',
        });

        log.debug('Consent state changed', { hasConsent, needsReconsent });

        if (emit) {
            eventBus.emit('session.consentChanged', { hasConsent, needsReconsent, version });
        }
    }

    /**
     * Reset session state (e.g., on logout).
     */
    async reset(): Promise<void> {
        log.debug('Resetting session state...');

        this.state = {
            ...initialSessionState,
            deviceId: this.state.deviceId, // Preserve device ID
            status: 'needsAuth',
            consent: this.state.consent, // Preserve consent (it's device-based)
        };

        eventBus.emit('session.reset', { state: this.state });
    }

    /**
     * Update state with partial updates.
     */
    private updateState(updates: Partial<SessionState>): void {
        this.state = {
            ...this.state,
            ...updates,
            consent: updates.consent ? { ...this.state.consent, ...updates.consent } : this.state.consent,
        };
    }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Singleton SessionManager instance.
 * Use this throughout the app for consistent session state.
 */
export const sessionManager = new SessionManagerImpl();

export default sessionManager;
