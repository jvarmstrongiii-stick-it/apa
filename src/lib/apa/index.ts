// APA game logic – barrel export
export {
  EIGHT_BALL_RACE_CHART,
  NINE_BALL_POINT_TARGETS,
} from '../../constants/raceChart';

export {
  getRaceToWin,
  createEightBallMatch,
  addRack as addEightBallRack,
  checkMatchComplete as checkEightBallMatchComplete,
  calculatePoints,
} from './eightBall';

export type { EightBallRack, EightBallMatch } from './eightBall';

export {
  getPointTarget,
  createNineBallMatch,
  calculateRackPoints,
  addRack as addNineBallRack,
  checkMatchComplete as checkNineBallMatchComplete,
} from './nineBall';

export type { NineBallRack, NineBallMatch } from './nineBall';

export {
  validateLineup,
  calculateTotalSkill,
} from './lineupRules';

export type { LineupPlayer, LineupValidation } from './lineupRules';

export {
  canTransition,
  getNextStates,
} from './matchStateMachine';

export type { MatchState, MatchTransition } from './matchStateMachine';
