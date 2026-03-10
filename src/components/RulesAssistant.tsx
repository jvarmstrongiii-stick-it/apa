import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeModules } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase/client';

// expo-speech-recognition requires a custom dev client — not available in Expo Go.
// Gracefully degrade: mic button is hidden when the native module isn't linked.
const SPEECH_AVAILABLE = !!NativeModules.ExpoSpeechRecognition;

let ExpoSpeechRecognitionModule: {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (opts: { lang: string; interimResults: boolean }) => void;
  stop: () => void;
} | null = null;

// No-op fallback so the hook call inside the component is always stable
let useSpeechRecognitionEvent: (
  event: 'result' | 'end' | 'error',
  handler: (e: any) => void
) => void = () => {};

if (SPEECH_AVAILABLE) {
  const speech = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = speech.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = speech.useSpeechRecognitionEvent;
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#0f0f0f',
  bgDark: '#0a0a0a',
  surface: '#1a1a1a',
  surfaceAlt: '#141414',
  border: '#252525',
  borderWarm: '#3a2a1a',
  borderBrown: '#2a1a0a',
  headerBg1: '#1a0a00',
  headerBg2: '#2d1500',
  userBubble1: '#3d1f00',
  userBubble2: '#5a2e00',
  userBubbleBorder: '#8B4513',
  userText: '#f0e0c0',
  assistantText: '#d0c8b8',
  gold: '#D4AF37',
  brown: '#8B4513',
  brownDim: '#8B7355',
  brownDark: '#5a2e00',
  proofBg1: '#0d1a0d',
  proofBg2: '#111811',
  proofBorder: '#2a4a2a',
  proofText: '#b8c8b0',
  proofFooter: '#4a6a4a',
  chipText: '#806040',
  iconBg: '#2d1500',
  white: '#e8e0d0',
  dimText: '#333',
  disabledSend: '#1a1a1a',
};

