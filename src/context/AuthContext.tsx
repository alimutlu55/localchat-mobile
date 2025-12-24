/**
 * Auth Context
 *
 * Provides authentication state and actions throughout the app.
 * Handles login, logout, and user state management.
 *
 * @example
 * ```typescript
 * const { user, login, logout, isAuthenticated } = useAuth();
 *
 * // Login
 * await login('email@example.com', 'password');
 *
 * // Check auth state
 * if (isAuthenticated) {
 *   console.log('Welcome', user.displayName);
 * }
 * ```
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { authService, wsService, api } from '../services';
import { User } from '../types';

/**
 * Auth Context State
 */
interface AuthContextState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

/**
 * Auth Context Actions
 */
interface AuthContextActions {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  loginAnonymous: (displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: { displayName?: string; profilePhotoUrl?: string; bio?: string }) => Promise<void>;
  clearError: () => void;
}

/**
 * Combined Auth Context Type
 */
type AuthContextType = AuthContextState & AuthContextActions;

/**
 * Default context values
 */
const defaultContext: AuthContextType = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  login: async () => { },
  register: async () => { },
  loginAnonymous: async () => { },
  logout: async () => { },
  updateProfile: async () => { },
  clearError: () => { },
};

/**
 * Auth Context
 */
const AuthContext = createContext<AuthContextType>(defaultContext);

/**
 * Auth Provider Props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user;

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        const initializedUser = await authService.initialize();
        setUser(initializedUser);

        if (initializedUser) {
          // Connect WebSocket after successful auth
          await wsService.connect();
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    // Setup API auth error callback - called when token refresh fails
    api.setAuthErrorCallback(() => {
      console.log('[AuthContext] Session expired, logging out');
      setUser(null);
      wsService.disconnect();
    });

    // Cleanup
    return () => {
      wsService.cleanup();
    };
  }, []);

  /**
   * Login with email and password
   */
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const loggedInUser = await authService.login(email, password);
      setUser(loggedInUser);
      await wsService.connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (email: string, password: string, displayName: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const newUser = await authService.register(email, password, displayName);
      setUser(newUser);
      await wsService.connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login anonymously
   */
  const loginAnonymous = useCallback(async (displayName: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const anonymousUser = await authService.loginAnonymous(displayName);
      setUser(anonymousUser);
      await wsService.connect();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Anonymous login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      wsService.disconnect();
      await authService.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (updates: { displayName?: string; profilePhotoUrl?: string; bio?: string }) => {
    try {
      const updatedUser = await authService.updateProfile(updates);
      setUser(updatedUser);

      // Sync changes via WebSocket for real-time updates
      // This matches Web App behavior in UserContext.tsx
      if (updates.displayName !== undefined || updates.profilePhotoUrl !== undefined) {
        wsService.updateProfile({
          displayName: updates.displayName,
          profilePhotoUrl: updates.profilePhotoUrl
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Profile update failed';
      setError(message);
      throw err;
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    loginAnonymous,
    logout,
    updateProfile,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth Hook
 *
 * Access auth context in components.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export default AuthContext;

