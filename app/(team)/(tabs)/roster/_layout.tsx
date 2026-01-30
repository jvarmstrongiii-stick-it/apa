import { Stack } from 'expo-router';
import { theme } from '../../../../src/constants/theme';

export default function RosterLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
