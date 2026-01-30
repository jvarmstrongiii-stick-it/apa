import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthContext } from '../src/providers/AuthProvider';
import { theme } from '../src/constants/theme';

export default function RootIndex() {
  const { user, role, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Not authenticated - go to login
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // Route based on role
  if (role === 'admin') {
    return <Redirect href="/(admin)/(tabs)" />;
  }

  if (role === 'team') {
    return <Redirect href="/(team)/(tabs)" />;
  }

  // Fallback - no recognized role
  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