// ─── Rulebook text ─────────────────────────────────────────────────────────────
const RULEBOOK_TEXT = `RULE 1. LAGGING: Both players lag simultaneously. Ball stopping closest to head rail wins. Re-lag if balls contact each other, both fail to strike foot rail, or ball stops in jaw of pocket. Failure to strike foot rail, striking side rail, or any pocket = loss of lag. Winner of lag breaks first game; winner of each rack breaks next.

RULE 2. RACKING: All balls frozen (touching) as tightly as possible. Racked by non-breaking player with head ball on foot spot. Breaking player may request rerack. Loser of lag and/or any subsequent game racks for opponent. 8-Ball: All 15 balls are racked in a triangle, with the 8-ball in the center. The remaining balls can be placed in any order. 9-Ball: The balls numbered 1 through 9 are racked in a diamond shape. The 1-ball is placed at the front of the diamond, the 9-ball in the center. The remaining object balls can be placed in any order.

RULE 3. BREAKING: The rack must be struck before a foul can occur. A player must break from behind the head string for the break to be considered legal; in addition, at least four object balls must be driven to the rails or an object ball must be pocketed. The cue ball may not be shot into a rail before hitting the rack. Breaking safe or soft is not allowed. Make a note on the scoresheet if you observe a player breaking safe or soft. Local League Management may issue penalties to teams and players who are not breaking hard. Breaking just hard enough to comply with this rule is not a guarantee against penalties. Break as hard as you can while maintaining control. If the rack is struck, but the break does not qualify as legal, the balls are reracked by the non-breaking player and rebroken by the same breaking player. If the rack is struck, but the break does not qualify as legal and results in a scratch, the balls are reracked and broken by the opposite player. 8-Ball: The head ball or the second row of balls must be struck first. Failure to strike the head ball or second row of balls does not result in a foul. 9-Ball: The 1-ball must be struck first. Failure to strike the 1-ball first does not result in a foul.

RULE 4. AFTER THE BREAK — 8-Ball: (a) If a scratch occurs on the break, the opponent receives ball-in-hand, which must be executed from behind the head string, shooting at a ball that is outside the head string. (b) If the 8-ball is pocketed on the break, it is a win unless the player fouls the cue ball, in which case it is a loss. (c) If one or more object balls from one category are pocketed on the break, that becomes the shooter's category of balls. (d) If balls from each category are pocketed on the break, it is still an open table. The breaker has the option to shoot any ball except the 8-ball (which would be a foul); any ball pocketed without fouling counts. NOTE: During an open table, a player can shoot a combination involving stripes and solids; the legally pocketed ball will determine their category of balls for the remainder of the game. The 8-ball may not be used as the first ball in a combination shot, as it is never neutral. 9-Ball: (a) A foul on a legal break will result in ball-in-hand for the opponent anywhere on the table. Pocketed balls, if any, stay down (are not spotted), except the 9-ball. (b) If the 9-ball is pocketed on the break, this is a win unless the player scratches, in which case the 9-ball is spotted and the turn passes to the opponent. (c) If one or more balls are pocketed on the break, it is still the breaker's turn. NOTE: Push-outs are not allowed in APA handicapped competition.

RULE 5. SHOOTING WRONG BALLS: Occasionally, a player will foul by mistakenly shooting the wrong category of balls (in 8-Ball) or the wrong numbered ball (in 9-Ball). The shooter may avoid a foul by asking the opponent which ball or category of balls they should be shooting. If asked, the opponent must answer honestly. If the shooter hits the wrong ball, a foul occurs as soon as the wrong ball is struck, regardless of whether the ball is pocketed or not. NOTE: If a foul is not called before the shooter takes a subsequent shot and makes legal contact with a ball of their actual category (in 8-Ball) or the lowest numbered object ball on the table (in 9-Ball), it is too late to call the foul.

RULE 6. COMBINATION SHOTS: Combination shots are legal, but striking the correct ball first is required. 8-Ball: The 8-ball may not be contacted first. If a player does not pocket one of their balls, but pockets an opponent's ball, they lose their turn. No pocketed ball is spotted. 9-Ball: The lowest numbered ball on the table must be struck first. A player is credited with all balls they legally pocket after striking the lowest numbered ball on the table.

RULE 7. POCKETED BALLS: Balls must remain in a pocket to be legal. If any ball, including the cue ball, goes in a pocket, but bounces back onto the playing surface, it is not considered pocketed and must be played from where it lies. The shooter does not need to designate their intended ball or pocket during the shot, except when they are legally shooting the 8-ball. NOTE 1: Once a ball has stopped all motion, it cannot move again without outside forces affecting it. Therefore, if a ball which has been hanging in a pocket for more than a few seconds suddenly drops, it is to be placed back on the table where it was originally sitting. NOTE 2: If two balls become jammed in a pocket and are leaning off the edge of the slate to some degree, they are deemed pocketed.

RULE 8. BALLS ON THE FLOOR: Object balls that get knocked off the playing surface will be spotted on the foot spot. If the foot spot is taken, the ball will be placed directly behind the foot spot, as close to the foot spot as possible. If two or more balls are knocked on the floor, they are placed in numerical order with the lowest numbered ball closest to the foot spot. Spotted balls are placed frozen to one another. 8-Ball: It might occur that a player legally pockets a ball while simultaneously knocking some other ball(s) on the floor. In this situation, it is still their turn and the ball(s) is/are not spotted until their turn ends. If the ball on the floor is one of the shooter's balls, it is spotted when the shooter has pocketed all of their other balls. If it is the 8-ball that is knocked on the floor, the shooter loses the game. 9-Ball: Balls that get knocked off the playing surface will be immediately spotted on the foot spot. The 9-ball is spotted: (a) Anytime it is knocked off the table other than when it is pocketed. (b) Anytime it is pocketed and the shooter scratches or otherwise fouls.

RULE 9. ACCIDENTALLY MOVED BALLS: Accidentally moved balls must be replaced, unless any of the accidentally moved balls make contact with the cue ball. If accidentally moved balls make contact with the cue ball, it is a ball-in-hand foul, and no balls get replaced. If the accidental movement occurs between shots, the ball must be replaced by the opponent before the shot is taken. If the accidental movement occurs during a shot, all balls accidentally moved must be replaced by the opponent after the shot is over and all balls have stopped rolling.

RULE 10. CLOSE HITS: Potential bad hit situations are usually fairly obvious. Disputes over these situations can almost always be avoided by having a third party, agreed upon by both shooters, watch the shot. The shooter is required to stop if their opponent wants the shot watched. Once an agreed upon third party is asked to watch the shot, the third party's call will stand and cannot be disputed. In general, the shooter has the advantage in close hit situations. If the outside party cannot determine which ball was struck first, such as a simultaneous hit, the call goes to the shooter.

RULE 11. ONE FOOT ON THE FLOOR: When a bridge is available, at least one foot must be on the floor while shooting. Failure to keep at least one foot on the floor is not a foul, but may result in a sportsmanship violation. A team that carries their own bridge may only use it if they are willing to share it with the opposing team since refusing to do so would provide an unfair advantage.

RULE 12. MARKING THE TABLE: No one is allowed to mark the cloth in any way, including, but not limited to, using chalk to draw a line or wetting a finger to dampen the cloth. Teams may be subject to sportsmanship violations for marking the cloth. It is permissible to set a piece of chalk on the hard surface of the rail.

RULE 13. STALEMATES: In the unlikely event that a game should become stalemated, meaning that neither player can, or wants to, make use of ball-in-hand, the balls are reracked and the player that had the break at the start of the stalemated game breaks again. A game shall be considered a stalemate when both players or teams agree. 8-Ball: Put an X across the entire game box. The innings and Defensive Shots for the stalemated game do not count. 9-Ball: The game ends but the points earned stand. The innings and Defensive Shots remain and all balls left on the table are marked as dead balls.

RULE 14. FROZEN BALLS: A frozen ball is a ball that is touching either another ball or a rail. In order for the frozen ball rule to be in effect, the ball must be declared frozen and verified as such by the shooter and their opponent. Object ball frozen to a rail: To make a legal shot, after contacting a ball that is frozen to a rail, the shooter must either: (1) Drive the cue ball to any rail after the cue ball touches the frozen ball; (2) Drive the frozen ball to another rail or into a pocket; (3) Drive the frozen ball away from the rail and into another ball which, in turn, causes the frozen ball to hit any rail or go into a pocket, or causes the other ball to hit any rail or go into a pocket. Cue ball frozen to your own object ball (8-Ball) or lowest ball in the rotation (9-Ball): Shooting the cue ball towards, or partly into the frozen ball, thereby making the ball move by such a shot, constitutes legal contact. Shooting the cue ball away from the frozen ball does not constitute legal contact. Cue ball frozen to your opponent's object ball (8-Ball) or non-lowest ball in the rotation (9-Ball): You must shoot away from the opponent's frozen object ball. If the shooter shoots towards, or partly into the frozen ball, thereby making the frozen ball move by such a shot, it constitutes illegal contact and it is a foul.

RULE 15. FOULS: If any of the following fouls are committed, the penalty is ball-in-hand for the opposing player. Ball-in-hand is the advantage given to a player when their opponent scratches or otherwise fouls, whereupon the player may place the cue ball anywhere on the playing surface. EXCEPTION: In 8-Ball, a scratch on the break requires the ball-in-hand to be executed from behind the head string and contact made with a ball outside the head string. Only the player or the Team Captain may officially call a foul. NOTE: A foul that is not called when it occurs cannot be called once the next shot has been taken. The ball-in-hand fouls are: (a) If the cue ball goes in a pocket, on the floor, or otherwise ends up off the playing surface. (b) Failure to hit the correct ball first. (c) Failure to hit a rail or pocket a ball after contact. A rail must be struck by either the cue ball or any other ball after the cue ball contacts the object ball. (d) If, after contacting a ball that is frozen to a rail, the shooter fails to meet frozen ball requirements. (e) Intentionally scooping the cue ball over another ball. (f) Receiving advice regarding game strategy from a fellow player, other than your designated coach, during a time-out. (g) Touching or causing the cue ball to move, outside of a ball-in-hand situation. (h) Altering the course of a moving cue ball, including a double-hit. (i) Anytime the cue ball makes contact with an accidentally moved ball. (j) The cue ball does not touch any object ball during the course of a shot. (k) Touching another ball on the table, while placing or adjusting the position of the cue ball, during a ball-in-hand.

RULE 16. HOW TO WIN — 8-Ball: (a) You pocket all the balls of your category and legally pocket the 8-ball in a properly marked pocket. (b) Your opponent pockets the 8-ball out-of-turn or knocks the 8-ball on the floor. (c) Your opponent pockets the 8-ball in the wrong pocket. (d) Your opponent fails to properly mark the pocket where the 8-ball is pocketed, and you call loss of game. (e) Your opponent fouls the cue ball and pockets the 8-ball. (f) Your opponent alters the course of the 8-ball or the cue ball in an attempt to prevent a loss. (g) Your opponent scratches or knocks the cue ball off the table when playing the 8-ball. NOTE 1: If your opponent is shooting at the 8-ball and misses it altogether, commonly referred to as a table scratch, they have fouled and you receive ball-in-hand. You do not win because of this foul. NOTE 2: You may not play the 8-ball at the same time you play the last ball of your category. The 8-ball must be pocketed through a separate shot. If you pocket the 8-ball at the same time you pocket the last ball of your category, you lose the game. Marking the pocket: A coaster or some other reasonable marker must be placed next to the shooter's intended pocket. Marking the pocket with chalk is not recommended. Both players may use the same marker. Only one marker should remain on the table at a time. Contacting a pocket marker with the 8-ball is not a foul and the shot stands. 9-Ball: You legally pocket the 9-ball.

TEAM MANUAL — 23-RULE: The total combined skill levels of the five players fielded on a match night cannot exceed 23.
TEAM MANUAL — 19-RULE: If only four players are available, their combined skill levels cannot exceed 19.
TEAM MANUAL — SKILL LEVELS: 8-Ball SL 2–7; 9-Ball SL 1–9. Not established until 10 match scores on record.
TEAM MANUAL — TIMEOUTS: Any member of the shooting team can call a timeout, but only the designated coach may approach the table. The coach may consult teammates before approaching. Skill Levels 1-3 receive two timeouts per game; Skill Levels 4-7 receive one. If a teammate calls a timeout it is charged to the team even if the player disagrees. If the player requests a timeout and the coach refuses, no timeout is charged. The coach may place the cue ball during ball-in-hand. Only the coach and player may be at the table during a timeout. Exception: if the shooting player voluntarily walks away from the table and is clearly not in the vicinity of the coaching conversation, the coach may invite one additional teammate to the table to discuss. Once the shooting player returns, only the designated coach may remain. No timeouts are allowed in Masters Division.`;

