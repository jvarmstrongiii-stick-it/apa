import { NINE_BALL_POINT_TARGETS } from '../../constants/raceChart';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NineBallRack {
  rackNumber: number;
  /** Ball numbers (1-9) pocketed by the home player this rack. */
  ballsPocketedHome: number[];
  /** Ball numbers (1-9) pocketed by the away player this rack. */
  ballsPocketedAway: number[];
  /** Ball numbers that were dead (not credited to either player). */
  deadBalls: number[];
  /** Calculated points scored by home in this rack. */
  pointsHome: number;
  /** Calculated points scored by away in this rack. */
  pointsAway: number;
  isBreakAndRun: boolean;
}

export interface NineBallMatch {
  homeSkill: number;
  awaySkill: number;
  homePointTarget: number;
  awayPointTarget: number;
  homePointsTotal: number;
  awayPointsTotal: number;
  racks: NineBallRack[];
  innings: number;
  defensiveShots: number;
  isCompleted: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the point value of a single ball.
 *
 * APA 9-ball scoring: balls 1-8 are each worth 1 point; the 9-ball is worth
 * 2 points. This gives a total of 10 points per rack.
 */
function ballPointValue(ball: number): number {
  if (ball < 1 || ball > 9) {
    throw new Error(`Invalid ball number: ${ball}. Must be between 1 and 9.`);
  }
  return ball === 9 ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Look up the point target (points needed to win) for a given skill level
 * using the official APA 9-ball point target chart.
 */
export function getPointTarget(skillLevel: number): number {
  const target = NINE_BALL_POINT_TARGETS[skillLevel];

  if (target === undefined) {
    throw new Error(
      `No point target found for skill level ${skillLevel}. ` +
        'Valid 9-ball skill levels are 1-9.',
    );
  }

  return target;
}

/**
 * Create a new 9-ball match initialised with the correct point targets
 * derived from both players' skill levels.
 */
export function createNineBallMatch(
  homeSkill: number,
  awaySkill: number,
): NineBallMatch {
  return {
    homeSkill,
    awaySkill,
    homePointTarget: getPointTarget(homeSkill),
    awayPointTarget: getPointTarget(awaySkill),
    homePointsTotal: 0,
    awayPointsTotal: 0,
    racks: [],
    innings: 0,
    defensiveShots: 0,
    isCompleted: false,
  };
}

/**
 * Calculate the points scored in a single rack by each player.
 *
 * Each ball 1-8 is worth 1 point; the 9-ball is worth 2 points.
 */
export function calculateRackPoints(rack: NineBallRack): {
  home: number;
  away: number;
} {
  const home = rack.ballsPocketedHome.reduce(
    (sum, ball) => sum + ballPointValue(ball),
    0,
  );
  const away = rack.ballsPocketedAway.reduce(
    (sum, ball) => sum + ballPointValue(ball),
    0,
  );

  return { home, away };
}

/**
 * Add a rack to a 9-ball match. Returns a new match object (immutable
 * update). The rack number and per-rack point totals are calculated
 * automatically. After adding the rack the match completion status is
 * re-evaluated.
 */
export function addRack(
  match: NineBallMatch,
  rack: Omit<NineBallRack, 'rackNumber' | 'pointsHome' | 'pointsAway'>,
): NineBallMatch {
  if (match.isCompleted) {
    throw new Error('Cannot add a rack to a completed match.');
  }

  const rackNumber = match.racks.length + 1;

  // Build a temporary rack so we can calculate points.
  const tempRack: NineBallRack = {
    ...rack,
    rackNumber,
    pointsHome: 0,
    pointsAway: 0,
  };

  const { home, away } = calculateRackPoints(tempRack);

  const newRack: NineBallRack = {
    ...tempRack,
    pointsHome: home,
    pointsAway: away,
  };

  const homePointsTotal = match.homePointsTotal + home;
  const awayPointsTotal = match.awayPointsTotal + away;

  const updatedMatch: NineBallMatch = {
    ...match,
    racks: [...match.racks, newRack],
    homePointsTotal,
    awayPointsTotal,
  };

  updatedMatch.isCompleted = checkMatchComplete(updatedMatch);

  return updatedMatch;
}

/**
 * Check whether the match is complete — i.e. either the home or away player
 * has reached their point target.
 */
export function checkMatchComplete(match: NineBallMatch): boolean {
  return (
    match.homePointsTotal >= match.homePointTarget ||
    match.awayPointsTotal >= match.awayPointTarget
  );
}
