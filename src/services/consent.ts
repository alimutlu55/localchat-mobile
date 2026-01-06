/**
 * Consent Service
 * 
 * Manages user consent state for GDPR/KVKK compliance.
 * Syncs consent with backend for legal evidence and stores locally for offline access.
 */

import { storage, deviceStorage } from './storage';
import { api, ApiResponse } from './api';
import { eventBus } from '../core/events';

const CONSENT_KEY = '@localchat/consent';
const CONSENT_VERSION = '1.0';

export interface ConsentOptions {
    tosAccepted: boolean;
    privacyAccepted: boolean;
    analyticsConsent: boolean;
    locationConsent: boolean;
    personalizedAdsConsent: boolean; // Basic ads are always on, this is for personalization
}

export interface ConsentStatus {
    hasConsent: boolean;
    version: string | null;
    needsReconsent: boolean;
    options: ConsentOptions | null;
    timestamp: string | null;
}

interface StoredConsent {
    version: string;
    options: ConsentOptions;
    timestamp: string;
    syncedToBackend: boolean;
}

interface BackendConsentStatus {
    hasConsent: boolean;
    consentVersion: string | null;
    needsReconsent: boolean;
    tosAccepted: boolean;
    privacyAccepted: boolean;
    analyticsConsent: boolean;
    locationConsent: boolean;
    personalizedAdsConsent: boolean;
}

interface BackendConsentResponse {
    id: string;
    deviceId: string;
    userId: string | null;
    tosAcceptedAt: string;
    privacyAcceptedAt: string;
    marketingConsentAt: string | null;
    analyticsConsentAt: string | null;
    consentVersion: string;
    createdAt: string;
    updatedAt: string;
}

class ConsentService {
    /**
     * Get device ID for consent tracking
     */
    private async getDeviceId(): Promise<string> {
        return deviceStorage.getDeviceId();
    }

    /**
     * Check if user has given consent (local check for fast startup)
     */
    async hasConsent(): Promise<boolean> {
        const consent = await storage.get<StoredConsent>(CONSENT_KEY);
        return consent !== null && consent.version === CONSENT_VERSION;
    }

    /**
     * Check consent status with backend (for re-consent detection)
     * CRITICAL: Local consent must exist. If missing (reinstall), force re-consent.
     */
    async checkConsentStatus(): Promise<ConsentStatus> {
        const localConsent = await storage.get<StoredConsent>(CONSENT_KEY);

        // CRITICAL: If no local consent, this is a reinstall or first launch
        // ALWAYS require consent regardless of backend status
        if (!localConsent) {
            console.log('[Consent] No local consent found - requiring consent (reinstall or first launch)');
            return {
                hasConsent: false,
                version: null,
                needsReconsent: true,
                options: null,
                timestamp: null,
            };
        }

        // Local consent exists, verify with backend for version check
        try {
            const deviceId = await this.getDeviceId();
            const response = await api.get<ApiResponse<BackendConsentStatus>>(
                `/consent/status?deviceId=${deviceId}&requiredVersion=${CONSENT_VERSION}`,
                { skipAuth: true }
            );

            const backendStatus = response.data;

            // Use backend status but ensure local version matches
            const localVersionValid = localConsent.version === CONSENT_VERSION;

            return {
                hasConsent: backendStatus.hasConsent && localVersionValid,
                version: localConsent.version,
                needsReconsent: backendStatus.needsReconsent || !localVersionValid,
                options: localVersionValid ? {
                    tosAccepted: backendStatus.tosAccepted,
                    privacyAccepted: backendStatus.privacyAccepted,
                    analyticsConsent: backendStatus.analyticsConsent,
                    locationConsent: backendStatus.locationConsent,
                    personalizedAdsConsent: backendStatus.personalizedAdsConsent ?? false,
                } : null,
                timestamp: localConsent.timestamp,
            };
        } catch (error) {
            // Fallback to local storage if backend unavailable
            console.warn('[Consent] Backend check failed, using local storage:', error);

            return {
                hasConsent: localConsent.version === CONSENT_VERSION,
                version: localConsent.version,
                needsReconsent: localConsent.version !== CONSENT_VERSION,
                options: localConsent.options,
                timestamp: localConsent.timestamp,
            };
        }
    }

    /**
     * Save consent with "Accept All" option
     */
    async acceptAll(): Promise<void> {
        await this.saveConsent({
            tosAccepted: true,
            privacyAccepted: true,
            analyticsConsent: false,
            locationConsent: false,
            personalizedAdsConsent: false,
        });
    }

