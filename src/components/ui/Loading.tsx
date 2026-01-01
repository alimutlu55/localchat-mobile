/**
 * Loading Component
 *
 * Full-screen loading indicator.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message, fullScreen = true }: LoadingProps) {
  const Container = fullScreen ? View : React.Fragment;
  const containerProps = fullScreen ? { style: styles.container } : {};

  return (
    <Container {...containerProps}>
      <ActivityIndicator size="large" color="#FF6410" />
      {message && <Text style={styles.message}>{message}</Text>}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
});

export default Loading;

