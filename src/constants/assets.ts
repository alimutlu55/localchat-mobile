/**
 * Centralized Asset Registry
 *
 * This file serves as the single source of truth for all graphic assets
 * used throughout the application.
 */

export const ASSETS = {
    IDENTITIES: {
        APP_ICON: require('../../assets/icon.png'),
        SPLASH: require('../../assets/splash.png'),
        SPLASH_ICON: require('../../assets/splash-icon.png'),
        FAVICON: require('../../assets/favicon.png'),
        NOTIFICATION: require('../../assets/notification-icon.png'),
    },
    ROOM_PINS: {
        GENERAL: require('../../assets/room-pin-general.png'),
        FOOD: require('../../assets/room-pin-food.png'),
        SPIRIT: require('../../assets/room-pin-spirit.png'),
        PULSE: require('../../assets/room-pin-pulse.png'),
        PLAY: require('../../assets/room-pin-play.png'),
        FLOW: require('../../assets/room-pin-flow.png'),
    },
} as const;

export type AssetKey = keyof typeof ASSETS;
