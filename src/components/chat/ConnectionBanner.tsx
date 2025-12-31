/**
 * Connection Banner Component (Self-Contained)
 *
 * A fully self-contained network status banner that:
 * - Reads state directly from NetworkStore
 * - Handles retries internally via WebSocket service
 * - Works consistently everywhere with no props needed
 *
 * Usage: Just drop <ConnectionBanner /> anywhere - it handles everything.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Easing } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { useNetworkStatus } from '../../core/network';
import { wsService } from '../../services/websocket';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

// Simple Slate color palette
const COLORS = {
  bg: '#F1F5F9',
  text: '#475569',
  icon: '#64748B',
  button: '#1E293B',
  buttonText: '#FFFFFF',
  border: '#E2E8F0',
};

export function ConnectionBanner() {
  // Read directly from NetworkStore - single source of truth
  const { wsState, isOnline } = useNetworkStatus();

  // Animation values
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  // Derive state from network status
  // Priority: offline → reconnecting, then use wsState directly
  const state: ConnectionState = !isOnline ? 'reconnecting' : wsState;

  const isVisible = state !== 'connected';
  const isSpinning = state === 'reconnecting' || state === 'connecting';
  const showRetryButton = state === 'disconnected';

  // Slide in/out animation
  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(heightAnim, {
          toValue: 32,
          useNativeDriver: false,
          tension: 100,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [isVisible, heightAnim, opacityAnim]);

  // Spinning animation
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isSpinning) {
      const startSpin = () => {
        spinValue.setValue(0);
        animation = Animated.timing(spinValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        });
        animation.start(({ finished }) => {
          if (finished) startSpin();
        });
      };
      startSpin();
    } else {
      spinValue.setValue(0);
    }

    return () => animation?.stop();
  }, [isSpinning, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Handle retry - just tell WebSocket to reconnect
  // It will handle the retry loop internally
  const handleRetry = useCallback(() => {
    console.log('[ConnectionBanner] Manual retry triggered');
    wsService.manualReconnect();
  }, []);

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: heightAnim,
          opacity: opacityAnim,
          backgroundColor: COLORS.bg,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.statusWrapper}>
          <View style={styles.iconContainer}>
            {showRetryButton ? (
              <WifiOff size={14} color={COLORS.icon} strokeWidth={2.5} />
            ) : (
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <RefreshCw size={14} color={COLORS.icon} strokeWidth={2.5} />
              </Animated.View>
            )}
          </View>
          <Text style={styles.message} numberOfLines={1}>
            Reconnecting...
          </Text>
        </View>

        {showRetryButton && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    zIndex: 100,
  },
  content: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  statusWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconContainer: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: COLORS.text,
  },
  retryButton: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.button,
    zIndex: 101,
  },
  retryText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    color: COLORS.buttonText,
  },
});

export default ConnectionBanner;
