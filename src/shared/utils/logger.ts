/**
 * Structured Logging Utility
 *
 * Replaces scattered console.log calls with a consistent logging interface.
 * Supports log levels, namespaces, and can be disabled in production.
 *
 * @example
 * ```typescript
 * import { createLogger } from '@/shared/utils/logger';
 *
 * const log = createLogger('RoomContext');
 *
 * log.debug('Fetching rooms', { lat, lng });
 * log.info('User joined room', { roomId });
 * log.warn('Duplicate event detected');
 * log.error('Failed to join room', error);
 * ```
 */

// =============================================================================
// Configuration
// =============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

interface LoggerConfig {
  /** Minimum level to log. Messages below this level are ignored. */
  minLevel: LogLevel;
  /** Whether to include timestamp in logs */
  showTimestamp: boolean;
  /** Whether logging is enabled at all */
  enabled: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4,
};

// Global configuration - can be modified at runtime
const config: LoggerConfig = {
  minLevel: __DEV__ ? 'debug' : 'warn',
  showTimestamp: __DEV__,
  enabled: true,
};

// =============================================================================
// Logger Implementation
// =============================================================================

interface Logger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, error?: unknown) => void;
}

/**
 * Create a namespaced logger instance
 *
 * @param namespace - Identifier for the logging source (e.g., 'RoomContext', 'ChatScreen')
 */
export function createLogger(namespace: string): Logger {
  const formatMessage = (level: LogLevel, message: string): string => {
    const parts: string[] = [];

    if (config.showTimestamp) {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      parts.push(time);
    }

    parts.push(`[${namespace}]`);
    parts.push(message);

    return parts.join(' ');
  };

  const shouldLog = (level: LogLevel): boolean => {
    if (!config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
  };

  return {
    debug(message: string, data?: unknown) {
      if (!shouldLog('debug')) return;
      const formatted = formatMessage('debug', message);
      if (data !== undefined) {
        console.log(formatted, data);
      } else {
        console.log(formatted);
      }
    },

    info(message: string, data?: unknown) {
      if (!shouldLog('info')) return;
      const formatted = formatMessage('info', message);
      if (data !== undefined) {
        console.info(formatted, data);
      } else {
        console.info(formatted);
      }
    },

    warn(message: string, data?: unknown) {
      if (!shouldLog('warn')) return;
      const formatted = formatMessage('warn', message);
      if (data !== undefined) {
        console.warn(formatted, data);
      } else {
        console.warn(formatted);
      }
    },

    error(message: string, error?: unknown) {
      if (!shouldLog('error')) return;
      const formatted = formatMessage('error', message);
      if (error !== undefined) {
        console.error(formatted, error);
      } else {
        console.error(formatted);
      }
    },
  };
}

// =============================================================================
// Global Logger Configuration
// =============================================================================

/**
 * Configure global logging behavior
 */
export function configureLogger(options: Partial<LoggerConfig>): void {
  Object.assign(config, options);
}

/**
 * Disable all logging (useful for tests or production)
 */
export function disableLogging(): void {
  config.enabled = false;
}

/**
 * Enable logging
 */
export function enableLogging(): void {
  config.enabled = true;
}

/**
 * Set minimum log level
 */
export function setLogLevel(level: LogLevel): void {
  config.minLevel = level;
}

// =============================================================================
// Pre-configured Loggers for Common Namespaces
// =============================================================================

/**
 * Pre-configured loggers for major app areas.
 * Using these ensures consistent namespace naming.
 */
export const loggers = {
  auth: createLogger('Auth'),
  room: createLogger('Room'),
  chat: createLogger('Chat'),
  ws: createLogger('WebSocket'),
  api: createLogger('API'),
  nav: createLogger('Navigation'),
  ui: createLogger('UI'),
} as const;
