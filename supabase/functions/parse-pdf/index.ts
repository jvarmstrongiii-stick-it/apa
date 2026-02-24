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
  divisionName: string;                      // "435" or "8-BALL Warminster…"
  gameFormat:   'eight_ball' | 'nine_ball';
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
  if (!weekDateM) return null;
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
  if (!homeM || !awayM) return null;
  const homeTeam = { number: homeM[2], name: homeM[1].trim() };
  const awayTeam = { number: awayM[2], name: awayM[1].trim() };

  // 4. Player section boundaries
  const homeHeaderIdx = text.search(/SL\s*\*?\s*MP\s*Player\s*#?\s*Name/i);
  const visitingIdx   = text.search(/Team:\s*Visiting\s*Team/i);
  if (homeHeaderIdx < 0 || visitingIdx < 0 || homeHeaderIdx >= visitingIdx) return null;

  // Advance past the header to the first digit
  const homeHeaderMatch = text.slice(homeHeaderIdx).match(/SL\s*\*?\s*MP\s*Player\s*#?\s*Name/i);
  const homeBodyStart = homeHeaderIdx + (homeHeaderMatch ? homeHeaderMatch[0].length : 0);
  const homeBody = text.slice(homeBodyStart, visitingIdx);

  const visitingBlock  = text.slice(visitingIdx);
  const awayHeaderIdx  = visitingBlock.search(/SL\s*(?:\*?\s*MP\s*)?Player\s*#?\s*Name/i);
  if (awayHeaderIdx < 0) return null;
  const awayHeaderMatch = visitingBlock.slice(awayHeaderIdx).match(/SL\s*(?:\*?\s*MP\s*)?Player\s*#?\s*Name/i);
  const awayBodyStart  = awayHeaderIdx + (awayHeaderMatch ? awayHeaderMatch[0].length : 0);
  const awayBody = visitingBlock.slice(awayBodyStart);

  const homePlayers = parseColumnMajorPlayers(homeBody);
  const awayPlayers = parseColumnMajorPlayers(awayBody);

  if (!homePlayers.length || !awayPlayers.length) return null;

  return { divisionName, gameFormat, weekNumber, matchDate, homeTeam, awayTeam, homePlayers, awayPlayers };
}

// Column-major digit block: [N×SL][N×MP][N×Member#(5)] = 7 chars/player
const CHARS_PER_PLAYER = 7;

function parseColumnMajorPlayers(section: string): PlayerData[] {
  // Strip player-status markers that pdfjs includes in the digit stream:
  //   * = incomplete information on file
  //   N = not paid  (only strip when immediately before a digit to avoid
  //                  corrupting names that also contain 'N')
  const cleanSection = section.replace(/\*/g, '').replace(/N(?=\d)/g, '');

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
// Auto-detect format and parse
// ---------------------------------------------------------------------------

function detectAndParse(text: string): MatchImportData {
  // APA official scoresheet: pdfjs extracts "For Week #:" near the top
  if (text.includes('For Week #:') && (text.includes('Team:Home Team') || text.includes('Team:\u0000Home Team'))) {
    const result = parseAPAScoresheet(text);
    if (!result) throw new Error('PDF appears to be an APA scoresheet but could not be parsed. Verify the file is a valid team scoresheet.');
    return result;
  }

  const result = parseAdminUploadFormat(text);
  if (!result) throw new Error('No valid data rows found. Verify the PDF uses the expected "Apa match data" table format.');
  return result;
}

// ---------------------------------------------------------------------------
// DB helpers — find-or-create
// ---------------------------------------------------------------------------

type DB = ReturnType<typeof createClient>;

async function findOrCreateDivision(db: DB, leagueId: string, name: string): Promise<string> {
  const { data } = await db
    .from('divisions')
    .select('id')
    .eq('league_id', leagueId)
    .eq('name', name)
    .maybeSingle();

  if (data) return data.id;

  const { data: created, error } = await db
    .from('divisions')
    .insert({ league_id: leagueId, name, day_of_week: 0 })
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
      status:       'scheduled',
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
      // Member number is immutable; name can change — always update it
      await db.from('players').update({
        first_name:  firstName,
        last_name:   lastName,
        skill_level: player.skillLevel,
      }).eq('id', data.id);
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

  // Create new player
  const { data: created, error } = await db
    .from('players')
    .insert({
      first_name:    firstName,
      last_name:     lastName,
      member_number: player.memberNumber,
      skill_level:   player.skillLevel,
      game_format:   gameFormat,
      is_active:     true,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create player "${player.fullName}": ${error.message}`);
  return created.id;
}

async function upsertTeamPlayer(db: DB, teamId: string, playerId: string, matchesPlayed: number): Promise<void> {
  const { error } = await db
    .from('team_players')
    .upsert(
      { team_id: teamId, player_id: playerId, is_captain: false, matches_played: matchesPlayed },
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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabaseAdmin = createClient(
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

    if (callerProfile?.role !== 'admin') throw new Error('Only admins can import data');

    const { importId, storagePath, leagueId } = await req.json();
    if (!importId || !storagePath || !leagueId) {
      throw new Error('Missing required fields: importId, storagePath, leagueId');
    }

    await supabaseAdmin.from('imports').update({ status: 'processing' }).eq('id', importId);

    // Download PDF
    const { data: fileData, error: dlErr } = await supabaseAdmin.storage
      .from('imports')
      .download(storagePath);
    if (dlErr) throw new Error(`Storage download failed: ${dlErr.message}`);

    // Extract text
    const buf = await fileData.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });

    // Parse
    const match = detectAndParse(text);

    let processedRows = 0;
    let errorRows     = 0;

    try {
      const divisionId = await findOrCreateDivision(supabaseAdmin, leagueId, match.divisionName);
      const homeTeamId = await findOrCreateTeam(supabaseAdmin, divisionId, match.homeTeam.number, match.homeTeam.name);
      const awayTeamId = await findOrCreateTeam(supabaseAdmin, divisionId, match.awayTeam.number, match.awayTeam.name);
      await findOrCreateTeamMatch(supabaseAdmin, divisionId, homeTeamId, awayTeamId, match.matchDate, match.weekNumber);

      const allPlayers: Array<{ player: PlayerData; teamId: string; rowLabel: string }> = [
        ...match.homePlayers.map((p, i) => ({ player: p, teamId: homeTeamId, rowLabel: `home-${i + 1}` })),
        ...match.awayPlayers.map((p, i) => ({ player: p, teamId: awayTeamId, rowLabel: `away-${i + 1}` })),
      ];

      for (let i = 0; i < allPlayers.length; i++) {
        const { player, teamId } = allPlayers[i];
        try {
          const playerId = await findOrCreatePlayer(supabaseAdmin, player, match.gameFormat);
          await upsertTeamPlayer(supabaseAdmin, teamId, playerId, player.matchesPlayed);

          await supabaseAdmin.from('import_rows').insert({
            import_id:  importId,
            row_number: i + 1,
            raw_data:   player as unknown as Record<string, unknown>,
            status:     'success',
          });
          processedRows++;
        } catch (rowErr: unknown) {
          const msg = rowErr instanceof Error ? rowErr.message : String(rowErr);
          await supabaseAdmin.from('import_rows').insert({
            import_id:     importId,
            row_number:    i + 1,
            raw_data:      player as unknown as Record<string, unknown>,
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
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  }
});
