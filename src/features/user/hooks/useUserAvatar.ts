/**
 * useUserAvatar Hook
 *
 * Provides user avatar with loading state management.
 * Integrates with UserStore for caching and preloading.
 *
 * @example
 * ```tsx
 * const { avatarUrl, displayName, isLoaded, onLoad, onError } = useUserAvatar();
 * 
 * <AvatarDisplay 
 *   avatarUrl={avatarUrl}
 *   displayName={displayName}
 * />
 * ```
 */

import { useCallback } from 'react';
import { useUserStore, useAvatarUrl, useDisplayName } from '../store';

export interface UseUserAvatarReturn {
  /** Current user's avatar URL */
  avatarUrl: string | null;
  /** Current user's display name (for fallback) */
  displayName: string;
  /** Whether the avatar is confirmed loaded */
  isLoaded: boolean;
  /** Call when avatar loads successfully */
  onLoad: () => void;
  /** Call when avatar fails to load */
  onError: () => void;
}

/**
 * Hook for current user's avatar with loading state
 */
export function useUserAvatar(): UseUserAvatarReturn {
  const avatarUrl = useAvatarUrl();
  const displayName = useDisplayName() || 'User';
  
  const setAvatarLoaded = useUserStore((s) => s.setAvatarLoaded);
  const setAvatarError = useUserStore((s) => s.setAvatarError);
  const isAvatarLoaded = useUserStore((s) => s.isAvatarLoaded);

  const isLoaded = avatarUrl ? isAvatarLoaded(avatarUrl) : false;

  const onLoad = useCallback(() => {
    if (avatarUrl) {
      setAvatarLoaded(avatarUrl);
    }
  }, [avatarUrl, setAvatarLoaded]);

  const onError = useCallback(() => {
    if (avatarUrl) {
      setAvatarError(avatarUrl);
    }
  }, [avatarUrl, setAvatarError]);

  return {
    avatarUrl,
    displayName,
    isLoaded,
    onLoad,
    onError,
  };
}

/**
 * Hook for any user's avatar (not just current user)
 */
export function useAvatarLoading(url: string | null | undefined): {
  isLoaded: boolean;
  onLoad: () => void;
  onError: () => void;
} {
  const setAvatarLoaded = useUserStore((s) => s.setAvatarLoaded);
  const setAvatarError = useUserStore((s) => s.setAvatarError);
  const isAvatarLoaded = useUserStore((s) => s.isAvatarLoaded);

  const isLoaded = url ? isAvatarLoaded(url) : false;

  const onLoad = useCallback(() => {
    if (url) {
      setAvatarLoaded(url);
    }
  }, [url, setAvatarLoaded]);

  const onError = useCallback(() => {
    if (url) {
      setAvatarError(url);
    }
  }, [url, setAvatarError]);

  return { isLoaded, onLoad, onError };
}

export default useUserAvatar;
