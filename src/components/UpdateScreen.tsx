import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

type UpdateStatus = 'checking' | 'downloading' | 'installing' | 'done';

interface UpdateScreenProps {
  status: UpdateStatus;
  progress: number;
}

export function UpdateScreen({ status, progress }: UpdateScreenProps) {
  const message =
    status === 'checking'
      ? 'Checking for updates...'
      : status === 'downloading'
        ? `Downloading update... ${progress}%`
        : 'Installing update...';

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginTop: theme.spacing.lg,
  },
});
