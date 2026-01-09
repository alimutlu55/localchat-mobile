/**
 * ConsentService Unit Tests
 */

import { consentService } from '../consent';
import { api } from '../api';
import { storage } from '../storage';
import { eventBus } from '../../core/events/EventBus';

// Mock dependencies
jest.mock('../api', () => ({
    api: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

jest.mock('../storage', () => ({
    storage: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
    },
    deviceStorage: {
        getDeviceId: jest.fn(() => Promise.resolve('test-device-id')),
    },
}));

jest.mock('../../core/events/EventBus', () => ({
    eventBus: {
        emit: jest.fn(),
    },
}));

describe('ConsentService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (storage.get as jest.Mock).mockImplementation((key) => {
            return Promise.resolve(null);
        });
    });

    describe('acceptAll', () => {
        it('sets ageVerified to true and syncs with backend', async () => {
            (api.post as jest.Mock).mockResolvedValue({ data: { success: true } });

            await consentService.acceptAll();

            expect(storage.set).toHaveBeenCalledWith(
                '@localchat/consent',
                expect.objectContaining({
                    options: expect.objectContaining({
                        ageVerified: true,
                        tosAccepted: true,
                        privacyAccepted: true,
                        analyticsConsent: true,
                        locationConsent: true,
                        personalizedAdsConsent: true,
                    }),
                })
            );

            expect(api.post).toHaveBeenCalledWith(
                '/consent',
                expect.objectContaining({
                    ageVerified: true,
                    tosAccepted: true,
                }),
                expect.any(Object)
            );
        });
    });

    describe('acceptEssentialOnly', () => {
        it('sets ageVerified to true but optional items to false', async () => {
            (api.post as jest.Mock).mockResolvedValue({ data: { success: true } });

            await consentService.acceptEssentialOnly();

            expect(storage.set).toHaveBeenCalledWith(
                '@localchat/consent',
                expect.objectContaining({
                    options: expect.objectContaining({
                        ageVerified: true,
                        analyticsConsent: false,
                        locationConsent: false,
                    }),
                })
            );

            expect(api.post).toHaveBeenCalledWith(
                '/consent',
                expect.objectContaining({
                    ageVerified: true,
                    analyticsConsent: false,
                }),
                expect.any(Object)
            );
        });
    });

    describe('updatePreferences', () => {
        it('should preserve ageVerified while updating other tools', async () => {
            const existingConsent = {
                version: '1.1',
                options: {
                    tosAccepted: true,
                    privacyAccepted: true,
                    ageVerified: true,
                    analyticsConsent: false,
                    locationConsent: false,
                    personalizedAdsConsent: false,
                },
                timestamp: new Date().toISOString(),
            };

            (storage.get as jest.Mock).mockImplementation((key) => {
                if (key === 'device_id') return Promise.resolve('test-device-id');
                if (key === '@localchat/consent') return Promise.resolve(existingConsent);
                return Promise.resolve(null);
            });

            await consentService.updatePreferences({ analyticsConsent: true });

            expect(storage.set).toHaveBeenCalledWith(
                '@localchat/consent',
                expect.objectContaining({
                    options: expect.objectContaining({
                        ageVerified: true, // MUST preserved
                        analyticsConsent: true,
                    }),
                })
            );
        });
    });
});