// ─── System prompts ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert on the American Poolplayers Association (APA) official rules. Answer questions based ONLY on the official APA Game Rules Booklet (Copyright 2023). Be clear, accurate, and cite specific rule numbers when possible. Keep answers concise but complete.

GENERAL DESCRIPTION:
8-Ball is played with a cue ball and 15 object balls. Players must pocket either solids (1-7) or stripes (9-15), then pocket the 8-ball. Category is determined when first ball is legally pocketed. In League play, the 8-ball must be pocketed in a marked pocket.
9-Ball: rotation game, must strike lowest numbered ball first. Balls 1-8 worth 1 point, 9-ball worth 2 points in League play.

RULE 1. LAGGING: Both players lag simultaneously. Closest to head rail wins. Re-lag if balls contact, both miss foot rail, or ball jaws. Winner of lag breaks first; winner of each rack breaks next.
RULE 2. RACKING: Non-breaking player racks, head ball on foot spot. Breaker may request rerack. Loser racks. 8-Ball: triangle, 8-ball center. 9-Ball: diamond, 1-ball front, 9-ball center.
RULE 3. BREAKING: From behind head string. 4 balls to rails OR 1 ball pocketed. Cue ball cannot hit rail first. No soft/safe breaks. Illegal break (no scratch): rerack, same player. Illegal break + scratch: rerack, other player.
RULE 4. AFTER BREAK — 8-Ball: Scratch = ball-in-hand behind head string. 8-ball pocketed = WIN (scratch = LOSS). One category pocketed = breaker's category. Mixed = open table. Open table: shoot anything except 8-ball; 8-ball never neutral in combos. 9-Ball: Foul = ball-in-hand anywhere. 9-ball pocketed = WIN (scratch = spotted + turn passes). No push-outs in APA handicapped play.
RULE 5. WRONG BALLS: Foul when wrong ball struck. Ask opponent if unsure; they must answer honestly. Can't call foul after next legal shot.
RULE 6. COMBINATIONS: Legal if correct ball first. 8-Ball: 8-ball never first; pocketing opponent's ball = loss of turn. 9-Ball: lowest ball must be first.
RULE 7. POCKETED BALLS: Must stay in pocket. Bouncing out = not pocketed. Designate pocket only when shooting 8-ball. Ball hanging then dropping = placed back.
RULE 8. BALLS ON FLOOR: Spotted at foot spot. 8-Ball: spotted when turn ends; 8-ball on floor = LOSS. 9-Ball: immediately spotted.
RULE 9. ACCIDENTALLY MOVED BALLS: Replace unless they contacted cue ball (= ball-in-hand foul, no replace).
RULE 10. CLOSE HITS: Shooter has advantage. Third party call is final. No third party = favors shooter.
RULE 11. ONE FOOT ON FLOOR: When bridge available. Not a foul — sportsmanship violation.
RULE 12. MARKING TABLE: Never mark cloth. Sportsmanship violation. Chalk on rail edge OK.
RULE 13. STALEMATES: Rerack, same breaker. 8-Ball: X in box. 9-Ball: points stand.
RULE 14. FROZEN BALLS: Must be declared + verified. Object frozen to rail: drive cue ball to rail, OR drive frozen ball to rail/pocket, OR drive frozen ball into another ball causing rail/pocket contact. Cue ball frozen to own ball: shoot toward = legal. Cue ball frozen to opponent's ball: must shoot away; shooting toward = FOUL.
RULE 15. FOULS (= ball-in-hand; 8-Ball break scratch = behind head string): (a) Cue ball off table. (b) Wrong ball first. (c) No rail/pocket after contact. (d) Frozen ball violation. (e) Intentional jump. (f) Illegal coaching. (g) Moving cue ball outside BIH. (h) Double hit / altering moving cue ball. (i) Cue ball hits accidentally moved ball. (j) Cue ball hits nothing. (k) Touching ball during BIH placement. Foul not called before next shot = too late.
RULE 16. HOW TO WIN — 8-Ball: Pocket all your balls + 8-ball in marked pocket. Or opponent pockets 8-ball illegally (wrong pocket, wrong turn, no marker, while fouling, or alters its course, or scratches on it). Missing 8-ball = foul (BIH), NOT a win. Pocketing 8-ball same shot as last ball = LOSS. Mark the pocket with a coaster or marker. 9-Ball: Legally pocket the 9-ball.

