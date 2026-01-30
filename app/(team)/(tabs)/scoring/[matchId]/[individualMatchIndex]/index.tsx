import { useState, useEffect } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../../../../src/constants/theme';

type GameFormat = '8-ball' | '9-ball';

interface PlayerInfo {
  name: string;
  skill_level: number;
  race_to: number; // For 8-ball
  target_points: number; // For 9-ball
}

interface EightBallState {
  home_games_won: boolean[];
  away_games_won: boolean[];
  innings: number;
  defensive_shots_home: number;
  defensive_shots_away: number;
  break_and_run_home: boolean;
  break_and_run_away: boolean;
  eight_on_break_home: boolean;
  eight_on_break_away: boolean;
}

interface NineBallState {
  home_points: number;
  away_points: number;
  dead_balls: number;
  balls_made_home: boolean[]; // Track which balls (1-9) are pocketed by home
  balls_made_away: boolean[]; // Track which balls (1-9) are pocketed by away
  innings: number;
}

// 8-ball race-to values by skill level
const EIGHT_BALL_RACE: Record<number, number> = {
  2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 5,
};

// 9-ball target points by skill level
const NINE_BALL_TARGETS: Record<number, number> = {
  1: 14, 2: 19, 3: 25, 4: 31, 5: 38, 6: 46, 7: 55, 8: 65, 9: 75,
};

