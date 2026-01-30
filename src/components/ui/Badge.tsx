/**
 * Badge Component
 *
 * Small colored pill for displaying status indicators
 * such as match state, player skill level, or connection status.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../constants/theme';

export type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantColors: Record<BadgeVariant, { background: string; text: string }> = {
  default: {
    background: theme.colors.surfaceLight,
    text: theme.colors.textSecondary,
  },
  success: {
    background: '#166534',
    text: theme.colors.success,
  },
  error: {
    background: '#7F1D1D',
    text: theme.colors.error,
  },
  warning: {
    background: '#713F12',
    text: theme.colors.warning,
  },
  info: {
    background: '#164E63',
    text: theme.colors.info,
  },
};

const sizeConfig: Record<BadgeSize, { paddingV: number; paddingH: number; fontSize: number }> = {
  sm: {
    paddingV: 2,
    paddingH: theme.spacing.sm,
    fontSize: theme.fontSize.xs,
  },
  md: {
    paddingV: theme.spacing.xs,
    paddingH: theme.spacing.md,
    fontSize: theme.fontSize.sm,
  },
};

export function Badge({
  text,
  variant = 'default',
  size = 'sm',
}: BadgeProps) {
  const colors = variantColors[variant];
  const sizing = sizeConfig[size];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.background,
          paddingVertical: sizing.paddingV,
          paddingHorizontal: sizing.paddingH,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={text}
    >
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontSize: sizing.fontSize,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
