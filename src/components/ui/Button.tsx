/**
 * Button Component
 *
 * Reusable button with multiple variants.
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { theme } from '../../core/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[`${size}Size`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    isDisabled && styles[`${variant}Disabled`],
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    isDisabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? theme.tokens.action.primary.contrast : theme.tokens.action.primary.default}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text style={textStyles}>{title}</Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },

  // Variants
  primary: {
    backgroundColor: theme.tokens.action.primary.default,
  },
  secondary: {
    backgroundColor: theme.tokens.action.secondary.default,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.tokens.action.primary.default,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: theme.tokens.action.danger.default,
  },

  // Sizes
  smallSize: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mediumSize: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  largeSize: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },

  // Text base
  text: {
    fontWeight: '600',
  },

  // Text variants
  primaryText: {
    color: theme.tokens.action.primary.contrast,
  },
  secondaryText: {
    color: theme.tokens.action.secondary.text,
  },
  outlineText: {
    color: theme.tokens.action.primary.default,
  },
  ghostText: {
    color: theme.tokens.action.ghost.text,
  },
  dangerText: {
    color: theme.tokens.action.danger.contrast,
  },

  // Text sizes
  smallText: {
    fontSize: 13,
  },
  mediumText: {
    fontSize: 15,
  },
  largeText: {
    fontSize: 17,
  },

  // Disabled states
  disabled: {
    opacity: 0.6,
    backgroundColor: theme.tokens.action.disabled.bg,
  },
  primaryDisabled: {
    backgroundColor: theme.tokens.action.disabled.bg,
  },
  secondaryDisabled: {
    backgroundColor: theme.tokens.action.disabled.bg,
  },
  outlineDisabled: {
    borderColor: theme.tokens.action.disabled.text,
  },
  ghostDisabled: {},
  dangerDisabled: {
    backgroundColor: theme.tokens.action.disabled.bg,
  },
  disabledText: {
    color: theme.tokens.action.disabled.text,
  },
});

export default Button;

