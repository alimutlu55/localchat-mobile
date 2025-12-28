/**
 * Avatar Component
 *
 * User avatar with fallback to initials.
 */

import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { theme } from '../../core/theme';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  style?: ViewStyle;
}

const SIZES = {
  small: 32,
  medium: 40,
  large: 56,
  xlarge: 80,
};

const FONT_SIZES = {
  small: 14,
  medium: 16,
  large: 24,
  xlarge: 32,
};

export function Avatar({ uri, name = '', size = 'medium', style }: AvatarProps) {
  const dimension = SIZES[size];
  const fontSize = FONT_SIZES[size];

  const initials = name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const baseStyle = {
    width: dimension,
    height: dimension,
    borderRadius: dimension / 2,
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, baseStyle] as ImageStyle[]}
      />
    );
  }

  return (
    <View style={[styles.container, baseStyle, style]}>
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.tokens.action.secondary.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    backgroundColor: theme.tokens.border.subtle,
  },
  initials: {
    fontWeight: '600',
    color: theme.tokens.text.onSecondary,
  },
});

export default Avatar;