CRITICAL RULE 16 CLARIFICATION — COMMON MISCONCEPTION: A player can NEVER legally pocket the 8-ball on the same shot as their last category ball, regardless of the order the balls fall. Even if the player's last object ball drops into the pocket before the 8-ball on the same stroke, it is still a loss. The 8-ball MUST be pocketed on a completely separate shot. Combination shots where the cue ball or another ball drives the 8-ball into a pocket are only legal AFTER all category balls have already been pocketed in previous shots — never on the same shot as the last category ball.

TEAM & MATCH RULES (from APA Team Manual):

23-RULE: The combined skill levels of the five players fielded in a match night cannot exceed 23. Exceeding this limit may require replacing a player before the match begins.

19-RULE: If a team only has 4 players available on match night, the combined skill levels of those 4 players cannot exceed 19.

SKILL LEVELS: APA 8-Ball skill levels range from 2 to 7. APA 9-Ball skill levels range from 1 to 9. A player's skill level is not considered established until they have 10 match scores on record.

COACHING / TIMEOUTS:
- WHO CAN CALL A TIMEOUT: Any member of the shooting team — including the player — can request a timeout. However, only the designated coach may approach the table to advise the shooter. The coach may consult teammates first to reach a group consensus before approaching.
- NUMBER OF TIMEOUTS PER GAME: Skill Levels 1-3 receive TWO timeouts per game. Skill Levels 4-7 receive ONE timeout per game. (Same for both 8-Ball and 9-Ball.)
- TIMEOUT CHARGED OR NOT: If a teammate suggests a timeout and the player accepts, it is charged even if the player later disagrees. If the player requests a timeout and the coach refuses, NO timeout is charged.
- WHO IS ALLOWED AT THE TABLE: Only the designated coach and the shooter may be at the table during a timeout.
- SECONDARY CONSULTATION: If the shooting player voluntarily walks away from the table and is clearly not in the vicinity of the conversation, the coach may invite one additional teammate to the table to discuss. Once the shooting player returns, only the coach may remain.
- WHAT THE COACH CAN DO: Advise on shot selection, strategy, and ball placement. The coach may also physically place the cue ball during ball-in-hand. The player is not obligated to follow the advice.
- ILLEGAL COACHING: Any game strategy advice from anyone other than the designated coach, at any time outside of a called timeout, is a foul (ball-in-hand). This applies even between shots.
- NOT ILLEGAL COACHING: General encouragement ("good try", "you can do it") and reminders ("mark your pocket", "chalk up") are allowed at any time.
- EXCEPTIONS: No timeouts are allowed in Masters Division play.

FORFEITS: A team must have at least 2 players present to avoid a forfeit. Individual matches may be forfeited if a player is not present when it is their turn to play.

SCORESHEET: Captains are responsible for accurately recording innings, defensive shots, and timeouts on the official APA scoresheet. Errors can result in penalties.

RESPONSE FORMAT — MULTIPLE SCENARIOS:
When your answer covers multiple distinct scenarios or cases (e.g., "it depends on whether X or Y"), use this exact format so the app can display them as expandable cards:

[SUMMARY]
One or two sentences that directly answer the question at a high level.

[SCENARIO: Short title for scenario 1]
Full explanation of this specific case.

[SCENARIO: Short title for scenario 2]
Full explanation of this specific case.

Use this format only when there are 2 or more meaningfully different scenarios. For simple single-answer questions, reply normally without any tags.`;

// ─── Structured response parser ────────────────────────────────────────────────
interface ParsedResponse {
  summary: string;
  scenarios: Array<{ title: string; body: string }>;
}

function parseStructuredResponse(content: string): ParsedResponse | null {
  if (!content.includes('[SUMMARY]') || !content.includes('[SCENARIO:')) return null;
  const summaryMatch = content.match(/\[SUMMARY\]\s*([\s\S]*?)(?=\[SCENARIO:)/);
  const scenarioMatches = [...content.matchAll(/\[SCENARIO:\s*([^\]]+)\]\s*([\s\S]*?)(?=\[SCENARIO:|$)/g)];
  if (!summaryMatch || scenarioMatches.length < 2) return null;
  return {
    summary: summaryMatch[1].trim(),
    scenarios: scenarioMatches.map(m => ({ title: m[1].trim(), body: m[2].trim() })),
  };
}

const makeProofPrompt = () =>
  `You are a precise APA rulebook citation tool. Given a question and answer, find the single most relevant verbatim sentence or passage from the rulebook below that best supports the answer.

Respond ONLY with valid JSON — no markdown fences, no extra text:
{"ruleNumber": "Rule X", "ruleTitle": "Title Here", "quote": "exact verbatim text from rulebook here"}

Keep the quote to 1-3 sentences maximum. It must be word-for-word from the rulebook.

RULEBOOK:
${RULEBOOK_TEXT}`;

const makeAreYouSurePrompt = () =>
  `You are a strict APA rulebook auditor. A player has challenged an answer as potentially incorrect or misleading. Re-examine the answer critically against the verbatim rulebook below.

Look for:
- Outright errors
- Oversimplifications that could mislead a player at the table
- Missing nuance or important exceptions
- Common misconceptions the answer may have reinforced

Respond ONLY with valid JSON — no markdown fences, no extra text:
{"verdict": "CONFIRMED", "summary": "...", "analysis": "...", "correction": null}

The "verdict" field must be exactly one of: "CONFIRMED", "CORRECTED", or "NUANCE ADDED".
The "correction" field must be the corrected answer written from scratch (if verdict is CORRECTED or NUANCE ADDED), or null (if CONFIRMED).
The "analysis" field must be a full explanation — what was right, wrong, or missing. Cite rule numbers.

