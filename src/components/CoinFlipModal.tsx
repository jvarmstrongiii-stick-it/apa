/**
 * CoinFlipModal - Pre-match coin flip flow
 *
 * Multi-step modal shown before the first individual match of the night.
 * Steps:
 *   1. "Is this the first match of the night?" — Yes / No
 *   2. Coin flip animation (tap to flip)
 *   3. "Did your team win?" — Yes / No
 *   4a. (we won) Accept put-up or defer
 *   4b. (they won) Did they accept or defer?
 *
 * Calls onReady with the result so the caller can navigate appropriately.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';

type Step = 'first_match' | 'flip' | 'flip_result' | 'accept_defer' | 'their_choice';

export interface CoinFlipResult {
  firstMatch: boolean;
  /** true = our team puts up first, false = other team puts up first, null = not first match */
  ourTeamPutsUpFirst: boolean | null;
}

interface Props {
  visible: boolean;
  onReady: (result: CoinFlipResult) => void;
}

const COIN_SIZE = 120;

export function CoinFlipModal({ visible, onReady }: Props) {
  const [step, setStep] = useState<Step>('first_match');
  const [coinFace, setCoinFace] = useState<'HEADS' | 'TAILS' | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const scaleX = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    setStep('first_match');
    setCoinFace(null);
    setIsFlipping(false);
    scaleX.setValue(1);
  }, [visible]);

  const handleFlip = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result: 'HEADS' | 'TAILS' = Math.random() < 0.5 ? 'HEADS' : 'TAILS';

    Animated.sequence([
      Animated.timing(scaleX, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleX, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleX, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleX, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleX, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleX, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setCoinFace(result);
      setIsFlipping(false);
      setStep('flip_result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Step 1: Is this the first match? */}
          {step === 'first_match' && (
            <>
              <Text style={styles.stepIcon}>🪙</Text>
              <Text style={styles.title}>First Match of the Night?</Text>
              <Text style={styles.body}>
                A coin flip determines which team puts up their first player.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={() => { Haptics.selectionAsync(); setStep('flip'); }}
              >
                <Text style={styles.primaryBtnText}>Yes — Flip a Coin</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                onPress={() => { Haptics.selectionAsync(); onReady({ firstMatch: false, ourTeamPutsUpFirst: null }); }}
              >
                <Text style={styles.secondaryBtnText}>No — Continue</Text>
              </Pressable>
            </>
          )}

          {/* Step 2: Coin flip */}
          {step === 'flip' && (
            <>
              <Text style={styles.title}>Flip the Coin</Text>
              <Text style={styles.body}>
                {isFlipping ? 'Flipping...' : 'Tap the coin or press Flip!'}
              </Text>
              <Pressable onPress={handleFlip} disabled={isFlipping} style={styles.coinWrapper}>
                <Animated.View style={[styles.coin, { transform: [{ scaleX }] }]}>
                  <Text style={styles.coinSymbol}>?</Text>
                </Animated.View>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  isFlipping && styles.btnDisabled,
                  pressed && !isFlipping && styles.pressed,
                ]}
                onPress={handleFlip}
                disabled={isFlipping}
              >
                <Text style={styles.primaryBtnText}>Flip!</Text>
              </Pressable>
            </>
          )}

          {/* Step 3: Flip result — did we win? */}
          {step === 'flip_result' && (
            <>
              <View style={styles.coin}>
                <Text style={styles.coinSymbol}>{coinFace === 'HEADS' ? 'H' : 'T'}</Text>
              </View>
              <Text style={[styles.title, styles.resultTitle]}>{coinFace}!</Text>
              <Text style={styles.body}>Did your team win the flip?</Text>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={() => { Haptics.selectionAsync(); setStep('accept_defer'); }}
              >
                <Text style={styles.primaryBtnText}>Yes, we won!</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                onPress={() => { Haptics.selectionAsync(); setStep('their_choice'); }}
              >
                <Text style={styles.secondaryBtnText}>No, they won</Text>
              </Pressable>
            </>
          )}

          {/* Step 4a: We won — accept or defer */}
          {step === 'accept_defer' && (
            <>
              <Text style={styles.stepIcon}>🏆</Text>
              <Text style={styles.title}>Your Team Won!</Text>
              <Text style={styles.body}>
                Accept the put-up and name your player first, or defer to the other team?
              </Text>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onReady({ firstMatch: true, ourTeamPutsUpFirst: true });
                }}
              >
                <Text style={styles.primaryBtnText}>Accept Put-up</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onReady({ firstMatch: true, ourTeamPutsUpFirst: false });
                }}
              >
                <Text style={styles.secondaryBtnText}>Defer to Them</Text>
              </Pressable>
            </>
          )}

          {/* Step 4b: They won — did they accept or defer? */}
          {step === 'their_choice' && (
            <>
              <Text style={styles.title}>Other Team Won</Text>
              <Text style={styles.body}>
                Did they accept the put-up, or defer to your team?
              </Text>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // They accepted → they put up first
                  onReady({ firstMatch: true, ourTeamPutsUpFirst: false });
                }}
              >
                <Text style={styles.primaryBtnText}>They Accepted</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  // They deferred → we put up first
                  onReady({ firstMatch: true, ourTeamPutsUpFirst: true });
                }}
              >
                <Text style={styles.secondaryBtnText}>They Deferred to Us</Text>
              </Pressable>
            </>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
  stepIcon: {
    fontSize: 52,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  resultTitle: {
    color: '#F59E0B',
    fontSize: 28,
    letterSpacing: 1,
  },
  body: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  coinWrapper: {
    marginVertical: 4,
  },
  coin: {
    width: COIN_SIZE,
    height: COIN_SIZE,
    borderRadius: COIN_SIZE / 2,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: '#D97706',
    marginVertical: 8,
  },
  coinSymbol: {
    fontSize: 42,
    fontWeight: '900',
    color: '#92400E',
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
    opacity: 0.8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
