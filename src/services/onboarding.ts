/**
 * Onboarding Service
 *
 * Manages the onboarding flow state for first-time users.
 */

import { storage } from './storage';

const ONBOARDING_COMPLETE_KEY = '@localchat/onboarding_complete';
const ONBOARDING_VERSION_KEY = '@localchat/onboarding_version';
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
   */
  async markComplete(): Promise<void> {
    await storage.set(ONBOARDING_COMPLETE_KEY, true);
    await storage.set(ONBOARDING_VERSION_KEY, CURRENT_ONBOARDING_VERSION);
  }

  /**
   * Reset onboarding status
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
}

export const onboardingService = new OnboardingService();
export default onboardingService;

