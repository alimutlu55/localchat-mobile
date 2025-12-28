/**
 * Onboarding Service
 *
 * Manages the onboarding flow state for first-time users.
 */

import { storage } from './storage';

const ONBOARDING_COMPLETE_KEY = '@localchat/onboarding_complete';
const ONBOARDING_VERSION_KEY = '@localchat/onboarding_version';
const DEVICE_ONBOARDED_KEY = '@localchat/device_onboarded';
const CURRENT_ONBOARDING_VERSION = 1;

export interface OnboardingStatus {
  isComplete: boolean;
  completedVersion: number | null;
  isCurrentVersion: boolean;
}

/**
 * Onboarding Service class
 */
class OnboardingService {
  /**
   * Get onboarding status
   */
  async getStatus(): Promise<OnboardingStatus> {
    const isComplete = await storage.get<boolean>(ONBOARDING_COMPLETE_KEY);
    const completedVersion = await storage.get<number>(ONBOARDING_VERSION_KEY);
    const isCurrentVersion = completedVersion === CURRENT_ONBOARDING_VERSION;

    return {
      isComplete: isComplete === true,
      completedVersion,
      isCurrentVersion,
    };
  }

  /**
   * Check if user needs onboarding
   */
  async needsOnboarding(): Promise<boolean> {
    const status = await this.getStatus();

    if (!status.isComplete) {
      return true;
    }

    if (!status.isCurrentVersion) {
      return true;
    }

    return false;
  }

  /**
   * Mark onboarding as complete
   * Also marks the device as permanently onboarded
   */
  async markComplete(): Promise<void> {
    await storage.set(ONBOARDING_COMPLETE_KEY, true);
    await storage.set(ONBOARDING_VERSION_KEY, CURRENT_ONBOARDING_VERSION);
    await this.markDeviceOnboarded();
  }

  /**
   * Reset onboarding status (for current session only)
   * Note: Does NOT reset device onboarding status
   */
  async reset(): Promise<void> {
    await storage.remove(ONBOARDING_COMPLETE_KEY);
    await storage.remove(ONBOARDING_VERSION_KEY);
  }

  /**
   * Get current onboarding version
   */
  getCurrentVersion(): number {
    return CURRENT_ONBOARDING_VERSION;
  }

  /**
   * Check if this device has ever completed onboarding
   * This persists even after logout, allowing returning anonymous users
   * to skip the full onboarding flow
   */
  async isDeviceOnboarded(): Promise<boolean> {
    const deviceOnboarded = await storage.get<boolean>(DEVICE_ONBOARDED_KEY);
    return deviceOnboarded === true;
  }

  /**
   * Mark this device as permanently onboarded
   * This should be called when a user completes onboarding for the first time
   * It persists across logouts and anonymous sessions
   */
  async markDeviceOnboarded(): Promise<void> {
    await storage.set(DEVICE_ONBOARDED_KEY, true);
  }

  /**
   * Reset device onboarding status (for testing/debugging)
   * This will force the user to go through onboarding again
   */
  async resetDeviceOnboarding(): Promise<void> {
    await storage.remove(DEVICE_ONBOARDED_KEY);
  }
}

export const onboardingService = new OnboardingService();
export default onboardingService;

