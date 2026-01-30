// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchState =
  | 'scheduled'
  | 'lineup_set'
  | 'in_progress'
  | 'completed'
  | 'finalized'
  | 'disputed';

export interface MatchTransition {
  from: MatchState;
  to: MatchState;
  guard?: string;
}

// ---------------------------------------------------------------------------
// Transition Table
// ---------------------------------------------------------------------------

/**
 * All valid state transitions for an APA team match.
 */
const TRANSITIONS: MatchTransition[] = [
  { from: 'scheduled', to: 'lineup_set' },
  { from: 'lineup_set', to: 'in_progress' },
  { from: 'in_progress', to: 'completed' },
  { from: 'completed', to: 'finalized' },
  { from: 'finalized', to: 'disputed' },
  { from: 'finalized', to: 'in_progress', guard: 'admin_reopen' },
  { from: 'disputed', to: 'finalized', guard: 'resolve' },
  { from: 'disputed', to: 'in_progress', guard: 'reopen_for_correction' },
];

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Determine whether a transition from one match state to another is allowed.
 */
export function canTransition(from: MatchState, to: MatchState): boolean {
  return TRANSITIONS.some(
    (transition) => transition.from === from && transition.to === to,
  );
}

/**
 * Return the list of states that can be reached from the given current state.
 */
export function getNextStates(current: MatchState): MatchState[] {
  return TRANSITIONS
    .filter((transition) => transition.from === current)
    .map((transition) => transition.to);
}
