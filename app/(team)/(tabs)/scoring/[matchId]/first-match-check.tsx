/**
 * FirstMatchCheckScreen — "Is this the first match of the night?"
 *
 * Gate screen shown immediately after pressing "Score Match" on a
 * scheduled/lineup_set team match. Routes to the coin flip ceremony
 * (first match) or the resume/individual match selector (not first match).
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../../../src/constants/theme';
import { supabase } from '../../../../../src/lib/supabase';
import { useAuthContext } from '../../../../../src/providers/AuthProvider';

export default function FirstMatchCheckScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { profile } = useAuthContext();
  const teamId = profile?.team_id;

  const [loading, setLoading] = useState(true);
  const [opponentName, setOpponentName] = useState('');

  // Block Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!matchId || !teamId) return;

    supabase
      .from('team_matches')
      .select('home_team_id, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)')
      .eq('id', matchId)
      .single()
      .then(({ data }) => {
        if (data) {
          const isHome = (data as any).home_team_id === teamId;
          setOpponentName(
            isHome
              ? ((data as any).away_team?.name ?? 'Away Team')
              : ((data as any).home_team?.name ?? 'Home Team')
          );
        }
        setLoading(false);
      });
  }, [matchId, teamId]);

  const handleYes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace(`/(team)/(tabs)/scoring/${matchId}/coin-flip`);
  };

  const handleNo = () => {
    Haptics.selectionAsync();
    router.replace(`/(team)/(tabs)/scoring/${matchId}/backfill`);
  };

  const handleCancel = () => {
    router.replace('/(team)/(tabs)/scoring');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View style={styles.container}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Score Match</Text>
          <Text style={styles.headerSub}>vs {opponentName}</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.coinEmoji}>🪙</Text>
          <Text style={styles.title}>First Match of the Night?</Text>
          <Text style={styles.subtitle}>
            A coin flip is required for the first match to determine who puts up first.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={handleYes}
          >
            <Text style={styles.primaryBtnText}>Yes — Flip a Coin</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={handleNo}
          >
            <Text style={styles.secondaryBtnText}>No — Enter Previous Matches</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
          onPress={handleCancel}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerSub: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  coinEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 52,
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  pressed: {
    opacity: 0.75,
  },
  cancelBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
});
