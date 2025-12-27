/**
 * Context Exports
 * 
 * Note: AuthContext has been migrated to features/auth module.
 * Use `import { useAuth } from '@/features/auth'` instead.
 */

export { SettingsProvider, useSettings } from './SettingsContext';
export { UIProvider, useUI, useUIState, useUIActions } from './UIContext';
export type { AppSettings } from './SettingsContext';
