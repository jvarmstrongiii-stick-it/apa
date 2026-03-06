import { useState, useRef, useEffect } from "react";

// ─── Full verbatim rulebook text for "Show Me the Proof" ───
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

RULE 16. HOW TO WIN — 8-Ball: (a) You pocket all the balls of your category and legally pocket the 8-ball in a properly marked pocket. (b) Your opponent pockets the 8-ball out-of-turn or knocks the 8-ball on the floor. (c) Your opponent pockets the 8-ball in the wrong pocket. (d) Your opponent fails to properly mark the pocket where the 8-ball is pocketed, and you call loss of game. (e) Your opponent fouls the cue ball and pockets the 8-ball. (f) Your opponent alters the course of the 8-ball or the cue ball in an attempt to prevent a loss. (g) Your opponent scratches or knocks the cue ball off the table when playing the 8-ball. NOTE 1: If your opponent is shooting at the 8-ball and misses it altogether, commonly referred to as a table scratch, they have fouled and you receive ball-in-hand. You do not win because of this foul. NOTE 2: You may not play the 8-ball at the same time you play the last ball of your category. The 8-ball must be pocketed through a separate shot. If you pocket the 8-ball at the same time you pocket the last ball of your category, you lose the game. Marking the pocket: A coaster or some other reasonable marker must be placed next to the shooter's intended pocket. Marking the pocket with chalk is not recommended. Both players may use the same marker. Only one marker should remain on the table at a time. Contacting a pocket marker with the 8-ball is not a foul and the shot stands. 9-Ball: You legally pocket the 9-ball.`;

// ─── System prompt for answering questions ───
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
RULE 16. HOW TO WIN — 8-Ball: Pocket all your balls + 8-ball in marked pocket. Or opponent pockets 8-ball illegally (wrong pocket, wrong turn, no marker, while fouling, or alters its course, or scratches on it). Missing 8-ball = foul (BIH), NOT a win. Pocketing 8-ball same shot as last ball = LOSS. Mark the pocket with a coaster or marker. 9-Ball: Legally pocket the 9-ball.`;

// ─── System prompt for extracting proof ───
const makeProofPrompt = () => `You are a precise APA rulebook citation tool. Given a question and answer, find the single most relevant verbatim sentence or passage from the rulebook below that best supports the answer.

Respond ONLY with valid JSON — no markdown fences, no extra text:
{"ruleNumber": "Rule X", "ruleTitle": "Title Here", "quote": "exact verbatim text from rulebook here"}

Keep the quote to 1-3 sentences maximum. It must be word-for-word from the rulebook.

