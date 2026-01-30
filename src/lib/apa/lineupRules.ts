// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineupPlayer {
  playerId: string;
  name: string;
  skillLevel: number;
}

export interface LineupValidation {
  isValid: boolean;
  totalSkillLevel: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum combined skill level allowed for a 5-player lineup. */
const MAX_TOTAL_SKILL = 23;

/** Required number of players in a lineup. */
const REQUIRED_PLAYER_COUNT = 5;

/** Minimum valid skill level (8-ball low end). */
const MIN_SKILL_LEVEL = 1;

/** Maximum valid skill level (9-ball high end). */
const MAX_SKILL_LEVEL = 9;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Calculate the sum of skill levels for a list of players.
 */
export function calculateTotalSkill(players: LineupPlayer[]): number {
  return players.reduce((total, player) => total + player.skillLevel, 0);
}

/**
 * Validate an APA league lineup.
 *
 * Rules enforced:
 * 1. Exactly 5 players must be in the lineup.
 * 2. Total skill level must not exceed 23.
 * 3. No duplicate players (by `playerId`).
 * 4. All players must have a valid skill level (1-9).
 */
export function validateLineup(players: LineupPlayer[]): LineupValidation {
  const errors: string[] = [];

  // --- Rule 1: exactly 5 players -------------------------------------------
  if (players.length !== REQUIRED_PLAYER_COUNT) {
    errors.push(
      `Lineup must have exactly ${REQUIRED_PLAYER_COUNT} players, but has ${players.length}.`,
    );
  }

  // --- Rule 2: total skill level cap ---------------------------------------
  const totalSkillLevel = calculateTotalSkill(players);
  if (totalSkillLevel > MAX_TOTAL_SKILL) {
    errors.push(
      `Total skill level (${totalSkillLevel}) exceeds the maximum of ${MAX_TOTAL_SKILL}.`,
    );
  }

  // --- Rule 3: no duplicate players ----------------------------------------
  const seen = new Set<string>();
  for (const player of players) {
    if (seen.has(player.playerId)) {
      errors.push(`Duplicate player detected: ${player.name} (${player.playerId}).`);
    }
    seen.add(player.playerId);
  }

  // --- Rule 4: valid skill levels ------------------------------------------
  for (const player of players) {
    if (
      !Number.isInteger(player.skillLevel) ||
      player.skillLevel < MIN_SKILL_LEVEL ||
      player.skillLevel > MAX_SKILL_LEVEL
    ) {
      errors.push(
        `Player ${player.name} has an invalid skill level (${player.skillLevel}). ` +
          `Must be an integer between ${MIN_SKILL_LEVEL} and ${MAX_SKILL_LEVEL}.`,
      );
    }
  }

  return {
    isValid: errors.length === 0,
    totalSkillLevel,
    errors,
  };
}
