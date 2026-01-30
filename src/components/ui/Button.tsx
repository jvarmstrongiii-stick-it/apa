/**
 * Button Component
 *
 * Pool-hall optimized button with generous touch targets,
 * haptic feedback, and multiple style variants.
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<
  ButtonVariant,
  {
    background: string;
    pressedBackground: string;
    textColor: string;
    borderColor?: string;
  }
> = {
  primary: {
    background: theme.colors.primary,
    pressedBackground: theme.colors.primaryDark,
    textColor: theme.colors.text,
  },
  secondary: {
    background: 'transparent',
    pressedBackground: theme.colors.surfaceLight,
    textColor: theme.colors.text,
    borderColor: theme.colors.border,
  },
  danger: {
    background: theme.colors.error,
    pressedBackground: '#DC2626',
    textColor: theme.colors.text,
  },
  ghost: {
    background: 'transparent',
    pressedBackground: theme.colors.surfaceLight,
    textColor: theme.colors.primary,
  },
};

const sizeStyles: Record<
  ButtonSize,
  { paddingVertical: number; paddingHorizontal: number; fontSize: number; minHeight: number }
> = {
  sm: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    minHeight: theme.touchTarget.minimum,
  },
  md: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    fontSize: theme.fontSize.md,
    minHeight: theme.touchTarget.minimum,
  },
  lg: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    fontSize: theme.fontSize.lg,
    minHeight: 56,
  },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
}: ButtonProps) {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [disabled, loading, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed
            ? variantStyle.pressedBackground
            : variantStyle.background,
          borderColor: variantStyle.borderColor || 'transparent',
          borderWidth: variantStyle.borderColor ? 1 : 0,
          paddingVertical: sizeStyle.paddingVertical,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          minHeight: sizeStyle.minHeight,
          opacity: disabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variantStyle.textColor}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text
            style={[
              styles.text,
              {
                color: variantStyle.textColor,
                fontSize: sizeStyle.fontSize,
              },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: theme.spacing.sm,
  },
  text: {
    fontWeight: '600',
  },
});
