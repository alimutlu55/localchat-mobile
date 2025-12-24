/**
 * UUID Utility
 * 
 * Provides functions for generating UUIDs.
 */

/**
 * Generates a RFC4122 v4 compliant UUID.
 * 
 * Uses crypto.randomUUID() if available, otherwise falls back to a 
 * Math.random()-based implementation.
 * 
 * @returns A string representing a UUID v4
 */
export const generateUUID = (): string => {
    // Check if crypto.randomUUID is available (standard in modern browsers and some RN environments)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback implementation for environments without crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};
