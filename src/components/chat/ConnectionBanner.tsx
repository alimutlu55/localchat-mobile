/**
 * Connection Banner Component
 *
 * Shows connection status when offline or reconnecting.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WifiOff, RefreshCw, Wifi } from 'lucide-react-native';
import { theme } from '../../core/theme';

type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

interface ConnectionBannerProps {
  state: ConnectionState;
  onRetry?: () => void;
}

export function ConnectionBanner({ state, onRetry }: ConnectionBannerProps) {
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'connected') {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Slide in
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [state]);

  useEffect(() => {
    if (state === 'reconnecting') {
      const spin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      spin.start();
      return () => spin.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [state]);

  if (state === 'connected') return null;

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getContent = () => {
    if (state === 'disconnected') {
      return (
        <>
          <WifiOff size={16} color={theme.tokens.text.onPrimary} />
          <Text style={styles.text}>No connection</Text>
        </>
      );
    }

    return (
      <>
        <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
          <RefreshCw size={16} color={theme.tokens.text.onPrimary} />
        </Animated.View>
        <Text style={styles.text}>Reconnecting...</Text>
      </>
    );
  };

  const backgroundColor = state === 'disconnected' ? theme.tokens.status.error.main : theme.tokens.brand.primary;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {getContent()}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    color: theme.tokens.text.onPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
});

export default ConnectionBanner;

