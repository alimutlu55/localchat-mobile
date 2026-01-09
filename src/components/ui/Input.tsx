/**
 * Input Component
 *
 * Reusable text input with label and error states.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
  TextStyle,
  Pressable,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { theme } from '../../core/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerStyle,
  isPassword = false,
  style,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const hasError = !!error;

  const inputStyles: StyleProp<TextStyle>[] = [styles.input];
  if (leftIcon) inputStyles.push(styles.inputWithLeftIcon);
  if (rightIcon || isPassword) inputStyles.push(styles.inputWithRightIcon);
  if (style) inputStyles.push(style as TextStyle);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          hasError && styles.inputContainerError,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <TextInput
          ref={inputRef}
          style={inputStyles}
          placeholderTextColor={theme.tokens.text.tertiary}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            style={styles.iconRight}
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {showPassword ? (
              <EyeOff size={20} color={theme.tokens.text.tertiary} />
            ) : (
              <Eye size={20} color={theme.tokens.text.tertiary} />
            )}
          </TouchableOpacity>
        )}

        {rightIcon && !isPassword && (
          <View style={styles.iconRight}>{rightIcon}</View>
        )}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.tokens.text.secondary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.tokens.bg.subtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.tokens.border.subtle,
    overflow: 'hidden',
  },
  inputContainerFocused: {
    borderColor: theme.tokens.border.focus,
    backgroundColor: theme.tokens.bg.surface,
  },
  inputContainerError: {
    borderColor: theme.tokens.border.error,
    backgroundColor: theme.tokens.status.error.bg,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.tokens.text.primary,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  iconLeft: {
    paddingLeft: 14,
  },
  iconRight: {
    paddingRight: 14,
  },
  error: {
    fontSize: 12,
    color: theme.tokens.text.error,
    marginTop: 6,
  },
  hint: {
    fontSize: 12,
    color: theme.tokens.text.tertiary,
    marginTop: 6,
  },
});

export default Input;
