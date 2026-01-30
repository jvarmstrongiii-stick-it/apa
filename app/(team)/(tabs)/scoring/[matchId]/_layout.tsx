import { Stack } from 'expo-router';
import { theme } from '../../../../../src/constants/theme';

export default function ScoringMatchLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
        gestureEnabled: false, // Prevent accidental swipe-back during scoring
      }}
    />
  );
}
