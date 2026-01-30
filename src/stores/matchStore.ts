import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandMMKVStorage } from '../lib/offline/storage';
import { addToQueue } from '../lib/offline/syncQueue';
import {
  createEightBallMatch,
  addEightBallRack,
  createNineBallMatch,
  addNineBallRack,
  type EightBallMatch,
  type NineBallMatch,
} from '../lib/apa';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IndividualMatchInfo {
  id: string;
  gameFormat: 'eight_ball' | 'nine_ball';
  homeSkill: number;
  awaySkill: number;
  homePlayerId: string;
  awayPlayerId: string;
  isCompleted: boolean;
}

export interface MatchStore {
  // ---- State ---------------------------------------------------------------
  /** The team match that is currently being scored. */
  activeTeamMatchId: string | null;
  /** Metadata for each individual match keyed by its id. */
  individualMatches: Record<string, IndividualMatchInfo>;
  /** 8-ball scoring state keyed by individual match id. */
  eightBallState: Record<string, EightBallMatch>;
  /** 9-ball scoring state keyed by individual match id. */
  nineBallState: Record<string, NineBallMatch>;

  // ---- Active match lifecycle ----------------------------------------------
  setActiveMatch: (teamMatchId: string) => void;
  clearActiveMatch: () => void;

  // ---- Individual match management -----------------------------------------
  initializeIndividualMatch: (
    matchId: string,
    data: {
      gameFormat: 'eight_ball' | 'nine_ball';
      homeSkill: number;
      awaySkill: number;
      homePlayerId: string;
      awayPlayerId: string;
    },
  ) => void;
  completeIndividualMatch: (matchId: string) => void;

  // ---- 8-ball scoring ------------------------------------------------------
  addEightBallRack: (
    matchId: string,
    rack: {
      wonBy: 'home' | 'away' | null;
      isBreakAndRun: boolean;
      isEightOnBreak: boolean;
      deadRack: boolean;
    },
  ) => void;
  removeLastEightBallRack: (matchId: string) => void;
  updateEightBallInnings: (matchId: string, innings: number) => void;
  updateEightBallDefensiveShots: (matchId: string, shots: number) => void;