RULEBOOK:
${RULEBOOK_TEXT}`;

const QUICK_QUESTIONS = ["8-ball on break?", "What is ball-in-hand?", "All the fouls?", "Frozen ball rules?", "How to win 8-Ball?", "Open table rules?"];
const FULL_QUESTIONS = [
  "What happens if I pocket the 8-ball on the break?",
  "What is ball-in-hand and when do I get it?",
  "What are all the fouls in APA?",
  "How do frozen ball rules work?",
  "How do I legally win at 8-Ball?",
  "What is an open table in 8-Ball?",
];

export default function RulesAssistant({ apiKey }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "🎱 Ask me anything about APA rules — 8-Ball, 9-Ball, fouls, frozen balls, how to win, and more.",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proofMap, setProofMap] = useState({});       // index -> { ruleNumber, ruleTitle, quote, visible }
  const [proofLoading, setProofLoading] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  const callAPI = async (system, msgs) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: "claude-opus-4-6", max_tokens: 800, system, messages: msgs }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content?.[0]?.text || "";
  };

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");
    const newMsgs = [...messages, { role: "user", content: userText }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const reply = await callAPI(SYSTEM_PROMPT, newMsgs);
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const showProof = async (msgIndex) => {
    // Toggle if already loaded
    if (proofMap[msgIndex]) {
      setProofMap(prev => ({ ...prev, [msgIndex]: { ...prev[msgIndex], visible: !prev[msgIndex].visible } }));
      return;
    }
    const question = messages[msgIndex - 1]?.content || "";
    const answer = messages[msgIndex]?.content || "";
    setProofLoading(msgIndex);
    try {
      const raw = await callAPI(makeProofPrompt(), [{
        role: "user",
        content: `Question: ${question}\n\nAnswer: ${answer}\n\nExtract the proof.`,
      }]);
      const proof = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setProofMap(prev => ({ ...prev, [msgIndex]: { ...proof, visible: true } }));
    } catch {
      setProofMap(prev => ({
        ...prev,
        [msgIndex]: { ruleNumber: "APA Rulebook", ruleTitle: "Official Rules", quote: "Could not extract proof. Please try again.", visible: true },
      }));
    } finally {
      setProofLoading(null);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <>
      {/* Floating Ball Button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="APA Rules Assistant"
        style={{
          position: "fixed", bottom: "24px", right: "24px",
          width: "58px", height: "58px", borderRadius: "50%",
          background: open ? "linear-gradient(135deg,#5a2e00,#8B4513)" : "linear-gradient(135deg,#8B4513,#D4AF37)",
          border: "2px solid #D4AF37",
          boxShadow: "0 4px 20px rgba(139,69,19,0.6)",
          fontSize: "26px", cursor: "pointer", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s", transform: open ? "rotate(15deg)" : "rotate(0deg)",
        }}
      >🎱</button>

      {/* Chat Panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: "96px", right: "24px",
          width: "400px", maxWidth: "calc(100vw - 48px)",
          height: "580px", maxHeight: "calc(100vh - 120px)",
          background: "#0f0f0f", border: "1px solid #3a2a1a", borderRadius: "16px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
          display: "flex", flexDirection: "column",
          zIndex: 9998, fontFamily: "Georgia,serif", overflow: "hidden",
          animation: "apa_slideUp 0.2s ease-out",
        }}>
          <style>{`
            @keyframes apa_slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
            @keyframes apa_dot { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1.2)} }
            .apa-scroll::-webkit-scrollbar{width:4px}
            .apa-scroll::-webkit-scrollbar-track{background:transparent}
            .apa-scroll::-webkit-scrollbar-thumb{background:#3a2a1a;border-radius:2px}
            .apa-qbtn:hover{border-color:#D4AF37 !important;color:#D4AF37 !important}
            .apa-proof-btn:hover{background:rgba(212,175,55,0.15) !important;color:#D4AF37 !important;border-color:#D4AF37 !important}
          `}</style>

          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

            {/* Header */}
            <div style={{
              background: "linear-gradient(135deg,#1a0a00,#2d1500)",
              borderBottom: "1px solid #3a2a1a",
              padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0,
            }}>
              <span style={{ fontSize: "20px" }}>🎱</span>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: "#D4AF37" }}>APA Rules Assistant</div>
                <div style={{ fontSize: "10px", color: "#8B7355", letterSpacing: "0.08em" }}>2023 OFFICIAL RULEBOOK</div>
              </div>
              <button onClick={() => setOpen(false)} style={{
                marginLeft: "auto", background: "transparent", border: "none",
                color: "#8B7355", fontSize: "20px", cursor: "pointer", padding: "0 4px", lineHeight: 1,
              }}>×</button>
            </div>

            {/* Quick Questions */}
            <div style={{
              padding: "8px 12px", borderBottom: "1px solid #1a1a1a",
              display: "flex", gap: "6px", flexWrap: "wrap",
              background: "#0a0a0a", flexShrink: 0,
            }}>
              {QUICK_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => sendMessage(FULL_QUESTIONS[i])} disabled={loading}
                  className="apa-qbtn"
                  style={{
                    background: "transparent", border: "1px solid #2a1a0a", borderRadius: "12px",
                    padding: "3px 10px", color: "#806040", fontSize: "11px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontFamily: "Georgia,serif", transition: "all 0.15s",
                  }}>
                  {q}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="apa-scroll" style={{
              flex: 1, overflowY: "auto", padding: "12px",
              display: "flex", flexDirection: "column", gap: "10px",
            }}>
              {messages.map((msg, i) => (
                <div key={i}>
                  {/* Message row */}
                  <div style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    gap: "8px", alignItems: "flex-start",
                  }}>
                    {msg.role === "assistant" && (
                      <div style={{
                        width: "26px", height: "26px", borderRadius: "50%",
                        background: "#2d1500", border: "1px solid #8B4513",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "13px", flexShrink: 0,
                      }}>🎱</div>
                    )}
                    <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{
                        padding: "9px 13px",
                        borderRadius: msg.role === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
                        background: msg.role === "user" ? "linear-gradient(135deg,#3d1f00,#5a2e00)" : "#1a1a1a",
                        border: msg.role === "user" ? "1px solid #8B4513" : "1px solid #252525",
                        fontSize: "13px", lineHeight: "1.6",
                        color: msg.role === "user" ? "#f0e0c0" : "#d0c8b8",
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {msg.content}
                      </div>

                      {/* Show Me the Proof — only for assistant replies after the first */}
                      {msg.role === "assistant" && i > 0 && (
                        <>
                          <button
                            onClick={() => showProof(i)}
                            disabled={proofLoading === i}
                            className="apa-proof-btn"
                            style={{
                              alignSelf: "flex-start",
                              background: proofMap[i]?.visible ? "rgba(212,175,55,0.12)" : "rgba(139,69,19,0.1)",
                              border: `1px solid ${proofMap[i]?.visible ? "#D4AF37" : "#8B4513"}`,
                              borderRadius: "10px", padding: "4px 11px",
                              color: proofMap[i]?.visible ? "#D4AF37" : "#c87840",
                              fontSize: "11px",
                              cursor: proofLoading === i ? "wait" : "pointer",
                              fontFamily: "Georgia,serif", transition: "all 0.15s",
                              display: "flex", alignItems: "center", gap: "5px",
                            }}
                          >
                            {proofLoading === i ? (
                              <>
                                {[0,1,2].map(j => (
                                  <span key={j} style={{
                                    width: "4px", height: "4px", borderRadius: "50%",
                                    background: "#D4AF37", display: "inline-block",
                                    animation: `apa_dot 1s ease-in-out ${j*0.2}s infinite`,
                                  }} />
                                ))}
                                <span style={{ marginLeft: "4px" }}>Finding proof...</span>
                              </>
                            ) : (
                              `📖 ${proofMap[i]?.visible ? "Hide Proof" : "Show Me the Proof"}`
                            )}
                          </button>

                          {/* Proof callout */}
                          {proofMap[i]?.visible && (
                            <div style={{
                              background: "linear-gradient(135deg,#0d1a0d,#111811)",
                              border: "1px solid #2a4a2a",
                              borderLeft: "3px solid #D4AF37",
                              borderRadius: "10px", padding: "10px 13px",
                              animation: "apa_slideUp 0.2s ease-out",
                            }}>
                              <div style={{
                                fontSize: "10px", color: "#D4AF37",
                                letterSpacing: "0.1em", marginBottom: "6px", fontWeight: "bold",
                              }}>
                                📋 {proofMap[i].ruleNumber} — {proofMap[i].ruleTitle}
                              </div>
                              <div style={{
                                fontSize: "12px", color: "#b8c8b0",
                                lineHeight: "1.65", fontStyle: "italic",
                              }}>
                                "{proofMap[i].quote}"
                              </div>
                              <div style={{ fontSize: "10px", color: "#4a6a4a", marginTop: "6px" }}>
                                APA Official Game Rules Booklet © 2023
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{
                    width: "26px", height: "26px", borderRadius: "50%",
                    background: "#2d1500", border: "1px solid #8B4513",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px",
                  }}>🎱</div>
                  <div style={{
                    background: "#1a1a1a", border: "1px solid #252525",
                    borderRadius: "14px", padding: "10px 14px",
                    display: "flex", gap: "5px", alignItems: "center",
                  }}>
                    {[0,1,2].map(j => (
                      <div key={j} style={{
                        width: "6px", height: "6px", borderRadius: "50%", background: "#D4AF37",
                        animation: `apa_dot 1.2s ease-in-out ${j*0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div style={{
              padding: "10px 12px", borderTop: "1px solid #1a1a1a",
              background: "#0a0a0a", display: "flex", gap: "8px", flexShrink: 0,
            }}>
              <input
                ref={inputRef}
                type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask a rules question..."
                disabled={loading}
                style={{
                  flex: 1, background: "#141414",
                  border: "1px solid #3a2a1a", borderRadius: "10px",
                  padding: "8px 12px", color: "#e8e0d0",
                  fontSize: "13px", fontFamily: "Georgia,serif", outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = "#8B4513"}
                onBlur={e => e.target.style.borderColor = "#3a2a1a"}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                style={{
                  background: input.trim() && !loading ? "linear-gradient(135deg,#8B4513,#D4AF37)" : "#1a1a1a",
                  border: "none", borderRadius: "10px", padding: "8px 14px",
                  color: input.trim() && !loading ? "#0a0a0a" : "#333",
                  fontSize: "12px", fontWeight: "bold",
                  cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                  fontFamily: "Georgia,serif", transition: "all 0.15s",
                }}
              >ASK</button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
