/**
 * APA 8-Ball Race Chart
 *
 * Key format: `${playerSkill}-${opponentSkill}`
 * Values: how many games each player needs to win (their "race").
 */
export const EIGHT_BALL_RACE_CHART: Record<
  string,
  { playerRace: number; opponentRace: number }
> = {
  // SL2 vs ...
  '2-2': { playerRace: 2, opponentRace: 2 },
  '2-3': { playerRace: 2, opponentRace: 3 },
  '2-4': { playerRace: 2, opponentRace: 4 },
  '2-5': { playerRace: 2, opponentRace: 5 },
  '2-6': { playerRace: 2, opponentRace: 6 },
  '2-7': { playerRace: 2, opponentRace: 7 },

  // SL3 vs ...
  '3-2': { playerRace: 3, opponentRace: 2 },
  '3-3': { playerRace: 2, opponentRace: 2 },
  '3-4': { playerRace: 2, opponentRace: 3 },
  '3-5': { playerRace: 2, opponentRace: 4 },
  '3-6': { playerRace: 2, opponentRace: 5 },
  '3-7': { playerRace: 2, opponentRace: 6 },

  // SL4 vs ...
  '4-2': { playerRace: 4, opponentRace: 2 },
  '4-3': { playerRace: 3, opponentRace: 2 },
  '4-4': { playerRace: 3, opponentRace: 3 },
  '4-5': { playerRace: 3, opponentRace: 4 },
  '4-6': { playerRace: 2, opponentRace: 5 },
  '4-7': { playerRace: 2, opponentRace: 6 },

  // SL5 vs ...
  '5-2': { playerRace: 5, opponentRace: 2 },
  '5-3': { playerRace: 4, opponentRace: 2 },
  '5-4': { playerRace: 4, opponentRace: 3 },
  '5-5': { playerRace: 4, opponentRace: 4 },
  '5-6': { playerRace: 3, opponentRace: 5 },
  '5-7': { playerRace: 3, opponentRace: 6 },

  // SL6 vs ...
  '6-2': { playerRace: 6, opponentRace: 2 },
  '6-3': { playerRace: 5, opponentRace: 2 },
  '6-4': { playerRace: 5, opponentRace: 2 },
  '6-5': { playerRace: 5, opponentRace: 3 },
  '6-6': { playerRace: 4, opponentRace: 4 },
  '6-7': { playerRace: 4, opponentRace: 5 },

  // SL7 vs ...
  '7-2': { playerRace: 7, opponentRace: 2 },
  '7-3': { playerRace: 6, opponentRace: 2 },
  '7-4': { playerRace: 6, opponentRace: 2 },
  '7-5': { playerRace: 6, opponentRace: 3 },
  '7-6': { playerRace: 5, opponentRace: 4 },
  '7-7': { playerRace: 5, opponentRace: 5 },
};

/**
 * APA 9-Ball Point Targets
 *
 * Maps skill level (1-9) to the number of points a player needs to reach
 * in order to win a 9-ball match.
 */
export const NINE_BALL_POINT_TARGETS: Record<number, number> = {
  1: 14,
  2: 19,
  3: 25,
  4: 31,
  5: 38,
  6: 46,
  7: 55,
  8: 65,
  9: 75,
};