RULEBOOK:
${RULEBOOK_TEXT}`;

// ─── Quick questions ───────────────────────────────────────────────────────────
const QUICK_QUESTIONS = [
  '8-ball on break?',
  'What is ball-in-hand?',
  'All the fouls?',
  'Frozen ball rules?',
  'How to win 8-Ball?',
  'Open table rules?',
  'What is the 23-Rule?',
  'Can I coach my teammate?',
  'Timeout rules?',
];
const FULL_QUESTIONS = [
  'What happens if I pocket the 8-ball on the break?',
  'What is ball-in-hand and when do I get it?',
  'What are all the fouls in APA?',
  'How do frozen ball rules work?',
  'How do I legally win at 8-Ball?',
  'What is an open table in 8-Ball?',
  'What is the 23-Rule and how does it work?',
  'Can I coach my teammate during a match?',
  'How do timeouts work in APA? Who can call one and how many do I get?',
];

// ─── Types ─────────────────────────────────────────────────────────────────────
type Message = { role: 'user' | 'assistant'; content: string };
type Proof = { ruleNumber: string; ruleTitle: string; quote: string; visible: boolean };
type AuditVerdict = 'CONFIRMED' | 'CORRECTED' | 'NUANCE ADDED' | 'ERROR';
type AuditResult = { verdict: AuditVerdict; summary: string; analysis: string; correction: string | null; visible: boolean };

// ─── Animated dot component ────────────────────────────────────────────────────
function AnimatedDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  return (
    <Animated.View style={[styles.dot, { opacity: anim }]} />
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function RulesAssistant({ apiKey }: { apiKey: string }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [proofMap, setProofMap] = useState<Record<number, Proof>>({});
  const [proofLoading, setProofLoading] = useState<number | null>(null);
  const [flagMap, setFlagMap] = useState<Record<number, AuditResult>>({});
  const [flagLoading, setFlagLoading] = useState<number | null>(null);
  const [systemPromptExtra, setSystemPromptExtra] = useState('');
  const [expandedScenarios, setExpandedScenarios] = useState<Record<number, Set<number>>>({});
  const [listening, setListening] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const messageYOffsets = useRef<number[]>([]);
  const inputRef = useRef<TextInput>(null);
  const fabLongPressed = useRef(false);

  // Pulse animation while mic is held
  useEffect(() => {
    if (listening) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [listening, pulseAnim]);

  // Stores the latest transcript so the 'end' handler can auto-send it
  const pendingTranscript = useRef('');

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript ?? '';
    pendingTranscript.current = transcript;
    if (transcript) setInput(transcript);
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    if (pendingTranscript.current) {
      sendMessage(pendingTranscript.current);
      pendingTranscript.current = '';
    }
  });
  useSpeechRecognitionEvent('error', () => {
    setListening(false);
    pendingTranscript.current = '';
  });

  const micPressIn = async () => {
    if (!ExpoSpeechRecognitionModule) return;
    setInput('');
    pendingTranscript.current = '';
    setListening(true);
    await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true });
  };

  const micPressOut = () => {
    ExpoSpeechRecognitionModule?.stop();
    // sendMessage fires from the 'end' event handler above
  };

  useEffect(() => {
    if (!open || messages.length === 0) return;
    const last = messages[messages.length - 1];
    setTimeout(() => {
      if (last.role === 'assistant' && messages.length >= 2) {
        // Scroll to the user's question (message before this response) so
        // the start of the answer is visible at the top.
        const userMsgY = messageYOffsets.current[messages.length - 2] ?? 0;
        scrollRef.current?.scrollTo({ y: userMsgY, animated: true });
      } else {
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    }, 150);
  }, [open, messages]);

  // Fetch approved prompt overrides from Supabase on first open
  useEffect(() => {
    if (!open) return;
    supabase
      .from('prompt_overrides')
      .select('correction')
      .eq('status', 'approved')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSystemPromptExtra(
            '\n\nAPPROVED RULE CORRECTIONS (from LO-verified audits — treat these as authoritative):\n' +
            data.map((r: { correction: string }) => `- ${r.correction}`).join('\n')
          );
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const callAPI = async (system: string, msgs: Message[], maxTokens = 800) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: maxTokens, system, messages: msgs }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content?.[0]?.text || '';
  };

  const sendMessage = async (text?: string) => {
    const userText = text ?? input.trim();
    if (!userText || loading) return;
    setInput('');
    const newMsgs: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const reply = await callAPI(SYSTEM_PROMPT + systemPromptExtra, newMsgs);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const showProof = async (msgIndex: number) => {
    if (proofMap[msgIndex]) {
      setProofMap(prev => ({ ...prev, [msgIndex]: { ...prev[msgIndex], visible: !prev[msgIndex].visible } }));
      return;
    }
    const question = messages[msgIndex - 1]?.content ?? '';
    const answer = messages[msgIndex]?.content ?? '';
    setProofLoading(msgIndex);
    try {
      const raw = await callAPI(makeProofPrompt(), [{
        role: 'user',
        content: `Question: ${question}\n\nAnswer: ${answer}\n\nExtract the proof.`,
      }]);
      const proof = JSON.parse(raw.replace(/```json|```/g, '').trim());
      setProofMap(prev => ({ ...prev, [msgIndex]: { ...proof, visible: true } }));
    } catch {
      setProofMap(prev => ({
        ...prev,
        [msgIndex]: { ruleNumber: 'APA Rulebook', ruleTitle: 'Official Rules', quote: 'Could not extract proof. Please try again.', visible: true },
      }));
    } finally {
      setProofLoading(null);
    }
  };

  const areYouSure = async (msgIndex: number) => {
    // Toggle visibility if audit already loaded
    if (flagMap[msgIndex]) {
      setFlagMap(prev => ({ ...prev, [msgIndex]: { ...prev[msgIndex], visible: !prev[msgIndex].visible } }));
      return;
    }

    // Ensure proof citation is visible (don't toggle it off)
    if (!proofMap[msgIndex]?.visible) {
      showProof(msgIndex);
    }

    const question = messages[msgIndex - 1]?.content ?? '';
    const answer = messages[msgIndex]?.content ?? '';
    setFlagLoading(msgIndex);

    try {
      const raw = await callAPI(makeAreYouSurePrompt(), [{
        role: 'user',
        content: `Question: ${question}\n\nAnswer given: ${answer}\n\nAudit this answer against the rulebook.`,
      }], 1500);
      const result = JSON.parse(raw.replace(/```json|```/g, '').trim()) as Omit<AuditResult, 'visible'>;
      setFlagMap(prev => ({ ...prev, [msgIndex]: { ...result, visible: true } }));

      // Log flag to Supabase only when there's something for the LO to review
      // (CONFIRMED answers are correct — no action needed, skip logging)
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id && result.verdict !== 'CONFIRMED') {
        await supabase.from('rules_flags').insert({
          user_id: user.id,
          question,
          original_answer: answer,
          audit_verdict: result.verdict,
          proposed_correction: result.correction ?? null,
        });
      }

      // Inject correction into conversation so Claude carries it forward this session
      if (result.verdict !== 'CONFIRMED' && result.correction) {
        setMessages(prev => [
          ...prev,
          {
            role: 'user',
            content: `[SYSTEM CORRECTION] The previous answer to "${question}" was flagged as ${result.verdict}. The corrected interpretation is: ${result.correction} Please use this correction for all future answers this session.`,
          },
          {
            role: 'assistant',
            content: `✅ Correction acknowledged. ${result.correction}`,
          },
        ]);
      }
    } catch (err) {
      console.error('[AreYouSure] audit failed:', err);
      setFlagMap(prev => ({
        ...prev,
        [msgIndex]: {
          verdict: 'ERROR',
          summary: 'Audit failed.',
          analysis: 'Could not complete the audit. Please try again.',
          correction: null,
          visible: true,
        },
      }));
    } finally {
      setFlagLoading(null);
    }
  };

  // FAB positioned above tab bar
  const fabBottom = insets.bottom + 80;

  return (
    <>
      {/* Floating ball button — transparent overlay so taps pass through everywhere else */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.fab, { bottom: fabBottom }, listening && { transform: [{ scale: pulseAnim }] }]}>
          <Pressable
            onPressIn={() => { fabLongPressed.current = false; }}
            onLongPress={() => {
              fabLongPressed.current = true;
              setOpen(true);
              micPressIn();
            }}
            onPress={() => { if (!fabLongPressed.current) setOpen(true); }}
            onPressOut={() => { if (listening) micPressOut(); }}
            delayLongPress={300}
            style={styles.fabPressable}
            accessibilityLabel="Open APA Rules Assistant — hold to speak"
            accessibilityRole="button"
          >
            <Text style={styles.fabEmoji}>🎱</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Chat panel */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.panel, { paddingBottom: insets.bottom }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>🎱  APA Rules Assistant  🎳</Text>
              <Text style={styles.headerSub}>2023 OFFICIAL RULEBOOK</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.closeBtnText}>×</Text>
            </Pressable>
          </View>

          {/* Quick question chips */}
          <View style={styles.chipsScroll}>
            <View style={styles.chipsContent}>
              {QUICK_QUESTIONS.map((q, i) => (
                <Pressable
                  key={i}
                  onPress={() => sendMessage(FULL_QUESTIONS[i])}
                  disabled={loading}
                  style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                >
                  <Text style={styles.chipText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
          >
            {messages.map((msg, i) => (
              <View
                key={i}
                style={styles.messageRow}
                onLayout={(e) => { messageYOffsets.current[i] = e.nativeEvent.layout.y; }}
              >
                <View style={[styles.bubbleRow, msg.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
                  <View style={styles.bubbleGroup}>
                    {(() => {
                      const parsed = msg.role === 'assistant' ? parseStructuredResponse(msg.content) : null;
                      if (parsed) {
                        const expanded = expandedScenarios[i] ?? new Set<number>();
                        return (
                          <View style={styles.bubbleAssistant}>
                            <Text style={styles.bubbleTextAssistant}>{parsed.summary}</Text>
                            <View style={styles.scenarioList}>
                              {parsed.scenarios.map((s, si) => {
                                const isOpen = expanded.has(si);
                                return (
                                  <View key={si} style={styles.scenarioCard}>
                                    <Pressable
                                      style={styles.scenarioHeader}
                                      onPress={() => {
                                        const next = new Set(expanded);
                                        if (isOpen) next.delete(si); else next.add(si);
                                        setExpandedScenarios(prev => ({ ...prev, [i]: next }));
                                      }}
                                    >
                                      <Text style={styles.scenarioTitle}>{s.title}</Text>
                                      <Text style={styles.scenarioChevron}>{isOpen ? '▲' : '▼'}</Text>
                                    </Pressable>
                                    {isOpen && (
                                      <Text style={styles.scenarioBody}>{s.body}</Text>
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        );
                      }
                      return (
                        <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                          <Text style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
                            {msg.content}
                          </Text>
                        </View>
                      );
                    })()}

                    {/* Button row + callouts — only for assistant replies after the first */}
                    {msg.role === 'assistant' && i > 0 && (
                      <>
                        {/* Button row */}
                        <View style={styles.btnRow}>
                          {/* Show Me the Proof */}
                          <Pressable
                            onPress={() => showProof(i)}
                            disabled={proofLoading === i}
                            style={({ pressed }) => [
                              styles.proofBtn,
                              proofMap[i]?.visible && styles.proofBtnActive,
                              pressed && styles.proofBtnPressed,
                            ]}
                          >
                            {proofLoading === i ? (
                              <View style={styles.dotsRow}>
                                <AnimatedDot delay={0} />
                                <AnimatedDot delay={200} />
                                <AnimatedDot delay={400} />
                                <Text style={styles.proofBtnText}>  Finding proof...</Text>
                              </View>
                            ) : (
                              <Text style={[styles.proofBtnText, proofMap[i]?.visible && styles.proofBtnTextActive]}>
                                📖 {proofMap[i]?.visible ? 'Hide Proof' : 'Show Me the Proof'}
                              </Text>
                            )}
                          </Pressable>

                          {/* Are You Sure? */}
                          <Pressable
                            onPress={() => areYouSure(i)}
                            disabled={flagLoading === i}
                            style={({ pressed }) => [
                              styles.auditBtn,
                              flagMap[i]?.visible && (
                                flagMap[i].verdict === 'CONFIRMED' ? styles.auditBtnConfirmed :
                                flagMap[i].verdict === 'NUANCE ADDED' ? styles.auditBtnNuance :
                                styles.auditBtnCorrected
                              ),
                              pressed && styles.auditBtnPressed,
                            ]}
                          >
                            {flagLoading === i ? (
                              <View style={styles.dotsRow}>
                                <AnimatedDot delay={0} />
                                <AnimatedDot delay={200} />
                                <AnimatedDot delay={400} />
                                <Text style={styles.auditBtnText}>  Checking...</Text>
                              </View>
                            ) : (
                              <Text style={[
                                styles.auditBtnText,
                                flagMap[i]?.visible && (
                                  flagMap[i].verdict === 'CONFIRMED' ? styles.auditBtnTextConfirmed :
                                  flagMap[i].verdict === 'NUANCE ADDED' ? styles.auditBtnTextNuance :
                                  styles.auditBtnTextCorrected
                                ),
                              ]}>
                                🤔 {flagMap[i]?.visible ? 'Hide Audit' : 'Are You Sure?'}
                              </Text>
                            )}
                          </Pressable>
                        </View>

                        {/* Proof citation card */}
                        {proofMap[i]?.visible && (
                          <View style={styles.proofCard}>
                            <Text style={styles.proofCardTitle}>
                              📋 {proofMap[i].ruleNumber} — {proofMap[i].ruleTitle}
                            </Text>
                            <Text style={styles.proofCardQuote}>"{proofMap[i].quote}"</Text>
                            <Text style={styles.proofCardFooter}>APA Official Game Rules Booklet © 2023</Text>
                          </View>
                        )}

                        {/* Audit result card */}
                        {flagMap[i]?.visible && (
                          <View style={[
                            styles.auditCard,
                            flagMap[i].verdict === 'CONFIRMED' ? styles.auditCardConfirmed :
                            flagMap[i].verdict === 'NUANCE ADDED' ? styles.auditCardNuance :
                            styles.auditCardCorrected,
                          ]}>
                            <Text style={[
                              styles.auditCardTitle,
                              flagMap[i].verdict === 'CONFIRMED' ? styles.auditCardTitleConfirmed :
                              flagMap[i].verdict === 'NUANCE ADDED' ? styles.auditCardTitleNuance :
                              styles.auditCardTitleCorrected,
                            ]}>
                              {flagMap[i].verdict === 'CONFIRMED' ? '✅ CONFIRMED' :
                               flagMap[i].verdict === 'CORRECTED' ? '❌ CORRECTED' :
                               flagMap[i].verdict === 'ERROR' ? '⚠️ ERROR' :
                               '⚠️ NUANCE ADDED'} — {flagMap[i].summary}
                            </Text>
                            <Text style={styles.auditCardAnalysis}>{flagMap[i].analysis}</Text>
                            {flagMap[i].correction && (
                              <View style={styles.auditCardCorrection}>
                                <Text style={styles.auditCardCorrectionLabel}>CORRECTED ANSWER:</Text>
                                <Text style={styles.auditCardCorrectionText}>{flagMap[i].correction}</Text>
                              </View>
                            )}
                            <Text style={styles.auditCardFooter}>APA Rules Audit • 2023 Official Rulebook</Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                </View>
              </View>
            ))}

            {/* Typing indicator */}
            {loading && (
              <View style={styles.typingRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarEmoji}>🎱</Text>
                </View>
                <View style={styles.typingBubble}>
                  <AnimatedDot delay={0} />
                  <AnimatedDot delay={200} />
                  <AnimatedDot delay={400} />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Big mic ball */}
          <View style={styles.micZone}>
            <Pressable
              onPressIn={micPressIn}
              onPressOut={micPressOut}
              disabled={loading || !SPEECH_AVAILABLE}
              style={styles.micZonePressable}
            >
              <Animated.View style={[styles.micZoneBall, listening && styles.micZoneBallActive, { transform: [{ scale: pulseAnim }] }]}>
                <Text style={styles.micZoneEmoji}>🎱</Text>
              </Animated.View>
            </Pressable>
            <Text style={styles.micZoneHint}>
              {listening ? 'Release to send' : SPEECH_AVAILABLE ? 'Press and hold to ask a question' : 'Type your question below'}
            </Text>
          </View>

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
              placeholder={listening ? 'Listening...' : 'Type your question here...'}
              placeholderTextColor={C.brownDim}
              editable={!loading && !listening}
              style={styles.textInput}
            />
            <Pressable
              onPress={() => sendMessage()}
              disabled={loading || !input.trim() || listening}
              style={({ pressed }) => [
                styles.sendBtn,
                input.trim() && !loading && !listening ? styles.sendBtnActive : styles.sendBtnDisabled,
                pressed && input.trim() && !loading && !listening && styles.sendBtnPressed,
              ]}
            >
              <Text style={[styles.sendBtnText, input.trim() && !loading && !listening ? styles.sendBtnTextActive : styles.sendBtnTextDisabled]}>
                ASK
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.brown,
    borderWidth: 2,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 12,
  },
  fabPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabEmoji: {
    fontSize: 26,
  },

  // Modal backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  // Chat panel
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '94%',
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: C.borderWarm,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.headerBg1,
    borderBottomWidth: 1,
    borderBottomColor: C.borderWarm,
  },
  headerSpacer: { width: 32 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 14, fontWeight: 'bold', color: C.gold },
  headerSub: { fontSize: 10, color: C.brownDim, letterSpacing: 0.8 },
  closeBtn: { width: 32, padding: 4, alignItems: 'flex-end' },
  closeBtnText: { fontSize: 22, color: C.brownDim, lineHeight: 24 },

  // Quick chips
  chipsScroll: {
    backgroundColor: C.bgDark,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    flexShrink: 0,
  },
  chipsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: C.borderBrown,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipPressed: { borderColor: C.gold },
  chipText: { color: C.chipText, fontSize: 11 },

  // Messages
  messages: { flex: 1 },
  messagesContent: { padding: 12, gap: 10 },
  messageRow: {},
  bubbleRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubbleGroup: { maxWidth: '82%', gap: 6 },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.iconBg,
    borderWidth: 1,
    borderColor: C.brown,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarEmoji: { fontSize: 13 },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
  },
  bubbleUser: {
    borderTopRightRadius: 3,
    backgroundColor: C.userBubble1,
    borderColor: C.userBubbleBorder,
  },
  bubbleAssistant: {
    borderTopLeftRadius: 3,
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    maxWidth: '88%',
  },
  bubbleText: { fontSize: 13, lineHeight: 20 },
  bubbleTextUser: { color: C.userText },
  bubbleTextAssistant: { color: C.assistantText, fontSize: 13, lineHeight: 20 },

  // Scenario accordion
  scenarioList: { marginTop: 10, gap: 6 },
  scenarioCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderWarm,
    overflow: 'hidden',
  },
  scenarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.surfaceAlt,
  },
  scenarioTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: C.gold,
  },
  scenarioChevron: {
    fontSize: 10,
    color: C.brownDim,
    marginLeft: 6,
  },
  scenarioBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 20,
    color: C.assistantText,
    backgroundColor: C.bgDark,
  },

  // Proof button
  proofBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: C.brown,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: 'rgba(139,69,19,0.1)',
  },
  proofBtnActive: {
    borderColor: C.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  proofBtnPressed: { backgroundColor: 'rgba(212,175,55,0.2)' },
  proofBtnText: { fontSize: 11, color: '#c87840' },
  proofBtnTextActive: { color: C.gold },
  dotsRow: { flexDirection: 'row', alignItems: 'center' },

  // Proof card
  proofCard: {
    backgroundColor: C.proofBg1,
    borderWidth: 1,
    borderColor: C.proofBorder,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  proofCardTitle: { fontSize: 10, color: C.gold, letterSpacing: 0.8, fontWeight: 'bold' },
  proofCardQuote: { fontSize: 12, color: C.proofText, lineHeight: 19, fontStyle: 'italic' },
  proofCardFooter: { fontSize: 10, color: C.proofFooter },

  // Typing indicator
  typingRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  typingBubble: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    borderTopLeftRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.gold,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.bgDark,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  textInput: {
    flex: 1,
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.borderWarm,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: C.white,
    fontSize: 13,
  },
  sendBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  sendBtnActive: { backgroundColor: C.brown },
  sendBtnDisabled: { backgroundColor: C.disabledSend },
  sendBtnPressed: { backgroundColor: C.brownDark },
  sendBtnText: { fontSize: 12, fontWeight: 'bold' },
  sendBtnTextActive: { color: C.bg },
  sendBtnTextDisabled: { color: C.dimText },

  // Mic button
  micBtnWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(139,69,19,0.2)',
    borderWidth: 1,
    borderColor: C.borderWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: 'rgba(200,0,0,0.2)',
    borderColor: '#cc0000',
  },
  micEmoji: { fontSize: 18 },

  // Big mic ball zone (inside panel)
  micZone: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: C.bgDark,
    borderTopWidth: 1,
    borderTopColor: C.borderWarm,
  },
  micZonePressable: {
    alignItems: 'center',
  },
  micZoneBall: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: C.brown,
    borderWidth: 3,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  micZoneBallActive: {
    borderColor: '#ff4444',
    shadowColor: '#ff4444',
  },
  micZoneEmoji: {
    fontSize: 46,
  },
  micZoneHint: {
    marginTop: 10,
    fontSize: 12,
    color: C.brownDim,
    letterSpacing: 0.3,
  },

  // Hold-to-speak hint (legacy — kept for reference)
  micHint: {
    alignItems: 'center',
    paddingBottom: 6,
    backgroundColor: C.bgDark,
  },
  micHintText: {
    fontSize: 10,
    color: C.brownDim,
    letterSpacing: 0.3,
  },

  // Button row (proof + audit side by side)
  btnRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },

  // Are You Sure button
  auditBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: 'rgba(80,80,80,0.12)',
  },
  auditBtnConfirmed: {
    borderColor: '#4a9a4a',
    backgroundColor: 'rgba(50,180,50,0.12)',
  },
  auditBtnNuance: {
    borderColor: C.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  auditBtnCorrected: {
    borderColor: '#cc4444',
    backgroundColor: 'rgba(200,60,60,0.12)',
  },
  auditBtnPressed: { backgroundColor: 'rgba(200,60,60,0.22)' },
  auditBtnText: { fontSize: 11, color: '#888' },
  auditBtnTextConfirmed: { color: '#6abf6a' },
  auditBtnTextNuance: { color: C.gold },
  auditBtnTextCorrected: { color: '#e07070' },

  // Audit result card
  auditCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 12,
    gap: 6,
  },
  auditCardConfirmed: {
    backgroundColor: '#0d1a0d',
    borderColor: '#2a4a2a',
    borderLeftColor: '#4a9a4a',
  },
  auditCardNuance: {
    backgroundColor: '#1a1500',
    borderColor: '#4a4020',
    borderLeftColor: C.gold,
  },
  auditCardCorrected: {
    backgroundColor: '#1a0d0d',
    borderColor: '#4a2020',
    borderLeftColor: '#cc4444',
  },
  auditCardTitle: { fontSize: 10, letterSpacing: 0.8, fontWeight: 'bold' },
  auditCardTitleConfirmed: { color: '#4a9a4a' },
  auditCardTitleNuance: { color: C.gold },
  auditCardTitleCorrected: { color: '#cc4444' },
  auditCardAnalysis: { fontSize: 12, color: '#c8b8b0', lineHeight: 19 },
  auditCardCorrection: {
    marginTop: 4,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#cc4444',
    gap: 4,
  },
  auditCardCorrectionLabel: { fontSize: 10, color: '#cc4444', fontWeight: 'bold', letterSpacing: 0.6 },
  auditCardCorrectionText: { fontSize: 12, color: '#e8d8c8', lineHeight: 19 },
  auditCardFooter: { fontSize: 10, color: '#6a4a4a' },
});
