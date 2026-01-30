/**
 * OfflineIndicator Component
 *
 * Displays a warning banner when the device loses network connectivity.
 * Automatically shows/hides based on real-time network state via NetInfo.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { theme } from '../../constants/theme';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLabel="You are offline. Changes will sync when connected."
    >
      <Text style={styles.text}>
        Offline — changes will sync when connected
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.warning,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: theme.colors.background,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
});