  // ---- 9-ball scoring ------------------------------------------------------
  addNineBallRack: (
    matchId: string,
    rack: {
      ballsPocketedHome: number[];
      ballsPocketedAway: number[];
      deadBalls: number[];
      isBreakAndRun: boolean;
    },
  ) => void;
  removeLastNineBallRack: (matchId: string) => void;
  updateNineBallInnings: (matchId: string, innings: number) => void;
  updateNineBallDefensiveShots: (matchId: string, shots: number) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMatchStore = create<MatchStore>()(
  persist(
    (set, get) => ({
      // -- Initial state ----------------------------------------------------
      activeTeamMatchId: null,
      individualMatches: {},
      eightBallState: {},
      nineBallState: {},

      // -- Active match lifecycle -------------------------------------------

      setActiveMatch: (teamMatchId: string) => {
        set({ activeTeamMatchId: teamMatchId });
      },

      clearActiveMatch: () => {
        set({ activeTeamMatchId: null });
      },

      // -- Individual match management --------------------------------------

      initializeIndividualMatch: (matchId, data) => {
        const info: IndividualMatchInfo = {
          id: matchId,
          gameFormat: data.gameFormat,
          homeSkill: data.homeSkill,
          awaySkill: data.awaySkill,
          homePlayerId: data.homePlayerId,
          awayPlayerId: data.awayPlayerId,
          isCompleted: false,
        };

        if (data.gameFormat === 'eight_ball') {
          const matchState = createEightBallMatch(data.homeSkill, data.awaySkill);
          set((state) => ({
            individualMatches: { ...state.individualMatches, [matchId]: info },
            eightBallState: { ...state.eightBallState, [matchId]: matchState },
          }));
        } else {
          const matchState = createNineBallMatch(data.homeSkill, data.awaySkill);
          set((state) => ({
            individualMatches: { ...state.individualMatches, [matchId]: info },
            nineBallState: { ...state.nineBallState, [matchId]: matchState },
          }));
        }

        // Enqueue sync mutation
        addToQueue({
          table: 'individual_matches',
          type: 'upsert',
          data: { id: matchId, ...data, is_completed: false },
          primaryKey: matchId,
        });
      },

      completeIndividualMatch: (matchId) => {
        const info = get().individualMatches[matchId];
        if (!info) return;

        const updatedInfo: IndividualMatchInfo = { ...info, isCompleted: true };

        set((state) => ({
          individualMatches: {
            ...state.individualMatches,
            [matchId]: updatedInfo,
          },
        }));

        // Build sync payload from the final game state
        let syncPayload: Record<string, unknown> = {
          id: matchId,
          is_completed: true,
        };

        if (info.gameFormat === 'eight_ball') {
          const ebState = get().eightBallState[matchId];
          if (ebState) {
            syncPayload = {
              ...syncPayload,
              home_games_won: ebState.homeGamesWon,
              away_games_won: ebState.awayGamesWon,
              innings: ebState.innings,
              defensive_shots: ebState.defensiveShots,
            };
          }
        } else {
          const nbState = get().nineBallState[matchId];
          if (nbState) {
            syncPayload = {
              ...syncPayload,
              home_points_total: nbState.homePointsTotal,
              away_points_total: nbState.awayPointsTotal,
              innings: nbState.innings,
              defensive_shots: nbState.defensiveShots,
            };
          }
        }

        addToQueue({
          table: 'individual_matches',
          type: 'update',
          data: syncPayload,
          primaryKey: matchId,
        });
      },

      // -- 8-ball scoring ---------------------------------------------------

      addEightBallRack: (matchId, rack) => {
        const current = get().eightBallState[matchId];
        if (!current) return;

        const updated = addEightBallRack(current, rack);

        set((state) => ({
          eightBallState: { ...state.eightBallState, [matchId]: updated },
        }));

        // Enqueue the rack to sync
        const newRack = updated.racks[updated.racks.length - 1];
        addToQueue({
          table: 'eight_ball_racks',
          type: 'insert',
          data: {
            individual_match_id: matchId,
            rack_number: newRack.rackNumber,
            won_by: newRack.wonBy,
            is_break_and_run: newRack.isBreakAndRun,
            is_eight_on_break: newRack.isEightOnBreak,
            dead_rack: newRack.deadRack,
          },
          primaryKey: `${matchId}_rack_${newRack.rackNumber}`,
        });

        // If the match just completed, sync the final score
        if (updated.isCompleted && !current.isCompleted) {
          addToQueue({
            table: 'individual_matches',
            type: 'update',
            data: {
              id: matchId,
              is_completed: true,
              home_games_won: updated.homeGamesWon,
              away_games_won: updated.awayGamesWon,
            },
            primaryKey: matchId,
          });
        }
      },

      removeLastEightBallRack: (matchId) => {
        const current = get().eightBallState[matchId];
        if (!current || current.racks.length === 0) return;

        const removedRack = current.racks[current.racks.length - 1];

        // Recalculate games won without the last rack
        let homeGamesWon = 0;
        let awayGamesWon = 0;
        const remainingRacks = current.racks.slice(0, -1);

        for (const r of remainingRacks) {
          if (!r.deadRack) {
            if (r.wonBy === 'home') homeGamesWon++;
            else if (r.wonBy === 'away') awayGamesWon++;
          }
        }

        const updated: EightBallMatch = {
          ...current,
          racks: remainingRacks,
          homeGamesWon,
          awayGamesWon,
          isCompleted: false, // Removing a rack always un-completes
        };

        set((state) => ({
          eightBallState: { ...state.eightBallState, [matchId]: updated },
        }));

        addToQueue({
          table: 'eight_ball_racks',
          type: 'delete',
          data: {},
          primaryKey: `${matchId}_rack_${removedRack.rackNumber}`,
        });
      },

      updateEightBallInnings: (matchId, innings) => {
        const current = get().eightBallState[matchId];
        if (!current) return;

        const updated: EightBallMatch = { ...current, innings };

        set((state) => ({
          eightBallState: { ...state.eightBallState, [matchId]: updated },
        }));

        addToQueue({
          table: 'individual_matches',
          type: 'update',
          data: { id: matchId, innings },
          primaryKey: matchId,
        });
      },

      updateEightBallDefensiveShots: (matchId, shots) => {
        const current = get().eightBallState[matchId];
        if (!current) return;

        const updated: EightBallMatch = { ...current, defensiveShots: shots };

        set((state) => ({
          eightBallState: { ...state.eightBallState, [matchId]: updated },
        }));

        addToQueue({
          table: 'individual_matches',
          type: 'update',
          data: { id: matchId, defensive_shots: shots },
          primaryKey: matchId,
        });
      },

      // -- 9-ball scoring ---------------------------------------------------

      addNineBallRack: (matchId, rack) => {
        const current = get().nineBallState[matchId];
        if (!current) return;

        const updated = addNineBallRack(current, rack);

        set((state) => ({
          nineBallState: { ...state.nineBallState, [matchId]: updated },
        }));

        // Enqueue the rack to sync
        const newRack = updated.racks[updated.racks.length - 1];
        addToQueue({
          table: 'nine_ball_racks',
          type: 'insert',
          data: {
            individual_match_id: matchId,
            rack_number: newRack.rackNumber,
            balls_pocketed_home: newRack.ballsPocketedHome,
            balls_pocketed_away: newRack.ballsPocketedAway,
            dead_balls: newRack.deadBalls,
            points_home: newRack.pointsHome,
            points_away: newRack.pointsAway,
            is_break_and_run: newRack.isBreakAndRun,
          },
          primaryKey: `${matchId}_rack_${newRack.rackNumber}`,
        });

        // If the match just completed, sync the final score
        if (updated.isCompleted && !current.isCompleted) {
          addToQueue({
            table: 'individual_matches',
            type: 'update',
            data: {
              id: matchId,
              is_completed: true,
              home_points_total: updated.homePointsTotal,
              away_points_total: updated.awayPointsTotal,
            },
            primaryKey: matchId,
          });
        }
      },

      removeLastNineBallRack: (matchId) => {
        const current = get().nineBallState[matchId];
        if (!current || current.racks.length === 0) return;

        const removedRack = current.racks[current.racks.length - 1];

        // Recalculate points without the last rack
        const remainingRacks = current.racks.slice(0, -1);
        let homePointsTotal = 0;
        let awayPointsTotal = 0;

        for (const r of remainingRacks) {
          homePointsTotal += r.pointsHome;
          awayPointsTotal += r.pointsAway;
        }

        const updated: NineBallMatch = {
          ...current,
          racks: remainingRacks,
          homePointsTotal,
          awayPointsTotal,
          isCompleted: false, // Removing a rack always un-completes
        };

        set((state) => ({
          nineBallState: { ...state.nineBallState, [matchId]: updated },
        }));

        addToQueue({
          table: 'nine_ball_racks',
          type: 'delete',
          data: {},
          primaryKey: `${matchId}_rack_${removedRack.rackNumber}`,
        });
      },

      updateNineBallInnings: (matchId, innings) => {
        const current = get().nineBallState[matchId];
        if (!current) return;

        const updated: NineBallMatch = { ...current, innings };

        set((state) => ({
          nineBallState: { ...state.nineBallState, [matchId]: updated },
        }));

        addToQueue({
          table: 'individual_matches',
          type: 'update',
          data: { id: matchId, innings },
          primaryKey: matchId,
        });
      },

      updateNineBallDefensiveShots: (matchId, shots) => {
        const current = get().nineBallState[matchId];
        if (!current) return;

        const updated: NineBallMatch = { ...current, defensiveShots: shots };

        set((state) => ({
          nineBallState: { ...state.nineBallState, [matchId]: updated },
        }));

        addToQueue({
          table: 'individual_matches',
          type: 'update',
          data: { id: matchId, defensive_shots: shots },
          primaryKey: matchId,
        });
      },
    }),
    {
      name: 'match-store',
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
