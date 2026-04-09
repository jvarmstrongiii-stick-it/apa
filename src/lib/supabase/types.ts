export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          reason: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      disputes: {
        Row: {
          created_at: string
          description: string
          id: string
          raised_by: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          team_match_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          raised_by: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          team_match_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          raised_by?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          team_match_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_team_match_id_fkey"
            columns: ["team_match_id"]
            isOneToOne: false
            referencedRelation: "team_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          created_at: string
          day_of_week: number
          division_number: string | null
          id: string
          is_active: boolean
          league_id: string
          location: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          division_number?: string | null
          id?: string
          is_active?: boolean
          league_id: string
          location?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          division_number?: string | null
          id?: string
          is_active?: boolean
          league_id?: string
          location?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "divisions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      eight_ball_race_chart: {
        Row: {
          id: number
          opponent_race: number
          opponent_skill: number
          player_race: number
          player_skill: number
        }
        Insert: {
          id?: number
          opponent_race: number
          opponent_skill: number
          player_race: number
          player_skill: number
        }
        Update: {
          id?: number
          opponent_race?: number
          opponent_skill?: number
          player_race?: number
          player_skill?: number
        }
        Relationships: []
      }
      import_rows: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          import_id: string
          raw_data: Json
          row_number: number
          status: Database["public"]["Enums"]["import_row_status"]
          team_match_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          import_id: string
          raw_data: Json
          row_number: number
          status: Database["public"]["Enums"]["import_row_status"]
          team_match_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          import_id?: string
          raw_data?: Json
          row_number?: number
          status?: Database["public"]["Enums"]["import_row_status"]
          team_match_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_team_match_id_fkey"
            columns: ["team_match_id"]
            isOneToOne: false
            referencedRelation: "team_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          completed_at: string | null
          created_at: string
          error_rows: number
          file_name: string
          file_type: string
          id: string
          league_id: string | null
          processed_rows: number
          started_at: string | null
          status: Database["public"]["Enums"]["import_status"]
          storage_path: string | null
          total_rows: number
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_rows?: number
          file_name: string
          file_type?: string
          id?: string
          league_id?: string | null
          processed_rows?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          total_rows?: number
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_rows?: number
          file_name?: string
          file_type?: string
          id?: string
          league_id?: string | null
          processed_rows?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          total_rows?: number
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "imports_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      individual_matches: {
        Row: {
          away_racks_won: number
          away_player_id: string | null
          away_points_earned: number
          away_racks_needed: number | null
          away_skill_level: number | null
          completed_at: string | null
          created_at: string
          defensive_shots: number
          game_format: Database["public"]["Enums"]["game_format"]
          home_racks_won: number
          home_player_id: string | null
          home_points_earned: number
          home_racks_needed: number | null
          home_skill_level: number | null
          id: string
          innings: number
          is_completed: boolean
          match_order: number
          put_up_team: string | null
          resumed_at: string | null
          team_match_id: string
          updated_at: string
        }
        Insert: {
          away_racks_won?: number
          away_player_id?: string | null
          away_points_earned?: number
          away_racks_needed?: number | null
          away_skill_level?: number | null
          completed_at?: string | null
          created_at?: string
          defensive_shots?: number
          game_format: Database["public"]["Enums"]["game_format"]
          home_racks_won?: number
          home_player_id?: string | null
          home_points_earned?: number
          home_racks_needed?: number | null
          home_skill_level?: number | null
          id?: string
          innings?: number
          is_completed?: boolean
          match_order: number
          put_up_team?: string | null
          resumed_at?: string | null
          team_match_id: string
          updated_at?: string
        }
        Update: {
          away_racks_won?: number
          away_player_id?: string | null
          away_points_earned?: number
          away_racks_needed?: number | null
          away_skill_level?: number | null
          completed_at?: string | null
          created_at?: string
          defensive_shots?: number
          game_format?: Database["public"]["Enums"]["game_format"]
          home_racks_won?: number
          home_player_id?: string | null
          home_points_earned?: number
          home_racks_needed?: number | null
          home_skill_level?: number | null
          id?: string
          innings?: number
          is_completed?: boolean
          match_order?: number
          put_up_team?: string | null
          resumed_at?: string | null
          team_match_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "individual_matches_away_player_id_fkey"
            columns: ["away_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_matches_home_player_id_fkey"
            columns: ["home_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_matches_team_match_id_fkey"
            columns: ["team_match_id"]
            isOneToOne: false
            referencedRelation: "team_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          created_by: string | null
          game_format: Database["public"]["Enums"]["game_format"]
          id: string
          is_active: boolean
          name: string
          season: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          game_format: Database["public"]["Enums"]["game_format"]
          id?: string
          is_active?: boolean
          name: string
          season: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          game_format?: Database["public"]["Enums"]["game_format"]
          id?: string
          is_active?: boolean
          name?: string
          season?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leagues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          created_at: string
          id: string
          is_confirmed: boolean
          player_1_id: string | null
          player_1_skill: number | null
          player_2_id: string | null
          player_2_skill: number | null
          player_3_id: string | null
          player_3_skill: number | null
          player_4_id: string | null
          player_4_skill: number | null
          player_5_id: string | null
          player_5_skill: number | null
          put_up_order: Json | null
          team_id: string
          team_match_id: string
          total_skill_level: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_confirmed?: boolean
          player_1_id?: string | null
          player_1_skill?: number | null
          player_2_id?: string | null
          player_2_skill?: number | null
          player_3_id?: string | null
          player_3_skill?: number | null
          player_4_id?: string | null
          player_4_skill?: number | null
          player_5_id?: string | null
          player_5_skill?: number | null
          put_up_order?: Json | null
          team_id: string
          team_match_id: string
          total_skill_level?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_confirmed?: boolean
          player_1_id?: string | null
          player_1_skill?: number | null
          player_2_id?: string | null
          player_2_skill?: number | null
          player_3_id?: string | null
          player_3_skill?: number | null
          player_4_id?: string | null
          player_4_skill?: number | null
          player_5_id?: string | null
          player_5_skill?: number | null
          put_up_order?: Json | null
          team_id?: string
          team_match_id?: string
          total_skill_level?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineups_player_1_id_fkey"
            columns: ["player_1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_player_2_id_fkey"
            columns: ["player_2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_player_3_id_fkey"
            columns: ["player_3_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_player_4_id_fkey"
            columns: ["player_4_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_player_5_id_fkey"
            columns: ["player_5_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_team_match_id_fkey"
            columns: ["team_match_id"]
            isOneToOne: false
            referencedRelation: "team_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      nine_ball_point_targets: {
        Row: {
          id: number
          points_required: number
          skill_level: number
        }
        Insert: {
          id?: number
          points_required: number
          skill_level: number
        }
        Update: {
          id?: number
          points_required?: number
          skill_level?: number
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string
          current_8_ball_sl: number | null
          current_9_ball_sl: number | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          member_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_8_ball_sl?: number | null
          current_9_ball_sl?: number | null
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          member_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_8_ball_sl?: number | null
          current_9_ball_sl?: number | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          member_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          role: Database["public"]["Enums"]["user_role"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      racks_eight_ball: {
        Row: {
          created_at: string
          dead_rack: boolean
          id: string
          individual_match_id: string
          innings_away: number | null
          innings_home: number | null
          innings_verified: boolean
          is_break_and_run: boolean
          is_eight_on_break: boolean
          rack_number: number
          updated_at: string
          won_by: string | null
        }
        Insert: {
          created_at?: string
          dead_rack?: boolean
          id?: string
          individual_match_id: string
          innings_away?: number | null
          innings_home?: number | null
          innings_verified?: boolean
          is_break_and_run?: boolean
          is_eight_on_break?: boolean
          rack_number: number
          updated_at?: string
          won_by?: string | null
        }
        Update: {
          created_at?: string
          dead_rack?: boolean
          id?: string
          individual_match_id?: string
          innings_away?: number | null
          innings_home?: number | null
          innings_verified?: boolean
          is_break_and_run?: boolean
          is_eight_on_break?: boolean
          rack_number?: number
          updated_at?: string
          won_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "racks_eight_ball_individual_match_id_fkey"
            columns: ["individual_match_id"]
            isOneToOne: false
            referencedRelation: "individual_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      racks_nine_ball: {
        Row: {
          balls_pocketed_away: Json
          balls_pocketed_home: Json
          created_at: string
          dead_balls: Json
          id: string
          individual_match_id: string
          innings_away: number | null
          innings_home: number | null
          innings_verified: boolean
          is_break_and_run: boolean
          points_away: number
          points_home: number
          rack_number: number
          updated_at: string
        }
        Insert: {
          balls_pocketed_away?: Json
          balls_pocketed_home?: Json
          created_at?: string
          dead_balls?: Json
          id?: string
          individual_match_id: string
          innings_away?: number | null
          innings_home?: number | null
          innings_verified?: boolean
          is_break_and_run?: boolean
          points_away?: number
          points_home?: number
          rack_number: number
          updated_at?: string
        }
        Update: {
          balls_pocketed_away?: Json
          balls_pocketed_home?: Json
          created_at?: string
          dead_balls?: Json
          id?: string
          individual_match_id?: string
          innings_away?: number | null
          innings_home?: number | null
          innings_verified?: boolean
          is_break_and_run?: boolean
          points_away?: number
          points_home?: number
          rack_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "racks_nine_ball_individual_match_id_fkey"
            columns: ["individual_match_id"]
            isOneToOne: false
            referencedRelation: "individual_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      scorecard_sessions: {
        Row: {
          id: string
          is_active: boolean
          last_heartbeat: string | null
          locked_at: string | null
          locked_by: string | null
          team_match_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          last_heartbeat?: string | null
          locked_at?: string | null
          locked_by?: string | null
          team_match_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          last_heartbeat?: string | null
          locked_at?: string | null
          locked_by?: string | null
          team_match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_sessions_team_match_id_fkey"
            columns: ["team_match_id"]
            isOneToOne: true
            referencedRelation: "team_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_level_history: {
        Row: {
          created_at: string
          effective_date: string
          id: string
          league_id: string
          new_level: number
          old_level: number
          player_id: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          id?: string
          league_id: string
          new_level: number
          old_level: number
          player_id: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          id?: string
          league_id?: string
          new_level?: number
          old_level?: number
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_level_history_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_level_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      team_matches: {
        Row: {
          away_score: number
          away_team_id: string
          coin_flip_done: boolean
          created_at: string
          division_id: string
          finalized_at: string | null
          finalized_by: string | null
          first_put_up_team: string | null
          game_format: Database["public"]["Enums"]["game_format"]
          home_score: number
          home_team_id: string
          id: string
          import_id: string | null
          locked_at: string | null
          locked_by: string | null
          match_date: string
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          week_number: number
        }
        Insert: {
          away_score?: number
          away_team_id: string
          coin_flip_done?: boolean
          created_at?: string
          division_id: string
          finalized_at?: string | null
          finalized_by?: string | null
          first_put_up_team?: string | null
          game_format: Database["public"]["Enums"]["game_format"]
          home_score?: number
          home_team_id: string
          id?: string
          import_id?: string | null
          locked_at?: string | null
          locked_by?: string | null
          match_date: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          week_number: number
        }
        Update: {
          away_score?: number
          away_team_id?: string
          coin_flip_done?: boolean
          created_at?: string
          division_id?: string
          finalized_at?: string | null
          finalized_by?: string | null
          first_put_up_team?: string | null
          game_format?: Database["public"]["Enums"]["game_format"]
          home_score?: number
          home_team_id?: string
          id?: string
          import_id?: string | null
          locked_at?: string | null
          locked_by?: string | null
          match_date?: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_matches_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_matches_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_matches_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_matches_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_players: {
        Row: {
          current_8_ball_sl: number | null
          current_9_ball_sl: number | null
          id: string
          is_active: boolean
          is_captain: boolean
          joined_at: string
          left_at: string | null
          matches_played: number
          player_id: string
          team_id: string
        }
        Insert: {
          current_8_ball_sl?: number | null
          current_9_ball_sl?: number | null
          id?: string
          is_active?: boolean
          is_captain?: boolean
          joined_at?: string
          left_at?: string | null
          matches_played?: number
          player_id: string
          team_id: string
        }
        Update: {
          current_8_ball_sl?: number | null
          current_9_ball_sl?: number | null
          id?: string
          is_active?: boolean
          is_captain?: boolean
          joined_at?: string
          left_at?: string | null
          matches_played?: number
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          division_id: string
          id: string
          is_active: boolean
          name: string
          team_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          division_id: string
          id?: string
          is_active?: boolean
          name: string
          team_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          division_id?: string
          id?: string
          is_active?: boolean
          name?: string
          team_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      finalize_team_match: {
        Args: {
          p_away_points: number
          p_home_points: number
          p_team_match_id: string
        }
        Returns: undefined
      }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_team_id: { Args: never; Returns: string }
      heartbeat_scorecard: {
        Args: { p_team_match_id: string }
        Returns: undefined
      }
      lock_scorecard: {
        Args: { p_team_match_id: string }
        Returns: {
          id: string
          is_active: boolean
          last_heartbeat: string | null
          locked_at: string | null
          locked_by: string | null
          team_match_id: string
        }
        SetofOptions: {
          from: "*"
          to: "scorecard_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_team_match: {
        Args: { p_reason: string; p_team_match_id: string }
        Returns: undefined
      }
      set_player_team: { Args: { p_team_id: string }; Returns: undefined }
      unlock_scorecard: {
        Args: { p_team_match_id: string }
        Returns: undefined
      }
    }
    Enums: {
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "finalize"
        | "reopen"
        | "lock"
        | "unlock"
        | "import"
        | "dispute_create"
        | "dispute_resolve"
      dispute_status: "open" | "under_review" | "resolved" | "dismissed"
      game_format: "eight_ball" | "nine_ball" | "both"
      import_row_status: "success" | "error" | "skipped"
      import_status: "pending" | "processing" | "completed" | "failed"
      match_status:
        | "imported"
        | "scheduled"
        | "lineup_set"
        | "in_progress"
        | "completed"
        | "finalized"
        | "disputed"
      user_role: "admin" | "team" | "lo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      audit_action: [
        "create",
        "update",
        "delete",
        "finalize",
        "reopen",
        "lock",
        "unlock",
        "import",
        "dispute_create",
        "dispute_resolve",
      ],
      dispute_status: ["open", "under_review", "resolved", "dismissed"],
      game_format: ["eight_ball", "nine_ball", "both"],
      import_row_status: ["success", "error", "skipped"],
      import_status: ["pending", "processing", "completed", "failed"],
      match_status: [
        "imported",
        "scheduled",
        "lineup_set",
        "in_progress",
        "completed",
        "finalized",
        "disputed",
      ],
      user_role: ["admin", "team", "lo"],
    },
  },
} as const