export default function IndividualMatchScoringScreen() {
  const { matchId, individualMatchIndex } = useLocalSearchParams<{
    matchId: string;
    individualMatchIndex: string;
  }>();

  const matchIndex = parseInt(individualMatchIndex ?? '0');

  // TODO: Fetch actual match data from API/store
  const gameFormat: GameFormat = '8-ball'; // Determine from match data

  const [homePlayer] = useState<PlayerInfo>({
    name: 'John Doe',
    skill_level: 5,
    race_to: EIGHT_BALL_RACE[5] ?? 3,
    target_points: NINE_BALL_TARGETS[5] ?? 38,
  });

  const [awayPlayer] = useState<PlayerInfo>({
    name: 'Mike Smith',
    skill_level: 4,
    race_to: EIGHT_BALL_RACE[4] ?? 3,
    target_points: NINE_BALL_TARGETS[4] ?? 31,
  });

  // 8-ball state
  const [eightBall, setEightBall] = useState<EightBallState>({
    home_games_won: [],
    away_games_won: [],
    innings: 0,
    defensive_shots_home: 0,
    defensive_shots_away: 0,
    break_and_run_home: false,
    break_and_run_away: false,
    eight_on_break_home: false,
    eight_on_break_away: false,
  });

  // 9-ball state
  const [nineBall, setNineBall] = useState<NineBallState>({
    home_points: 0,
    away_points: 0,
    dead_balls: 0,
    balls_made_home: Array(9).fill(false),
    balls_made_away: Array(9).fill(false),
    innings: 0,
  });

  const homeGamesWon = eightBall.home_games_won.filter(Boolean).length;
  const awayGamesWon = eightBall.away_games_won.filter(Boolean).length;

  const isMatchComplete =
    gameFormat === '8-ball'
      ? homeGamesWon >= homePlayer.race_to || awayGamesWon >= awayPlayer.race_to
      : nineBall.home_points >= homePlayer.target_points ||
        nineBall.away_points >= awayPlayer.target_points;

  // --- 8-ball handlers ---
  const addGameWon = (side: 'home' | 'away') => {
    if (side === 'home') {
      setEightBall((prev) => ({
        ...prev,
        home_games_won: [...prev.home_games_won, true],
      }));
    } else {
      setEightBall((prev) => ({
        ...prev,
        away_games_won: [...prev.away_games_won, true],
      }));
    }
  };

  const removeGameWon = (side: 'home' | 'away') => {
    if (side === 'home') {
      setEightBall((prev) => ({
        ...prev,
        home_games_won: prev.home_games_won.slice(0, -1),
      }));
    } else {
      setEightBall((prev) => ({
        ...prev,
        away_games_won: prev.away_games_won.slice(0, -1),
      }));
    }
  };

  // --- 9-ball handlers ---
  const toggleBall = (side: 'home' | 'away', ballIndex: number) => {
    if (side === 'home') {
      setNineBall((prev) => {
        const newBalls = [...prev.balls_made_home];
        newBalls[ballIndex] = !newBalls[ballIndex];
        const points = newBalls.reduce(
          (sum, made, idx) => sum + (made ? idx + 1 : 0),
          0
        );
        return { ...prev, balls_made_home: newBalls, home_points: points };
      });
    } else {
      setNineBall((prev) => {
        const newBalls = [...prev.balls_made_away];
        newBalls[ballIndex] = !newBalls[ballIndex];
        const points = newBalls.reduce(
          (sum, made, idx) => sum + (made ? idx + 1 : 0),
          0
        );
        return { ...prev, balls_made_away: newBalls, away_points: points };
      });
    }
  };

  const handleCompleteMatch = () => {
    if (!isMatchComplete) {
      Alert.alert(
        'Match Not Complete',
        'Neither player has reached their target yet. Are you sure you want to end this match early?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'End Match', onPress: navigateNext },
        ]
      );
      return;
    }
    navigateNext();
  };

  const navigateNext = () => {
    // TODO: Save individual match result to store/API
    if (matchIndex < 4) {
      // Navigate to next individual match
      router.push(
        `/(team)/(tabs)/scoring/${matchId}/${matchIndex + 1}`
      );
    } else {
      // All 5 individual matches done, go to finalize
      router.push(`/(team)/(tabs)/scoring/${matchId}/finalize`);
    }
  };

  // --- Render 8-ball UI ---
  const render8Ball = () => (
    <>
      {/* Game Boxes */}
      <View style={styles.gameBoxSection}>
        <Text style={styles.sectionLabel}>Games Won</Text>
        <View style={styles.gameBoxRow}>
          {/* Home Games */}
          <View style={styles.gameBoxColumn}>
            <Text style={styles.playerLabel}>{homePlayer.name}</Text>
            <Text style={styles.raceLabel}>Race to {homePlayer.race_to}</Text>
            <View style={styles.gameBoxes}>
              {Array.from({ length: homePlayer.race_to }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.gameBox,
                    i < homeGamesWon && styles.gameBoxFilled,
                  ]}
                >
                  {i < homeGamesWon && (
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  )}
                </View>
              ))}
            </View>
            <View style={styles.gameActions}>
              <Pressable
                style={[styles.gameActionButton, styles.addGameButton]}
                onPress={() => addGameWon('home')}
                disabled={homeGamesWon >= homePlayer.race_to}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </Pressable>
              <Pressable
                style={[styles.gameActionButton, styles.removeGameButton]}
                onPress={() => removeGameWon('home')}
                disabled={homeGamesWon === 0}
              >
                <Ionicons name="remove" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View style={styles.vsColumn}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          {/* Away Games */}
          <View style={styles.gameBoxColumn}>
            <Text style={styles.playerLabel}>{awayPlayer.name}</Text>
            <Text style={styles.raceLabel}>Race to {awayPlayer.race_to}</Text>
            <View style={styles.gameBoxes}>
              {Array.from({ length: awayPlayer.race_to }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.gameBox,
                    i < awayGamesWon && styles.gameBoxFilled,
                  ]}
                >
                  {i < awayGamesWon && (
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  )}
                </View>
              ))}
            </View>
            <View style={styles.gameActions}>
              <Pressable
                style={[styles.gameActionButton, styles.addGameButton]}
                onPress={() => addGameWon('away')}
                disabled={awayGamesWon >= awayPlayer.race_to}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </Pressable>
              <Pressable
                style={[styles.gameActionButton, styles.removeGameButton]}
                onPress={() => removeGameWon('away')}
                disabled={awayGamesWon === 0}
              >
                <Ionicons name="remove" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* Innings Counter */}
      <View style={styles.counterSection}>
        <Text style={styles.sectionLabel}>Innings</Text>
        <View style={styles.counterRow}>
          <Pressable
            style={styles.counterButton}
            onPress={() =>
              setEightBall((prev) => ({
                ...prev,
                innings: Math.max(0, prev.innings - 1),
              }))
            }
          >
            <Ionicons name="remove" size={28} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.counterValue}>{eightBall.innings}</Text>
          <Pressable
            style={styles.counterButton}
            onPress={() =>
              setEightBall((prev) => ({ ...prev, innings: prev.innings + 1 }))
            }
          >
            <Ionicons name="add" size={28} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Defensive Shots */}
      <View style={styles.counterSection}>
        <Text style={styles.sectionLabel}>Defensive Shots</Text>
        <View style={styles.defensiveRow}>
          <View style={styles.defensiveColumn}>
            <Text style={styles.defensiveLabel}>{homePlayer.name}</Text>
            <View style={styles.counterRow}>
              <Pressable
                style={styles.counterButtonSmall}
                onPress={() =>
                  setEightBall((prev) => ({
                    ...prev,
                    defensive_shots_home: Math.max(0, prev.defensive_shots_home - 1),
                  }))
                }
              >
                <Ionicons name="remove" size={22} color={theme.colors.text} />
              </Pressable>
              <Text style={styles.counterValueSmall}>
                {eightBall.defensive_shots_home}
              </Text>
              <Pressable
                style={styles.counterButtonSmall}
                onPress={() =>
                  setEightBall((prev) => ({
                    ...prev,
                    defensive_shots_home: prev.defensive_shots_home + 1,
                  }))
                }
              >
                <Ionicons name="add" size={22} color={theme.colors.text} />
              </Pressable>
            </View>
          </View>
          <View style={styles.defensiveColumn}>
            <Text style={styles.defensiveLabel}>{awayPlayer.name}</Text>
            <View style={styles.counterRow}>
              <Pressable
                style={styles.counterButtonSmall}
                onPress={() =>
                  setEightBall((prev) => ({
                    ...prev,
                    defensive_shots_away: Math.max(0, prev.defensive_shots_away - 1),
                  }))
                }
              >
                <Ionicons name="remove" size={22} color={theme.colors.text} />
              </Pressable>
              <Text style={styles.counterValueSmall}>
                {eightBall.defensive_shots_away}
              </Text>
              <Pressable
                style={styles.counterButtonSmall}
                onPress={() =>
                  setEightBall((prev) => ({
                    ...prev,
                    defensive_shots_away: prev.defensive_shots_away + 1,
                  }))
                }
              >
                <Ionicons name="add" size={22} color={theme.colors.text} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* Special Actions */}
      <View style={styles.toggleSection}>
        <Text style={styles.sectionLabel}>Special</Text>

        <Pressable
          style={[
            styles.toggleRow,
            eightBall.break_and_run_home && styles.toggleActive,
          ]}
          onPress={() =>
            setEightBall((prev) => ({
              ...prev,
              break_and_run_home: !prev.break_and_run_home,
            }))
          }
        >
          <Text style={styles.toggleText}>
            Break & Run - {homePlayer.name}
          </Text>
          <Ionicons
            name={eightBall.break_and_run_home ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={eightBall.break_and_run_home ? '#4CAF50' : theme.colors.textSecondary}
          />
        </Pressable>

        <Pressable
          style={[
            styles.toggleRow,
            eightBall.break_and_run_away && styles.toggleActive,
          ]}
          onPress={() =>
            setEightBall((prev) => ({
              ...prev,
              break_and_run_away: !prev.break_and_run_away,
            }))
          }
        >
          <Text style={styles.toggleText}>
            Break & Run - {awayPlayer.name}
          </Text>
          <Ionicons
            name={eightBall.break_and_run_away ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={eightBall.break_and_run_away ? '#4CAF50' : theme.colors.textSecondary}
          />
        </Pressable>

        <Pressable
          style={[
            styles.toggleRow,
            eightBall.eight_on_break_home && styles.toggleActive,
          ]}
          onPress={() =>
            setEightBall((prev) => ({
              ...prev,
              eight_on_break_home: !prev.eight_on_break_home,
            }))
          }
        >
          <Text style={styles.toggleText}>
            8 on Break - {homePlayer.name}
          </Text>
          <Ionicons
            name={eightBall.eight_on_break_home ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={eightBall.eight_on_break_home ? '#4CAF50' : theme.colors.textSecondary}
          />
        </Pressable>

        <Pressable
          style={[
            styles.toggleRow,
            eightBall.eight_on_break_away && styles.toggleActive,
          ]}
          onPress={() =>
            setEightBall((prev) => ({
              ...prev,
              eight_on_break_away: !prev.eight_on_break_away,
            }))
          }
        >
          <Text style={styles.toggleText}>
            8 on Break - {awayPlayer.name}
          </Text>
          <Ionicons
            name={eightBall.eight_on_break_away ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={eightBall.eight_on_break_away ? '#4CAF50' : theme.colors.textSecondary}
          />
        </Pressable>
      </View>
    </>
  );

  // --- Render 9-ball UI ---
  const render9Ball = () => (
    <>
      {/* Point Totals */}
      <View style={styles.pointTotalsSection}>
        <View style={styles.pointColumn}>
          <Text style={styles.playerLabel}>{homePlayer.name}</Text>
          <Text style={styles.pointTotal}>{nineBall.home_points}</Text>
          <Text style={styles.targetLabel}>
            Target: {homePlayer.target_points}
          </Text>
          <View style={styles.pointProgressContainer}>
            <View
              style={[
                styles.pointProgressBar,
                {
                  width: `${Math.min(
                    100,
                    (nineBall.home_points / homePlayer.target_points) * 100
                  )}%`,
                },
              ]}
            />
          </View>
        </View>
        <View style={styles.vsColumn}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        <View style={styles.pointColumn}>
          <Text style={styles.playerLabel}>{awayPlayer.name}</Text>
          <Text style={styles.pointTotal}>{nineBall.away_points}</Text>
          <Text style={styles.targetLabel}>
            Target: {awayPlayer.target_points}
          </Text>
          <View style={styles.pointProgressContainer}>
            <View
              style={[
                styles.pointProgressBar,
                {
                  width: `${Math.min(
                    100,
                    (nineBall.away_points / awayPlayer.target_points) * 100
                  )}%`,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Ball Selector Grid - Home */}
      <View style={styles.ballSection}>
        <Text style={styles.sectionLabel}>
          {homePlayer.name} - Balls Made
        </Text>
        <View style={styles.ballGrid}>
          {Array.from({ length: 9 }, (_, i) => (
            <Pressable
              key={`home-${i}`}
              style={[
                styles.ballButton,
                nineBall.balls_made_home[i] && styles.ballButtonActive,
              ]}
              onPress={() => toggleBall('home', i)}
            >
              <Text
                style={[
                  styles.ballNumber,
                  nineBall.balls_made_home[i] && styles.ballNumberActive,
                ]}
              >
                {i + 1}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Ball Selector Grid - Away */}
      <View style={styles.ballSection}>
        <Text style={styles.sectionLabel}>
          {awayPlayer.name} - Balls Made
        </Text>
        <View style={styles.ballGrid}>
          {Array.from({ length: 9 }, (_, i) => (
            <Pressable
              key={`away-${i}`}
              style={[
                styles.ballButton,
                nineBall.balls_made_away[i] && styles.ballButtonActive,
              ]}
              onPress={() => toggleBall('away', i)}
            >
              <Text
                style={[
                  styles.ballNumber,
                  nineBall.balls_made_away[i] && styles.ballNumberActive,
                ]}
              >
                {i + 1}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Dead Balls */}
      <View style={styles.counterSection}>
        <Text style={styles.sectionLabel}>Dead Balls</Text>
        <View style={styles.counterRow}>
          <Pressable
            style={styles.counterButton}
            onPress={() =>
              setNineBall((prev) => ({
                ...prev,
                dead_balls: Math.max(0, prev.dead_balls - 1),
              }))
            }
          >
            <Ionicons name="remove" size={28} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.counterValue}>{nineBall.dead_balls}</Text>
          <Pressable
            style={styles.counterButton}
            onPress={() =>
              setNineBall((prev) => ({
                ...prev,
                dead_balls: prev.dead_balls + 1,
              }))
            }
          >
            <Ionicons name="add" size={28} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Innings */}
      <View style={styles.counterSection}>
        <Text style={styles.sectionLabel}>Innings</Text>
        <View style={styles.counterRow}>
          <Pressable
            style={styles.counterButton}
            onPress={() =>
              setNineBall((prev) => ({
                ...prev,
                innings: Math.max(0, prev.innings - 1),
              }))
            }
          >
            <Ionicons name="remove" size={28} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.counterValue}>{nineBall.innings}</Text>
          <Pressable
            style={styles.counterButton}
            onPress={() =>
              setNineBall((prev) => ({
                ...prev,
                innings: prev.innings + 1,
              }))
            }
          >
            <Ionicons name="add" size={28} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Match {matchIndex + 1} of 5</Text>
          <Text style={styles.headerSubtitle}>{gameFormat}</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      {/* Player Info Bar */}
      <View style={styles.playerInfoBar}>
        <View style={styles.playerInfoColumn}>
          <Text style={styles.playerInfoName}>{homePlayer.name}</Text>
          <Text style={styles.playerInfoSkill}>SL {homePlayer.skill_level}</Text>
        </View>
        <View style={styles.playerInfoVs}>
          <Text style={styles.playerInfoVsText}>vs</Text>
        </View>
        <View style={[styles.playerInfoColumn, styles.playerInfoRight]}>
          <Text style={[styles.playerInfoName, styles.textRight]}>
            {awayPlayer.name}
          </Text>
          <Text style={[styles.playerInfoSkill, styles.textRight]}>
            SL {awayPlayer.skill_level}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {gameFormat === '8-ball' ? render8Ball() : render9Ball()}
      </ScrollView>

      {/* Complete Match Button */}
      <View style={styles.bottomBar}>
        <Pressable
          style={({ pressed }) => [
            styles.completeButton,
            pressed && styles.buttonPressed,
            isMatchComplete && styles.completeButtonReady,
          ]}
          onPress={handleCompleteMatch}
        >
          <Text style={styles.completeButtonText}>
            {isMatchComplete
              ? matchIndex < 4
                ? 'Next Match'
                : 'Finalize'
              : 'Complete Match'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
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
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  playerInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  playerInfoColumn: {
    flex: 1,
  },
  playerInfoRight: {
    alignItems: 'flex-end',
  },
  playerInfoName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  playerInfoSkill: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  playerInfoVs: {
    paddingHorizontal: 16,
  },
  playerInfoVsText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  textRight: {
    textAlign: 'right',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 16,
  },
  // 8-ball styles
  gameBoxSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },
  gameBoxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  gameBoxColumn: {
    flex: 1,
    alignItems: 'center',
  },
  playerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  raceLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 10,
  },
  gameBoxes: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  gameBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameBoxFilled: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  gameActions: {
    flexDirection: 'row',
    gap: 8,
  },
  gameActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGameButton: {
    backgroundColor: '#4CAF50',
  },
  removeGameButton: {
    backgroundColor: '#F44336',
  },
  vsColumn: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    paddingTop: 24,
  },
  vsText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  // Counters
  counterSection: {
    marginBottom: 24,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  counterButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.text,
    minWidth: 60,
    textAlign: 'center',
  },
  defensiveRow: {
    flexDirection: 'row',
    gap: 16,
  },
  defensiveColumn: {
    flex: 1,
    alignItems: 'center',
  },
  defensiveLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  counterButtonSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValueSmall: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    minWidth: 40,
    textAlign: 'center',
  },
  // Toggles
  toggleSection: {
    marginBottom: 24,
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 56,
  },
  toggleActive: {
    borderColor: '#4CAF5050',
    backgroundColor: '#4CAF5010',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  // 9-ball styles
  pointTotalsSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  pointColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pointTotal: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.text,
    marginVertical: 4,
  },
  targetLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  pointProgressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  pointProgressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  ballSection: {
    marginBottom: 24,
  },
  ballGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  ballButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  ballNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  ballNumberActive: {
    color: '#FFFFFF',
  },
  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    minHeight: 56,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  completeButtonReady: {
    backgroundColor: '#4CAF50',
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