    /**
     * Save consent with "Only Essential" option
     */
    async acceptEssential(): Promise<void> {
        await this.saveConsent({
            tosAccepted: true,
            privacyAccepted: true,
            analyticsConsent: false,
            locationConsent: false,
            personalizedAdsConsent: false,
        });
    }

    /**
     * Save consent with custom preferences
     * Syncs to backend for legal evidence
     */
    async saveConsent(options: ConsentOptions): Promise<void> {
        const deviceId = await this.getDeviceId();
        const timestamp = new Date().toISOString();

        // Save locally first (immediate)
        const localConsent: StoredConsent = {
            version: CONSENT_VERSION,
            options,
            timestamp,
            syncedToBackend: false,
        };
        await storage.set(CONSENT_KEY, localConsent);

        // Emit events for listeners (e.g. SessionManager, Map, Ads)
        eventBus.emit('session.consentChanged', {
            hasConsent: true,
            needsReconsent: false,
            version: CONSENT_VERSION
        });

        eventBus.emit('consent.updated', {
            locationConsent: options.locationConsent,
            analyticsConsent: options.analyticsConsent,
            marketingConsent: options.personalizedAdsConsent,
        });

        // Sync to backend (async, don't block UI)
        try {
            await api.post<ApiResponse<BackendConsentResponse>>(
                '/consent',
                {
                    deviceId,
                    tosAccepted: options.tosAccepted,
                    privacyAccepted: options.privacyAccepted,
                    analyticsConsent: options.analyticsConsent,
                    locationConsent: options.locationConsent,
                    personalizedAdsConsent: options.personalizedAdsConsent,
                    consentVersion: CONSENT_VERSION,
                },
                { skipAuth: true }
            );

            // Mark as synced
            localConsent.syncedToBackend = true;
            await storage.set(CONSENT_KEY, localConsent);
            // Successfully synced to backend
        } catch (error) {
            // Log but don't fail - consent is stored locally
            console.error('[Consent] Failed to sync to backend:', error);
        }
    }

    /**
     * Update consent preferences (for Settings screen)
     */
    async updatePreferences(updates: Partial<ConsentOptions>): Promise<void> {
        const { analyticsConsent, locationConsent, personalizedAdsConsent } = updates;
        const localConsent = await storage.get<StoredConsent>(CONSENT_KEY);
        if (!localConsent) {
            throw new Error('No consent record found');
        }

        const updatedOptions: ConsentOptions = {
            ...localConsent.options,
            ...(analyticsConsent !== undefined && { analyticsConsent }),
            ...(locationConsent !== undefined && { locationConsent }),
            ...(personalizedAdsConsent !== undefined && { personalizedAdsConsent }),
        };

        const deviceId = await this.getDeviceId();

        // Update locally
        const updated: StoredConsent = {
            ...localConsent,
            options: updatedOptions,
            timestamp: new Date().toISOString(),
            syncedToBackend: false,
        };
        await storage.set(CONSENT_KEY, updated);

        // Emit events
        eventBus.emit('session.consentChanged', {
            hasConsent: updatedOptions.tosAccepted && updatedOptions.privacyAccepted,
            needsReconsent: false,
            version: CONSENT_VERSION
        });

        eventBus.emit('consent.updated', {
            locationConsent: updatedOptions.locationConsent,
            analyticsConsent: updatedOptions.analyticsConsent,
            marketingConsent: updatedOptions.personalizedAdsConsent,
        });

        // Sync to backend
        try {
            await api.patch<ApiResponse<BackendConsentResponse>>(
                '/consent/preferences',
                {
                    deviceId,
                    analyticsConsent,
                    locationConsent,
                    personalizedAdsConsent,
                },
                { skipAuth: true }
            );

            updated.syncedToBackend = true;
            await storage.set(CONSENT_KEY, updated);
        } catch (error) {
            console.error('[Consent] Failed to sync preference update:', error);
        }
    }

    /**
     * Get current consent status (local)
     */
    async getStatus(): Promise<ConsentStatus> {
        const consent = await storage.get<StoredConsent>(CONSENT_KEY);

        if (!consent) {
            return {
                hasConsent: false,
                version: null,
                needsReconsent: true,
                options: null,
                timestamp: null,
            };
        }

        return {
            hasConsent: consent.version === CONSENT_VERSION,
            version: consent.version,
            needsReconsent: consent.version !== CONSENT_VERSION,
            options: consent.options,
            timestamp: consent.timestamp,
        };
    }

    /**
     * Reset consent (for testing/debugging)
     */
    async reset(): Promise<void> {
        await storage.remove(CONSENT_KEY);
    }

    /**
     * Get current consent version
     */
    getCurrentVersion(): string {
        return CONSENT_VERSION;
    }
}

export const consentService = new ConsentService();
export default consentService;
