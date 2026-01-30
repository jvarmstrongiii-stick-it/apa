import { EIGHT_BALL_RACE_CHART } from '../../constants/raceChart';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EightBallRack {
  rackNumber: number;
  wonBy: 'home' | 'away' | null;
  isBreakAndRun: boolean;
  isEightOnBreak: boolean;
  deadRack: boolean;
}

export interface EightBallMatch {
  homeSkill: number;
  awaySkill: number;
  homeRaceTo: number;
  awayRaceTo: number;
  homeGamesWon: number;
  awayGamesWon: number;
  racks: EightBallRack[];
  innings: number;
  defensiveShots: number;
  isCompleted: boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Look up the race-to-win values for a given player skill level versus an
 * opponent skill level using the official APA 8-ball race chart.
 */
export function getRaceToWin(
  playerSkill: number,
  opponentSkill: number,
): { playerRace: number; opponentRace: number } {
  const key = `${playerSkill}-${opponentSkill}`;
  const entry = EIGHT_BALL_RACE_CHART[key];

  if (!entry) {
    throw new Error(
      `No race chart entry found for player skill ${playerSkill} vs opponent skill ${opponentSkill}. ` +
        'Valid 8-ball skill levels are 2-7.',
    );
  }

  return { playerRace: entry.playerRace, opponentRace: entry.opponentRace };
}

/**
 * Create a new 8-ball match initialised with the correct race values derived
 * from both players' skill levels.
 */
export function createEightBallMatch(
  homeSkill: number,
  awaySkill: number,
): EightBallMatch {
  const { playerRace, opponentRace } = getRaceToWin(homeSkill, awaySkill);

  return {
    homeSkill,
    awaySkill,
    homeRaceTo: playerRace,
    awayRaceTo: opponentRace,
    homeGamesWon: 0,
    awayGamesWon: 0,
    racks: [],
    innings: 0,
    defensiveShots: 0,
    isCompleted: false,
  };
}

/**
 * Add a rack to an 8-ball match. Returns a new match object (immutable
 * update). The rack number is assigned automatically. After adding the rack
 * the match completion status is re-evaluated.
 */
export function addRack(
  match: EightBallMatch,
  rack: Omit<EightBallRack, 'rackNumber'>,
): EightBallMatch {
  if (match.isCompleted) {
    throw new Error('Cannot add a rack to a completed match.');
  }

  const rackNumber = match.racks.length + 1;
  const newRack: EightBallRack = { ...rack, rackNumber };

  let homeGamesWon = match.homeGamesWon;
  let awayGamesWon = match.awayGamesWon;

  if (!rack.deadRack) {
    if (rack.wonBy === 'home') {
      homeGamesWon += 1;
    } else if (rack.wonBy === 'away') {
      awayGamesWon += 1;
    }
  }

  const updatedMatch: EightBallMatch = {
    ...match,
    racks: [...match.racks, newRack],
    homeGamesWon,
    awayGamesWon,
  };

  updatedMatch.isCompleted = checkMatchComplete(updatedMatch);

  return updatedMatch;
}

/**
 * Check whether the match is complete — i.e. either the home or away player
 * has reached their required number of games (their race).
 */
export function checkMatchComplete(match: EightBallMatch): boolean {
  return (
    match.homeGamesWon >= match.homeRaceTo ||
    match.awayGamesWon >= match.awayRaceTo
  );
}

/**
 * Calculate points earned by each player in an 8-ball match.
 *
 * APA 8-ball individual match scoring:
 * - The winner earns points equal to their race-to value.
 * - The loser earns points equal to the number of games they actually won.
 *
 * If the match is not yet completed both players simply receive their current
 * games-won totals.
 */
export function calculatePoints(match: EightBallMatch): {
  homePoints: number;
  awayPoints: number;
} {
  if (!match.isCompleted) {
    return {
      homePoints: match.homeGamesWon,
      awayPoints: match.awayGamesWon,
    };
  }

  const homeWon = match.homeGamesWon >= match.homeRaceTo;

  if (homeWon) {
    return {
      homePoints: match.homeRaceTo,
      awayPoints: match.awayGamesWon,
    };
  }

  // Away won
  return {
    homePoints: match.homeGamesWon,
    awayPoints: match.awayRaceTo,
  };
}
