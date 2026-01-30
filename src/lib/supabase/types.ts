// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'team';

export type GameFormat = 'eight_ball' | 'nine_ball';

export type MatchStatus =
  | 'scheduled'
  | 'lineup_set'
  | 'in_progress'
  | 'completed'
  | 'finalized'
  | 'disputed';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'finalize'
  | 'dispute'
  | 'resolve';

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type ImportRowStatus = 'pending' | 'success' | 'error' | 'skipped';

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

// ---------------------------------------------------------------------------
// Table row types (the shape returned by SELECT queries)
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  role: UserRole;
  team_id: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface League {
  id: string;
  name: string;
  game_format: GameFormat;
  season: string;
  year: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Division {
  id: string;
  league_id: string;
  name: string;
  day_of_week: number;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  division_id: string;
  name: string;
  team_number: string;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  member_number: string;
  first_name: string;
  last_name: string;
  skill_level: number;
  game_format: GameFormat;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamPlayer {
  id: string;
  team_id: string;
  player_id: string;
  is_captain: boolean;
  joined_at: string;
  left_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillLevelHistory {
  id: string;
  player_id: string;
  game_format: GameFormat;
  old_skill_level: number;
  new_skill_level: number;
  changed_at: string;
  reason: string | null;
  created_at: string;
}

export interface TeamMatch {
  id: string;
  division_id: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  week_number: number;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  locked_by: string | null;
  locked_at: string | null;
  finalized_by: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lineup {
  id: string;
  team_match_id: string;
  team_id: string;
  player_id: string;
  position: number;
  skill_level_at_time: number;
  created_at: string;
  updated_at: string;
}

export interface IndividualMatch {
  id: string;
  team_match_id: string;
  match_order: number;
  home_player_id: string;
  away_player_id: string;
  home_skill_level: number;
  away_skill_level: number;
  home_points_earned: number | null;
  away_points_earned: number | null;
  winner_player_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RacksEightBall {
  id: string;
  individual_match_id: string;
  home_innings: number | null;
  home_defensive_shots: number | null;
  home_wins: number;
  away_wins: number;
  home_on_break: boolean;
  created_at: string;
  updated_at: string;
}

export interface RacksNineBall {
  id: string;
  individual_match_id: string;
  home_innings: number | null;
  home_defensive_shots: number | null;
  home_points: number;
  away_points: number;
  home_on_break: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScorecardSession {
  id: string;
  team_match_id: string;
  user_id: string;
  started_at: string;
  last_heartbeat: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Import {
  id: string;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  status: ImportStatus;
  total_rows: number;
  processed_rows: number;
  error_rows: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportRow {
  id: string;
  import_id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  status: ImportRowStatus;
  error_message: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: AuditAction;
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  team_match_id: string;
  raised_by: string;
  status: DisputeStatus;
  reason: string;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Insert types (fields required when creating a new row)
// ---------------------------------------------------------------------------

export interface ProfileInsert {
  id: string;
  role?: UserRole;
  team_id?: string | null;
  display_name?: string | null;
}

export interface LeagueInsert {
  name: string;
  game_format: GameFormat;
  season: string;
  year: number;
  is_active?: boolean;
  created_by: string;
}

export interface DivisionInsert {
  league_id: string;
  name: string;
  day_of_week: number;
  location?: string | null;
}

export interface TeamInsert {
  division_id: string;
  name: string;
  team_number: string;
}

export interface PlayerInsert {
  member_number: string;
  first_name: string;
  last_name: string;
  skill_level: number;
  game_format: GameFormat;
  is_active?: boolean;
}

export interface TeamPlayerInsert {
  team_id: string;
  player_id: string;
  is_captain?: boolean;
  joined_at?: string;
  left_at?: string | null;
}

export interface SkillLevelHistoryInsert {
  player_id: string;
  game_format: GameFormat;
  old_skill_level: number;
  new_skill_level: number;
  changed_at?: string;
  reason?: string | null;
}

export interface TeamMatchInsert {
  division_id: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  week_number: number;
  status?: MatchStatus;
  home_score?: number | null;
  away_score?: number | null;
}

export interface LineupInsert {
  team_match_id: string;
  team_id: string;
  player_id: string;
  position: number;
  skill_level_at_time: number;
}

export interface IndividualMatchInsert {
  team_match_id: string;
  match_order: number;
  home_player_id: string;
  away_player_id: string;
  home_skill_level: number;
  away_skill_level: number;
  home_points_earned?: number | null;
  away_points_earned?: number | null;
  winner_player_id?: string | null;
}

export interface RacksEightBallInsert {
  individual_match_id: string;
  home_innings?: number | null;
  home_defensive_shots?: number | null;
  home_wins: number;
  away_wins: number;
  home_on_break?: boolean;
}

export interface RacksNineBallInsert {
  individual_match_id: string;
  home_innings?: number | null;
  home_defensive_shots?: number | null;
  home_points: number;
  away_points: number;
  home_on_break?: boolean;
}

export interface ScorecardSessionInsert {
  team_match_id: string;
  user_id: string;
  started_at?: string;
  last_heartbeat?: string;
  is_active?: boolean;
}

export interface ImportInsert {
  uploaded_by: string;
  file_name: string;
  file_type: string;
  status?: ImportStatus;
  total_rows?: number;
  processed_rows?: number;
  error_rows?: number;
}

export interface ImportRowInsert {
  import_id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  status?: ImportRowStatus;
  error_message?: string | null;
}

export interface AuditLogEntryInsert {
  user_id: string;
  action: AuditAction;
  table_name: string;
  record_id: string;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  ip_address?: string | null;
}

export interface DisputeInsert {
  team_match_id: string;
  raised_by: string;
  status?: DisputeStatus;
  reason: string;
  resolution?: string | null;
}

// ---------------------------------------------------------------------------
// Update types (all fields optional except those that form the primary key)
// ---------------------------------------------------------------------------

export interface ProfileUpdate {
  role?: UserRole;
  team_id?: string | null;
  display_name?: string | null;
}

export interface LeagueUpdate {
  name?: string;
  game_format?: GameFormat;
  season?: string;
  year?: number;
  is_active?: boolean;
}

export interface DivisionUpdate {
  league_id?: string;
  name?: string;
  day_of_week?: number;
  location?: string | null;
}

export interface TeamUpdate {
  division_id?: string;
  name?: string;
  team_number?: string;
}

export interface PlayerUpdate {
  member_number?: string;
  first_name?: string;
  last_name?: string;
  skill_level?: number;
  game_format?: GameFormat;
  is_active?: boolean;
}

export interface TeamPlayerUpdate {
  is_captain?: boolean;
  left_at?: string | null;
}

export interface TeamMatchUpdate {
  match_date?: string;
  week_number?: number;
  status?: MatchStatus;
  home_score?: number | null;
  away_score?: number | null;
  locked_by?: string | null;
  locked_at?: string | null;
  finalized_by?: string | null;
  finalized_at?: string | null;
}

export interface LineupUpdate {
  player_id?: string;
  position?: number;
  skill_level_at_time?: number;
}

export interface IndividualMatchUpdate {
  match_order?: number;
  home_player_id?: string;
  away_player_id?: string;
  home_skill_level?: number;
  away_skill_level?: number;
  home_points_earned?: number | null;
  away_points_earned?: number | null;
  winner_player_id?: string | null;
}

export interface RacksEightBallUpdate {
  home_innings?: number | null;
  home_defensive_shots?: number | null;
  home_wins?: number;
  away_wins?: number;
  home_on_break?: boolean;
}

export interface RacksNineBallUpdate {
  home_innings?: number | null;
  home_defensive_shots?: number | null;
  home_points?: number;
  away_points?: number;
  home_on_break?: boolean;
}

export interface ScorecardSessionUpdate {
  last_heartbeat?: string;
  is_active?: boolean;
}

export interface ImportUpdate {
  status?: ImportStatus;
  total_rows?: number;
  processed_rows?: number;
  error_rows?: number;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface ImportRowUpdate {
  status?: ImportRowStatus;
  error_message?: string | null;
}

export interface DisputeUpdate {
  status?: DisputeStatus;
  reason?: string;
  resolution?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
}

// ---------------------------------------------------------------------------
// Aggregate Database type (mirrors Supabase generated types pattern)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      leagues: {
        Row: League;
        Insert: LeagueInsert;
        Update: LeagueUpdate;
      };
      divisions: {
        Row: Division;
        Insert: DivisionInsert;
        Update: DivisionUpdate;
      };
      teams: {
        Row: Team;
        Insert: TeamInsert;
        Update: TeamUpdate;
      };
      players: {
        Row: Player;
        Insert: PlayerInsert;
        Update: PlayerUpdate;
      };
      team_players: {
        Row: TeamPlayer;
        Insert: TeamPlayerInsert;
        Update: TeamPlayerUpdate;
      };
      skill_level_history: {
        Row: SkillLevelHistory;
        Insert: SkillLevelHistoryInsert;
        Update: never;
      };
      team_matches: {
        Row: TeamMatch;
        Insert: TeamMatchInsert;
        Update: TeamMatchUpdate;
      };
      lineups: {
        Row: Lineup;
        Insert: LineupInsert;
        Update: LineupUpdate;
      };
      individual_matches: {
        Row: IndividualMatch;
        Insert: IndividualMatchInsert;
        Update: IndividualMatchUpdate;
      };
      racks_eight_ball: {
        Row: RacksEightBall;
        Insert: RacksEightBallInsert;
        Update: RacksEightBallUpdate;
      };
      racks_nine_ball: {
        Row: RacksNineBall;
        Insert: RacksNineBallInsert;
        Update: RacksNineBallUpdate;
      };
      scorecard_sessions: {
        Row: ScorecardSession;
        Insert: ScorecardSessionInsert;
        Update: ScorecardSessionUpdate;
      };
      imports: {
        Row: Import;
        Insert: ImportInsert;
        Update: ImportUpdate;
      };
      import_rows: {
        Row: ImportRow;
        Insert: ImportRowInsert;
        Update: ImportRowUpdate;
      };
      audit_log: {
        Row: AuditLogEntry;
        Insert: AuditLogEntryInsert;
        Update: never;
      };
      disputes: {
        Row: Dispute;
        Insert: DisputeInsert;
        Update: DisputeUpdate;
      };
    };
    Enums: {
      user_role: UserRole;
      game_format: GameFormat;
      match_status: MatchStatus;
      audit_action: AuditAction;
      import_status: ImportStatus;
      import_row_status: ImportRowStatus;
      dispute_status: DisputeStatus;
    };
  };
}
