import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.0';
import { extractText, getDocumentProxy } from 'npm:unpdf';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Unified data model — both parsers produce this
// ---------------------------------------------------------------------------

interface PlayerData {
  fullName:      string;
  memberNumber:  string;
  skillLevel:    number;
  matchesPlayed: number;
}

interface MatchImportData {
  divisionName:   string;                    // "435" or "8-BALL Warminster…"
  divisionNumber: string;                    // "435" (always 3 digits)
  gameFormat:     'eight_ball' | 'nine_ball';
  weekNumber:   number;
  matchDate:    string;                      // YYYY-MM-DD
  homeTeam:     { number: string; name: string };
  awayTeam:     { number: string; name: string };
  homePlayers:  PlayerData[];
  awayPlayers:  PlayerData[];
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function convertDate(mmddyyyy: string): string {
  const [mm, dd, yyyy] = mmddyyyy.split('/');
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function parseName(fullName: string): { firstName: string; lastName: string } {
  const t = fullName.trim();
  if (t.includes(',')) {
    // "Last, First" — APA standard
    const idx = t.indexOf(',');
    return { lastName: t.slice(0, idx).trim(), firstName: t.slice(idx + 1).trim() };
  }
  const parts = t.split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// ---------------------------------------------------------------------------
// Parser 1 — Official APA scoresheet PDF
//
// pdfjs (unpdf) extracts this as column-major with no spaces between cells:
//   "For Week #:8/16On02/17/2026At07:00 PM"
//   "Division:8-BALL Warminster Tuesday Spring 2026 Session"
//   "Team:Home TeamWe Came To Play43502"
//   "SL*MPPlayer #Name634433763573238434743946456476964403947901Armstrong, Jack..."
//
// The digit block is COLUMN-MAJOR: [N×SL][N×MP][N×5-digit member#]
// = N×7 chars total per group. Groups may repeat for extra roster players.
// Names are concatenated "Last, FirstLast, First..." after each digit group.
// ---------------------------------------------------------------------------

function parseAPAScoresheet(text: string): MatchImportData | null {
  // 1. Week + date (pdfjs merges: "For Week #:8/16On02/17/2026")
  const weekDateM = text.match(/For\s*Week\s*#:\s*(\d+)\s*\/\s*\d+\s*On\s*(\d{2}\/\d{2}\/\d{4})/);
  if (!weekDateM) throw new Error('APA parse failed: could not find week/date (expected "For Week #:N/N OnMM/DD/YYYY"). Snippet: ' + text.slice(0, 200));
  const weekNumber = parseInt(weekDateM[1], 10);
  const matchDate  = convertDate(weekDateM[2]);

  // 2. Division (ends at "Division Rep" or "Team #:")
  const divM = text.match(/Division:\s*([\w\s\-]+?)(?=\s*Division\s*Rep|\s*Team\s*#:)/);
  const divisionName = divM ? divM[1].trim() : 'Unknown';
  const gameFormat: 'eight_ball' | 'nine_ball' =
    /9.?ball/i.test(divisionName) ? 'nine_ball' : 'eight_ball';

  // 3. Teams ("Team:Home TeamWe Came To Play43502")
  const homeM = text.match(/Team:\s*Home\s*Team\s*(.*?)\s*(\d{5})(?!\d)/);
  const awayM  = text.match(/Team:\s*Visiting\s*Team\s*(.*?)\s*(\d{5})(?!\d)/);
  if (!homeM) throw new Error('APA parse failed: could not find home team line (expected "Team:Home Team<name><5-digit#>"). Snippet: ' + text.slice(0, 400));
  if (!awayM) throw new Error('APA parse failed: could not find visiting team line (expected "Team:Visiting Team<name><5-digit#>"). Snippet: ' + text.slice(0, 400));
  const homeTeam = { number: homeM[2], name: homeM[1].trim() };
  const awayTeam = { number: awayM[2], name: awayM[1].trim() };
  const divisionNumber = homeTeam.number.slice(0, 3);

  // 4. Player section boundaries
  const homeHeaderIdx = text.search(/SL\s*MP\s*Player\s*#?\s*Name/i);
  const visitingIdx   = text.search(/Team:\s*Visiting\s*Team/i);
  if (homeHeaderIdx < 0) throw new Error('APA parse failed: could not find home player table header (SL MP Player# Name).');
  if (visitingIdx < 0) throw new Error('APA parse failed: could not find visiting team section.');
  if (homeHeaderIdx >= visitingIdx) throw new Error(`APA parse failed: home header (pos ${homeHeaderIdx}) appears after visiting section (pos ${visitingIdx}) — unexpected page layout.`);

  // Advance past the header to the first digit
  const homeHeaderMatch = text.slice(homeHeaderIdx).match(/SL\s*MP\s*Player\s*#?\s*Name/i);
  const homeBodyStart = homeHeaderIdx + (homeHeaderMatch ? homeHeaderMatch[0].length : 0);
  const homeBody = text.slice(homeBodyStart, visitingIdx);

  const visitingBlock  = text.slice(visitingIdx);
  const awayHeaderIdx  = visitingBlock.search(/SL\s*(?:MP\s*)?Player\s*#?\s*Name/i);
  if (awayHeaderIdx < 0) throw new Error('APA parse failed: could not find away player table header inside visiting section. Visiting block snippet: ' + visitingBlock.slice(0, 400));
  const awayHeaderMatch = visitingBlock.slice(awayHeaderIdx).match(/SL\s*(?:MP\s*)?Player\s*#?\s*Name/i);
  const awayBodyStart  = awayHeaderIdx + (awayHeaderMatch ? awayHeaderMatch[0].length : 0);
  const awayBody = visitingBlock.slice(awayBodyStart);

  const homePlayers = parseColumnMajorPlayers(homeBody);
  const awayPlayers = parseColumnMajorPlayers(awayBody);

  if (!homePlayers.length) throw new Error('APA parse failed: no valid home players found. Home body snippet: ' + homeBody.slice(0, 200));
  if (!awayPlayers.length) throw new Error('APA parse failed: no valid away players found. Away body snippet: ' + awayBody.slice(0, 200));

  return { divisionName, divisionNumber, gameFormat, weekNumber, matchDate, homeTeam, awayTeam, homePlayers, awayPlayers };
}

// Column-major digit block: [N×SL][N×MP][N×Member#(5)] = 7 chars/player
const CHARS_PER_PLAYER = 7;

function parseColumnMajorPlayers(section: string): PlayerData[] {
  // Strip player-status markers that pdfjs includes in the digit stream:
  //   * = incomplete information on file
  //   N = not paid  (only strip when immediately before a digit to avoid
  //                  corrupting names that also contain 'N')
  const cleanSection = section.replace(/N(?=\d)/g, '');

  const players: PlayerData[] = [];
  let pos = 0;

  while (pos < cleanSection.length) {
    // Skip to next digit
    while (pos < cleanSection.length && !/\d/.test(cleanSection[pos])) pos++;
    if (pos >= cleanSection.length) break;

    // Read consecutive digits
    const digitStart = pos;
    while (pos < cleanSection.length && /\d/.test(cleanSection[pos])) pos++;
    const digitBlock = cleanSection.slice(digitStart, pos);
    if (digitBlock.length < CHARS_PER_PLAYER) continue;

    const n = Math.floor(digitBlock.length / CHARS_PER_PLAYER);

    // Read names until the next 6+ consecutive digit block
    const nameStart = pos;
    while (pos < cleanSection.length && !/^\d{6}/.test(cleanSection.slice(pos))) pos++;
    const namesText = cleanSection.slice(nameStart, pos);
    const names = splitConcatenatedNames(namesText);

    const count = Math.min(n, names.length);
    for (let p = 0; p < count; p++) {
      const sl           = parseInt(digitBlock[p], 10);
      const matchesPlayed = parseInt(digitBlock[n + p], 10);
      const memberNumber = digitBlock.slice(2 * n + p * 5, 2 * n + (p + 1) * 5);
      if (sl >= 1 && sl <= 9 && memberNumber.length === 5) {
        players.push({ fullName: names[p], memberNumber, skillLevel: sl, matchesPlayed: isNaN(matchesPlayed) ? 0 : matchesPlayed });
      }
    }
  }

  return players;
}

// Split "Armstrong, JackBartol, Jude..." into ["Armstrong, Jack", "Bartol, Jude", ...]
function splitConcatenatedNames(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1\n$2')   // lowercase→uppercase boundary
    .replace(/(\d)([A-Z])/g, '$1\n$2')       // digit→uppercase boundary
    .split('\n')
    .map(s => s.replace(/\d+$/, '').trim())  // strip any trailing digits
    .filter(s => /^[A-Z][a-z]/.test(s) && s.includes(','));
}

// ---------------------------------------------------------------------------
// Parser 2 — Custom "Apa match data" table format
//
// Format detection: does NOT contain "Scoresheet for Team:"
//
// Each data row produces 8 non-blank lines after pdf extraction.
// Adjacent table cells at the same y-position are merged onto one line:
//
//   Line 0:  Division number          e.g. "435"
//   Line 1:  Game format              e.g. "8"
//   Line 2:  Week number              e.g. "4"
//   Line 3:  Date + home team name    e.g. "01/27/2026 we came to play"
//   Line 4:  Home # + away team name  e.g. "43502 why so hard"
//   Line 5:  Away # + home player     e.g. "43507 Armstrong, Jack"
//   Line 6:  Home SL + away player    e.g. "6 Bartol, Jude"
//   Line 7:  Away SL                  e.g. "3"
//
// NOTE: This format does NOT include APA member numbers.
// Member numbers are REQUIRED — please upgrade to the APA scoresheet
// format, or add member# columns to your custom template.
// ---------------------------------------------------------------------------

function parseAdminUploadFormat(text: string): MatchImportData | null {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Find start: 3–4 digit number followed immediately by '8' or '9'
  let dataStart = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\d{3,4}$/.test(lines[i]) && /^[89]$/.test(lines[i + 1])) {
      dataStart = i;
      break;
    }
  }
  if (dataStart === -1) return null;

  // We need at least one complete 8-line row to infer match info
  if (dataStart + 7 >= lines.length) return null;

  const rows: Array<{
    home: { fullName: string; skillLevel: number };
    away: { fullName: string; skillLevel: number };
  }> = [];

  let divisionName   = '';
  let gameFormat: 'eight_ball' | 'nine_ball' = 'eight_ball';
  let weekNumber     = 0;
  let matchDate      = '';
  let homeTeamName   = '';
  let homeTeamNumber = '';
  let awayTeamName   = '';
  let awayTeamNumber = '';

  for (let i = dataStart; i + 7 < lines.length; i += 8) {
    const divLine          = lines[i];
    const fmtLine          = lines[i + 1];
    const weekLine         = lines[i + 2];
    const dateHomeLine     = lines[i + 3];
    const homeNumAwayLine  = lines[i + 4];
    const awayNumHomePLine = lines[i + 5];
    const homeSlAwayPLine  = lines[i + 6];
    const awaySlLine       = lines[i + 7];

    if (!/^\d{3,4}$/.test(divLine)) break;
    if (!/^[89]$/.test(fmtLine)) break;
    if (!/^\d{1,2}$/.test(weekLine)) break;

    const dateM = dateHomeLine.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
    if (!dateM) continue;

    const homeNumM = homeNumAwayLine.match(/^(\d{5})\s+(.+)$/);
    if (!homeNumM) continue;

    const awayNumM = awayNumHomePLine.match(/^(\d{5})\s+(.+)$/);
    if (!awayNumM) continue;

    const homeSlM = homeSlAwayPLine.match(/^([1-9])\s+(.+)$/);
    if (!homeSlM) continue;

    const awaySl = parseInt(awaySlLine.trim(), 10);
    if (isNaN(awaySl) || awaySl < 1 || awaySl > 9) continue;

    // Grab match-level info from first row
    if (rows.length === 0) {
      divisionName   = divLine;
      gameFormat     = fmtLine === '8' ? 'eight_ball' : 'nine_ball';
      weekNumber     = parseInt(weekLine, 10);
      matchDate      = convertDate(dateM[1]);
      homeTeamName   = dateM[2].trim();
      homeTeamNumber = homeNumM[1];
      awayTeamName   = homeNumM[2].trim();
      awayTeamNumber = awayNumM[1];
    }

    rows.push({
      home: { fullName: awayNumM[2].trim(), skillLevel: parseInt(homeSlM[1], 10) },
      away: { fullName: homeSlM[2].trim(), skillLevel: awaySl },
    });
  }

  if (rows.length === 0) return null;

  // This format has no member numbers — all players will get
  // a placeholder memberNumber derived from team + name.
  // The admin should update players with real APA member numbers after import.
  const homePlayers: PlayerData[] = rows.map(r => ({
    fullName:      r.home.fullName,
    memberNumber:  buildPlaceholderMemberNumber(homeTeamNumber, r.home.fullName),
    skillLevel:    r.home.skillLevel,
    matchesPlayed: 0,
  }));

  const awayPlayers: PlayerData[] = rows.map(r => ({
    fullName:      r.away.fullName,
    memberNumber:  buildPlaceholderMemberNumber(awayTeamNumber, r.away.fullName),
    skillLevel:    r.away.skillLevel,
    matchesPlayed: 0,
  }));

  return {
    divisionName,
    divisionNumber: divisionName,  // custom format: divisionName IS the number (e.g. "435")
    gameFormat,
    weekNumber,
    matchDate,
    homeTeam: { number: homeTeamNumber, name: homeTeamName },
    awayTeam: { number: awayTeamNumber, name: awayTeamName },
    homePlayers,
    awayPlayers,
  };
}

/**
 * Build a deterministic placeholder when the PDF has no member numbers.
 * Format: "TMP-{teamNumber}-{3 chars of sanitised name}"
 * These are flagged as needing update — see the admin roster screen.
 */
function buildPlaceholderMemberNumber(teamNumber: string, fullName: string): string {
  const slug = fullName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
    .padEnd(3, 'X');
  return `TMP-${teamNumber}-${slug}`;
}

// ---------------------------------------------------------------------------
// Parser 3 — APA 9-ball official scoresheet PDF
//
// Key differences from the 8-ball sheet:
//   • "For Week Number: 9/15 On 03/04/2026" (not "For Week #:")
//     "9/15" = week 9 of 15; we extract the first number as weekNumber.
//   • Team number comes FIRST: "Team:44204Richie's Bill MU1" (no space between # and name)
//   • "LP\d" suffix on team name = "Late Pay week N" — strip from name.
//   • Two-column visual layout (home left / visiting right).
//     pdfjs reads this row-by-row, so "SL MP Player# Name" headers appear TWICE
//     (concatenated: "SLMPPlayer #NameSLMPPlayer #Name"), and player rows are
//     interleaved: [home 7-digit block][home name][visit 7-digit block][visit name]...
//   • 4-page PDF: pages 1 & 3 are blank, pages 2 & 4 are data.
// ---------------------------------------------------------------------------

/**
 * Parse 9-ball interleaved player rows.
 * pdfjs reads the two-column table row-by-row, so each row emits:
 *   [home_SL 1][home_MP 1][home_member# 5]  home_name
 *   [visit_SL 1][visit_MP 1][visit_member# 5]  visit_name
 * repeating for every player pair.
 */
// Validates "Last, First" APA name format.
// Rejects: empty strings, bare commas, names with digits/colons (standings/scoring text).
const VALID_PLAYER_NAME_RE = /^[A-Z][A-Za-z'\- ]+,\s*[A-Z]/;

function parseInterleavedPlayers(section: string): { homePlayers: PlayerData[]; awayPlayers: PlayerData[] } {
  const clean = section.replace(/N(?=\d)/g, '');
  const homePlayers: PlayerData[] = [];
  const awayPlayers: PlayerData[] = [];
  let pos = 0;

  while (pos < clean.length) {
    // Advance to next digit
    while (pos < clean.length && !/\d/.test(clean[pos])) pos++;
    if (pos >= clean.length) break;

    // Expect exactly 7 consecutive digits — home player block
    if (pos + 7 > clean.length) break;
    const homeBlock = clean.slice(pos, pos + 7);
    if (!/^\d{7}$/.test(homeBlock)) { pos++; continue; }
    pos += 7;

    const homeSL     = parseInt(homeBlock[0], 10);
    const homeMP     = parseInt(homeBlock[1], 10);
    const homeMember = homeBlock.slice(2);

    // Home player name: everything until the next 7-digit block
    const homeNameStart = pos;
    while (pos < clean.length && !/^\d{7}/.test(clean.slice(pos))) pos++;
    const homeName = clean.slice(homeNameStart, pos).replace(/\d+$/, '').trim();

    // Expect exactly 7 consecutive digits — visiting player block
    if (pos + 7 > clean.length) break;
    const visitBlock = clean.slice(pos, pos + 7);
    if (!/^\d{7}$/.test(visitBlock)) { pos++; continue; }
    pos += 7;

    const visitSL     = parseInt(visitBlock[0], 10);
    const visitMP     = parseInt(visitBlock[1], 10);
    const visitMember = visitBlock.slice(2);

    // Visiting player name: everything until the next 7-digit block or end
    const visitNameStart = pos;
    while (pos < clean.length && !/^\d{7}/.test(clean.slice(pos))) pos++;
    const visitName = clean.slice(visitNameStart, pos).replace(/\d+$/, '').trim();

    if (homeSL >= 1 && homeSL <= 9 && VALID_PLAYER_NAME_RE.test(homeName)) {
      homePlayers.push({ fullName: homeName, memberNumber: homeMember, skillLevel: homeSL, matchesPlayed: isNaN(homeMP) ? 0 : homeMP });
    }
    if (visitSL >= 1 && visitSL <= 9 && VALID_PLAYER_NAME_RE.test(visitName)) {
      awayPlayers.push({ fullName: visitName, memberNumber: visitMember, skillLevel: visitSL, matchesPlayed: isNaN(visitMP) ? 0 : visitMP });
    }
  }

  return { homePlayers, awayPlayers };
}

function parseAPANineBallScoresheet(text: string): MatchImportData {
  // 1. Week + date
  const weekDateM = text.match(
    /For\s*Week\s*(?:Number|#):\s*(\d+)\s*\/\s*\d+\s*On\s*(\d{2}\/\d{2}\/\d{4})/
  );
  if (!weekDateM) {
    throw new Error(
      '9-ball parse failed: could not find week/date (expected "For Week Number:N/NN OnMM/DD/YYYY"). Snippet: ' +
        text.slice(0, 300)
    );
  }
  const weekNumber = parseInt(weekDateM[1], 10);
  const matchDate  = convertDate(weekDateM[2]);

  // 2. Division (ends at "Division Rep" or "Division Standings")
  const divM = text.match(/Division:\s*(.+?)(?=Division\s+(?:Rep|Standings))/i);
  const divisionName = divM ? divM[1].trim() : 'Unknown';

  // 3. Team lines: "Team:NNNNN Name" (number-first, may have no space between # and name).
  //    The page header "Scoresheet for Team:Name..." has name-first (no leading digits)
  //    so it won't match Team:\s*(\d{5}).
  //    First match = home team, second match = visiting team.
  const stripLatePay = (s: string) => s.replace(/\s*LP\d+\s*$/, '').trim();
  const teamRe = /Team:\s*(\d{5})\s*(.+?)(?=Team:\s*\d{5}|Host\s*Location:|SL\s*\*?\s*MP)/gis;
  const teamMatches = [...text.matchAll(teamRe)];
  if (teamMatches.length < 2) {
    throw new Error(
      '9-ball parse failed: expected 2 team lines (Team:NNNNN Name), found ' +
        teamMatches.length + '. Snippet: ' + text.slice(0, 500)
    );
  }
  const homeTeam = { number: teamMatches[0][1], name: stripLatePay(teamMatches[0][2]) };
  const awayTeam = { number: teamMatches[1][1], name: stripLatePay(teamMatches[1][2]) };
  const divisionNumber = homeTeam.number.slice(0, 3);

  // 4. Find the player data section.
  //    Both "SL MP Player # Name" headers appear concatenated (one per column).
  //    Slice everything after the SECOND header — that's the interleaved player data.
  const headerRe = /SL\s*\*?\s*MP\s*Player\s*#?\s*Name/gi;
  const headers = [...text.matchAll(headerRe)];
  if (headers.length < 2) {
    throw new Error(
      '9-ball parse failed: expected 2 player table headers (one per column), found ' +
        headers.length + '. Snippet: ' + text.slice(0, 500)
    );
  }
  // The APA annotation legend begins with "N" (literally a double-quoted N):
  //   "N" Before Skill Level = Not Paid
  //   "$" After Players Name = Membership Amount Due
  //   "*" Before Skill Level = Incomplete Information On File
  // This appears after the last player name and must not be parsed as player data.
  // Double quotes never appear in legitimate player names or member numbers.
  const rawPlayerSection = text.slice((headers[1].index ?? 0) + headers[1][0].length);
  const legendStart = rawPlayerSection.indexOf('"');
  const playerSection = legendStart >= 0 ? rawPlayerSection.slice(0, legendStart) : rawPlayerSection;

  // 5. Parse interleaved rows
  const { homePlayers, awayPlayers } = parseInterleavedPlayers(playerSection);

  if (!homePlayers.length) {
    throw new Error('9-ball parse failed: no home players found. Section: ' + playerSection.slice(0, 200));
  }
  if (!awayPlayers.length) {
    throw new Error('9-ball parse failed: no away players found. Section: ' + playerSection.slice(0, 200));
  }

  return {
    divisionName,
    divisionNumber,
    gameFormat: 'nine_ball',
    weekNumber,
    matchDate,
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
  };
}

// ---------------------------------------------------------------------------
// Auto-detect format and parse
// ---------------------------------------------------------------------------

function detectAndParse(text: string): MatchImportData {
  // APA official 8-ball scoresheet
  if (text.includes('For Week #:') && text.includes('Team:Home Team')) {
    return parseAPAScoresheet(text);
  }

  // APA official 9-ball scoresheet ("For Week Number:" instead of "For Week #:")
  if (text.includes('For Week Number:')) {
    return parseAPANineBallScoresheet(text);
  }

  const result = parseAdminUploadFormat(text);
  if (!result) throw new Error('No valid data rows found. Verify the PDF uses the expected "Apa match data" table format.');
  return result;
}

// ---------------------------------------------------------------------------
// DB helpers — find-or-create
// ---------------------------------------------------------------------------

type DB = ReturnType<typeof createClient>;

async function findOrCreateDivision(db: DB, leagueId: string, name: string, divisionNumber: string): Promise<string> {
  const { data } = await db
    .from('divisions')
    .select('id, division_number')
    .eq('league_id', leagueId)
    .eq('name', name)
    .maybeSingle();

  if (data) {
    // Backfill division_number if not yet set
    if (!data.division_number && divisionNumber) {
      await db.from('divisions').update({ division_number: divisionNumber }).eq('id', data.id);
    }
    return data.id;
  }

  const { data: created, error } = await db
    .from('divisions')
    .insert({ league_id: leagueId, name, division_number: divisionNumber, day_of_week: 0 })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create division "${name}": ${error.message}`);
  return created.id;
}

async function findOrCreateTeam(
  db: DB,
  divisionId: string,
  teamNumber: string,
  teamName: string,
): Promise<string> {
  const { data } = await db
    .from('teams')
    .select('id')
    .eq('division_id', divisionId)
    .eq('team_number', teamNumber)
    .maybeSingle();

  if (data) return data.id;

  const { data: created, error } = await db
    .from('teams')
    .insert({ division_id: divisionId, name: teamName, team_number: teamNumber })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create team ${teamNumber}: ${error.message}`);
  return created.id;
}

async function findOrCreateTeamMatch(
  db: DB,
  divisionId: string,
  homeTeamId: string,
  awayTeamId: string,
  matchDate: string,
  weekNumber: number,
  importId: string,
): Promise<string> {
  const { data } = await db
    .from('team_matches')
    .select('id')
    .eq('division_id', divisionId)
    .eq('home_team_id', homeTeamId)
    .eq('away_team_id', awayTeamId)
    .eq('week_number', weekNumber)
    .maybeSingle();

  if (data) return data.id;

  const { data: created, error } = await db
    .from('team_matches')
    .insert({
      division_id:  divisionId,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      match_date:   matchDate,
      week_number:  weekNumber,
      status:       'imported',
      import_id:    importId,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create team match: ${error.message}`);
  return created.id;
}

async function findOrCreatePlayer(
  db: DB,
  player: PlayerData,
  gameFormat: string,
): Promise<string> {
  const { firstName, lastName } = parseName(player.fullName);

  // First try to find by member_number (definitive identifier)
  if (!player.memberNumber.startsWith('TMP-')) {
    const { data } = await db
      .from('players')
      .select('id')
      .eq('member_number', player.memberNumber)
      .maybeSingle();

    if (data) {
      // Member number is immutable; name and SL can change — always update them.
      // Write to both skill_level (backward compat) and the format-specific column.
      const slUpdate: Record<string, unknown> = {
        first_name:  firstName,
        last_name:   lastName,
        skill_level: player.skillLevel,
      };
      if (gameFormat === 'eight_ball') slUpdate.eight_ball_sl = player.skillLevel;
      else                             slUpdate.nine_ball_sl  = player.skillLevel;

      await db.from('players').update(slUpdate).eq('id', data.id);
      return data.id;
    }
  }

  // Fall back to name + game_format match
  const { data: byName } = await db
    .from('players')
    .select('id')
    .eq('first_name', firstName)
    .eq('last_name', lastName)
    .eq('game_format', gameFormat)
    .maybeSingle();

  if (byName) return byName.id;

  // Create new player — populate both skill_level and format-specific column
  const newPlayerData: Record<string, unknown> = {
    first_name:    firstName,
    last_name:     lastName,
    member_number: player.memberNumber,
    skill_level:   player.skillLevel,
    game_format:   gameFormat,
    is_active:     true,
  };
  if (gameFormat === 'eight_ball') newPlayerData.eight_ball_sl = player.skillLevel;
  else                             newPlayerData.nine_ball_sl  = player.skillLevel;

  const { data: created, error } = await db
    .from('players')
    .insert(newPlayerData)
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create player "${player.fullName}": ${error.message}`);
  return created.id;
}

async function upsertTeamPlayer(
  db: DB,
  teamId: string,
  playerId: string,
  matchesPlayed: number,
  isCaptain: boolean,
): Promise<void> {
  // is_captain is always written — the scoresheet is authoritative.
  // First player per team = captain (true); all others reset to false.
  // This ensures a captain change on a new scoresheet is immediately reflected.
  const { error } = await db
    .from('team_players')
    .upsert(
      { team_id: teamId, player_id: playerId, matches_played: matchesPlayed, is_captain: isCaptain },
      { onConflict: 'team_id,player_id' },
    );

  if (error) throw new Error(`Failed to link player to team: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Declared outside try so the catch block can mark the import as failed.
  let importId: string | undefined;
  let supabaseAdmin: ReturnType<typeof createClient> | undefined;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    // Verify admin role
    const { data: { user: caller } } = await supabaseClient.auth.getUser();
    if (!caller) throw new Error('Unauthorized');

    const { data: callerProfile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (!['admin', 'lo'].includes(callerProfile?.role)) throw new Error('Only league operators can import data');

    const body = await req.json();
    importId = body.importId;
    const { storagePath } = body;
    if (!importId || !storagePath) {
      throw new Error('Missing required fields: importId, storagePath');
    }

    // Auto-detect the active league — the LO operates in a single league.
    const { data: leagueRow, error: leagueErr } = await supabaseAdmin
      .from('leagues')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();
    if (leagueErr || !leagueRow) throw new Error('No active league found. Please create a league first.');
    const leagueId: string = leagueRow.id;

    await supabaseAdmin.from('imports').update({ status: 'processing' }).eq('id', importId);

    // Download PDF
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage
      .from('imports')
      .download(storagePath);
    if (dlErr) throw new Error(`Storage download failed: ${dlErr.message}`);

    // Extract text — process one page at a time so that two-copy PDFs
    // (each team gets their own printed copy on a separate page) don't
    // cause the parser to consume data from the second copy.
    const buf = await fileData.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text: pages } = await extractText(pdf, { mergePages: false });
    const pageList: string[] = Array.isArray(pages) ? pages : [pages as unknown as string];

    // Parse — try each page, use the first successful result.
    // Strip null bytes that pdfjs sometimes inserts (e.g. "Team:\u0000Home Team").
    let match: MatchImportData | null = null;
    let lastParseError = 'No pages could be parsed.';
    for (const pageText of pageList) {
      try {
        match = detectAndParse(pageText.replace(/\u0000/g, '').replace(/\*/g, ''));
        break;
      } catch (e: unknown) {
        lastParseError = e instanceof Error ? e.message : String(e);
      }
    }
    if (!match) throw new Error(lastParseError);

    let processedRows = 0;
    let errorRows     = 0;

    try {
      const divisionId = await findOrCreateDivision(supabaseAdmin, leagueId, match.divisionName, match.divisionNumber);
      const homeTeamId = await findOrCreateTeam(supabaseAdmin, divisionId, match.homeTeam.number, match.homeTeam.name);
      const awayTeamId = await findOrCreateTeam(supabaseAdmin, divisionId, match.awayTeam.number, match.awayTeam.name);
      await findOrCreateTeamMatch(supabaseAdmin, divisionId, homeTeamId, awayTeamId, match.matchDate, match.weekNumber, importId);

      // isFirst: true for the first player on each team's list — APA rule: first player = captain.
      const allPlayers: Array<{ player: PlayerData; teamId: string; isFirst: boolean }> = [
        ...match.homePlayers.map((p, i) => ({ player: p, teamId: homeTeamId, isFirst: i === 0 })),
        ...match.awayPlayers.map((p, i) => ({ player: p, teamId: awayTeamId, isFirst: i === 0 })),
      ];

      for (let i = 0; i < allPlayers.length; i++) {
        const { player, teamId, isFirst } = allPlayers[i];
        try {
          const playerId = await findOrCreatePlayer(supabaseAdmin, player, match.gameFormat);
          await upsertTeamPlayer(supabaseAdmin, teamId, playerId, player.matchesPlayed, isFirst);

          await supabaseAdmin.from('import_rows').insert({
            import_id:  importId,
            row_number: i + 1,
            raw_data:   { ...player, team } as unknown as Record<string, unknown>,
            status:     'success',
          });
          processedRows++;
        } catch (rowErr: unknown) {
          const msg = rowErr instanceof Error ? rowErr.message : String(rowErr);
          await supabaseAdmin.from('import_rows').insert({
            import_id:     importId,
            row_number:    i + 1,
            raw_data:      { ...player, team } as unknown as Record<string, unknown>,
            status:        'error',
            error_message: msg,
          });
          errorRows++;
        }
      }
    } catch (batchErr: unknown) {
      const msg = batchErr instanceof Error ? batchErr.message : String(batchErr);
      await supabaseAdmin.from('import_rows').insert({
        import_id:     importId,
        row_number:    0,
        raw_data:      { error: msg },
        status:        'error',
        error_message: msg,
      });
      errorRows = match.homePlayers.length + match.awayPlayers.length;
    }

    const totalRows  = match.homePlayers.length + match.awayPlayers.length;
    const finalStatus = processedRows === 0 ? 'failed' : 'completed';

    await supabaseAdmin.from('imports').update({
      status:         finalStatus,
      total_rows:     totalRows,
      processed_rows: processedRows,
      error_rows:     errorRows,
      completed_at:   new Date().toISOString(),
    }).eq('id', importId);

    return new Response(
      JSON.stringify({ success: processedRows > 0, totalRows, processedRows, errorRows }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    // Always mark the import as failed so it doesn't stay stuck in 'processing'.
    if (importId && supabaseAdmin) {
      await supabaseAdmin.from('imports').update({
        status:       'failed',
        error_rows:   1,
        completed_at: new Date().toISOString(),
      }).eq('id', importId);

      // Record the error as a row so it's visible in the import detail view.
      await supabaseAdmin.from('import_rows').insert({
        import_id:     importId,
        row_number:    0,
        raw_data:      { error: message },
        status:        'error',
        error_message: message,
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  }
});
