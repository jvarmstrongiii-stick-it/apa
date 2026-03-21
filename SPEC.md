# Pool League Scoring App — Working Specification
**Living Document | Updated 2026-03-21**

---

## Table of Contents
1. [Overview](#1-overview)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Auth & Roles](#3-auth--roles)
4. [Data Model (Actual Schema)](#4-data-model-actual-schema)
5. [Feature Inventory](#5-feature-inventory)
6. [Screen Inventory](#6-screen-inventory)
7. [Business Logic & Rules](#7-business-logic--rules)
8. [Known Gaps & Conflicts](#8-known-gaps--conflicts)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. Overview

A multi-league pool scoring app. APA is the primary initial use case. All rule sets, scoring structures, and match configurations are designed to be configurable via a League Settings system (partially implemented — see gaps).

The app is a **contingency scorekeeper**: it supplements official paper scoresheets and provides real-time digital tracking during matches. Final authority remains with the paper scoresheet; the app is the digital assistant.

Three user roles: **Team** (scorekeepers, anonymous auth), **LO** (League Operator, email/password), and **Superuser/Admin** (platform admin, email/password).

---

## 2. Tech Stack & Architecture

| Layer | Choice |
|---|---|
| Framework | React Native / Expo SDK 54 |
| Router | Expo Router (file-based) |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Edge Functions | Deno (Supabase Functions) |
| PDF Parsing | `npm:unpdf` (pdfjs) in edge function |
| Haptics | `expo-haptics` |
| Secure Storage | `expo-secure-store` |
| Icons | `@expo/vector-icons` (Ionicons) |
| AI Rules Assistant | Anthropic API (`claude-opus-4-6`), key via `EXPO_PUBLIC_ANTHROPIC_KEY` |
| Voice Input | `expo-speech-recognition` (requires custom dev client; gracefully degrades in Expo Go) |

**Supabase project ref:** `lyhlnaibdqznipllfmuu`

**Realtime:** Enabled on `individual_matches` table via `ALTER PUBLICATION supabase_realtime ADD TABLE individual_matches`.

---

## 3. Auth & Roles

### Team (Player) Auth
- `supabase.auth.signInAnonymously()` — no credentials
- `supabase.rpc('set_player_team', { p_team_id })` upserts profile (SECURITY DEFINER, bypasses RLS)
- `supabase.rpc('set_player_identity', { p_player_id })` sets `profiles.player_id` after player selects themselves from roster (SECURITY DEFINER)
- Cold launch always shows login screen (existing session signed out on bootstrap)
- "My Teams" preference stored in `expo-secure-store` key `team-prefs`
- Player identity stored in `expo-secure-store` key `player-identity-${teamId}` = `{ playerId, playerName, isCaptain }`
- Season fingerprint: active league IDs — change clears stored teams

### LO (League Operator) Auth
- Email/password via `supabase.auth.signInWithPassword()`
- Profile `role = 'lo'`
- Created by superuser via `create-lo-account` edge function
- Assigned to one league (`league_id` on profile); area name shown as league's `name`
- Access: PDF import, match management, league data — same as admin but scoped
- Login via "League Operator Login" link on the player login screen

### Superuser (Admin) Auth
- Email/password via `supabase.auth.signInWithPassword()`
- Profile `role = 'admin'`
- Access: full platform — creates leagues, manages LO accounts
- Login via `/(auth)/admin-login`
- Dashboard: Switch User (→ player login) | Log Out (→ admin login)

### Login Flow (3 steps) — Team side
1. **Pick**: "Continue as Player" (team picker, plain list from scheduled matches only) | "League Operator Login"
2. **Confirm**: "You selected [team]?" → Yes / Change Team
3. **Who Are You?**: roster picker — player selects their own name; sets `profiles.player_id` + stores identity in SecureStore. Returning users see "Continue as [Name]?" with Yes / Not Me options.

After step 3, login always routes to the **Team Dashboard** (`/`). Match navigation happens from the dashboard or the Scoring tab — not from the login flow.

`refreshProfile()` is called after identity is set so `isCaptain` is accurate before navigating to team screens.

---

## 4. Data Model (Actual Schema)

### Enums
| Type | Values |
|---|---|
| `game_format` | `eight_ball`, `nine_ball` |
| `match_status` | `imported`, `scheduled`, `lineup_set`, `in_progress`, `completed`, `finalized`, `disputed` |
| `audit_action` | `create`, `update`, `delete`, `finalize`, `reopen`, `lock`, `unlock`, `import`, `dispute_create`, `dispute_resolve` |
| `user_role` | `admin`, `lo`, `team` |
| `import_status` | `pending`, `processing`, `completed`, `failed` |
| `import_row_status` | `success`, `error`, `skipped` |
| `dispute_status` | `open`, `under_review`, `resolved`, `dismissed` |

### profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | FK → auth.users |
| role | user_role | DEFAULT 'team' |
| team_id | uuid | FK → teams (team role only) |
| player_id | uuid | FK → players ON DELETE SET NULL — which player this session belongs to; set via `set_player_identity` RPC after "Who Are You?" step |
| first_name | text | |
| last_name | text | |
| display_name | text | |
| email | text | LO login email (for password reset flows) |
| league_id | uuid | FK → leagues ON DELETE SET NULL (LO role: links to managed league) |

### leagues
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | Also used as LO's "area" display name |
| game_format | game_format | |
| season | text | e.g. 'Spring' |
| year | integer | |
| is_active | boolean | DEFAULT true |
| created_by | uuid | FK → profiles |
| scorekeeper_count | integer | 1 or 2 (DEFAULT 1); 2 = two-device innings verification |

### divisions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| league_id | uuid | FK → leagues |
| name | text | |
| number | integer | Division number |
| day_of_week | integer | 0–6 |
| location | text | |

### teams
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| division_id | uuid | FK → divisions |
| name | text | |
| team_number | text | APA team number |
| is_active | boolean | DEFAULT true |

### players
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| first_name | text | |
| last_name | text | |
| member_number | text UNIQUE | APA member ID — believed to be 8 digits with 3-digit area prefix (e.g. 189-XXXXX); stored as-is from scoresheet; 5-digit input used in Add Player UI for now |
| current_8_ball_sl | integer | 1–9, nullable — APA 8-ball skill level; populated from PDF import and Add Player |
| current_9_ball_sl | integer | 1–9, nullable — APA 9-ball skill level; populated from PDF import and Add Player |
| is_active | boolean | DEFAULT true |

One row per player regardless of how many formats they play. `current_8_ball_sl` and/or `current_9_ball_sl` are null when the player has no history in that format.

### team_players (roster junction)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| team_id | uuid | FK → teams |
| player_id | uuid | FK → players |
| current_8_ball_sl | integer | 1–9, nullable — operational SL for this team/season in 8-ball; written on PDF import |
| current_9_ball_sl | integer | 1–9, nullable — operational SL for this team/season in 9-ball; written on PDF import |
| is_active | boolean | DEFAULT true |
| is_captain | boolean | DEFAULT false; set `true` for first player per team on each PDF import (authoritative — resets on re-import); captains can also promote co-captains manually via roster edit |
| matches_played | integer | DEFAULT 0; updated on each PDF import |
| joined_at | timestamptz | |
| left_at | timestamptz | Soft-delete: set when player is removed from roster via captain edit |

**SL resolution:** wherever a single SL value is needed (RACE table, display badge), use `current_8_ball_sl ?? current_9_ball_sl ?? 3`.

**Captain detection:** The first player listed for each team on the APA scoresheet (`homePlayers[0]` / `awayPlayers[0]`) is the captain. `is_captain = true` is written for that player on every import; all other players get `is_captain = false`. Manually-promoted co-captains are reset by the next import — re-promote after each re-import if needed.

**Division rule:** A player may not appear on two teams in the same division during the same session, but may be on teams in different divisions or game formats.

### skill_level_history
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| player_id | uuid | FK → players |
| league_id | uuid | FK → leagues |
| old_level / new_level | integer | |
| game_format | game_format | NOT NULL — which format this SL change applies to |
| effective_date | date | |

Written by PDF import whenever a player's SL changes or they are first seen. `old_level = new_level` on first import.

### team_matches
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| division_id | uuid | FK → divisions |
| home_team_id | uuid | FK → teams |
| away_team_id | uuid | FK → teams |
| match_date | date | |
| week_number | integer | |
| game_format | game_format | NOT NULL — denormalized from `leagues.game_format` at import time; used by all scoring screens instead of joining through division → league |
| status | match_status | DEFAULT 'scheduled'; `imported` = parsed but not yet promoted by admin |
| import_id | uuid | FK → imports ON DELETE SET NULL; cascades to delete unscheduled matches when import is deleted |
| home_score / away_score | integer | Team-level APA points |
| locked_by / locked_at | uuid / timestamptz | |
| finalized_by / finalized_at | uuid / timestamptz | |

### lineups
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| team_match_id | uuid | FK → team_matches |
| team_id | uuid | FK → teams |
| player_1_id … player_5_id | uuid | FK → players |
| player_1_skill … player_5_skill | integer | |
| total_skill_level | integer | GENERATED, must be ≤ 23 |
| put_up_order | jsonb | |
| is_confirmed | boolean | DEFAULT false |

### individual_matches
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| team_match_id | uuid | FK → team_matches |
| match_order | integer | 1–5, UNIQUE with team_match_id |
| game_format | game_format | |
| home_player_id / away_player_id | uuid | FK → players |
| home_skill_level / away_skill_level | integer | |
| home_race_to / away_race_to | integer | From race chart |
| home_points_earned / away_points_earned | integer | Racks won |
| put_up_team | text | 'home' \| 'away' |
| resumed_at | timestamptz | Written on resume |
| innings | integer | Total innings for match |
| defensive_shots | integer | |
| is_completed | boolean | DEFAULT false |
| completed_at | timestamptz | |
| innings_verify_home | integer | Primary scorer's submitted count (NULL when idle) |
| innings_verify_away | integer | Secondary/follower scorer's submitted count (NULL when idle) |

### racks_eight_ball
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| individual_match_id | uuid | FK → individual_matches |
| rack_number | integer | |
| won_by | text | 'home' \| 'away' |
| is_break_and_run | boolean | |
| is_eight_on_break | boolean | |
| dead_rack | boolean | |
| innings_home / innings_away | integer | Per-rack innings |
| innings_verified | boolean | DEFAULT false |

### racks_nine_ball
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| individual_match_id | uuid | FK → individual_matches |
| rack_number | integer | |
| balls_pocketed_home / balls_pocketed_away | jsonb | |
| dead_balls | jsonb | |
| points_home / points_away | integer | |
| is_break_and_run | boolean | |
| innings_home / innings_away | integer | |
| innings_verified | boolean | |

### scorecard_sessions (pessimistic locking)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| team_match_id | uuid UNIQUE | FK → team_matches |
| locked_by | uuid | FK → auth.users |
| locked_at / last_heartbeat | timestamptz | Stale after 5 min |
| is_active | boolean | |

### imports / import_rows
See admin import feature. `raw_data` jsonb includes: `fullName`, `skillLevel`, `matchesPlayed`, `memberNumber`, `team` ('home'|'away').

### audit_log
Append-only. No UPDATE/DELETE. Columns: `actor_id`, `action`, `table_name`, `record_id`, `old_values`, `new_values`, `reason`, `metadata`.

### disputes
Columns: `team_match_id`, `raised_by`, `status`, `description`, `resolution`, `resolved_by`, `resolved_at`.

### Reference Tables (read-only seed data)
- **eight_ball_race_chart**: `(player_skill, opponent_skill) → (player_race, opponent_race)` — SL 2–7
- **nine_ball_point_targets**: `skill_level → points_required` — SL 1–9

---

## 5. Feature Inventory

Legend: **✅ BUILT** | **🔶 PARTIAL** | **❌ NOT STARTED**

### Auth
| Feature | Status | Notes |
|---|---|---|
| Anonymous team login | ✅ BUILT | `signInAnonymously()` + RPC |
| LO email/password login | ✅ BUILT | Via "League Operator Login" on player login screen |
| Admin (superuser) email/password login | ✅ BUILT | Separate `/(auth)/admin-login` route |
| Cold-launch always show login | ✅ BUILT | Bootstrap signs out session |
| Remembered team preferences | ✅ BUILT | `expo-secure-store` |
| Season fingerprint (clear stale teams) | ✅ BUILT | |
| Player identity selection ("Who Are You?") | ✅ BUILT | 4th login step; roster picker sets `profiles.player_id`; identity persisted in SecureStore per team |
| Returning user identity verification | ✅ BUILT | "Continue as [Name]?" with Yes / Not Me; clears stored identity on Not Me |
| Captain status in auth context | ✅ BUILT | `isCaptain: boolean` in `useAuthContext()`; derived from `team_players.is_captain` after identity set |
| Logout (team side) | ✅ BUILT | Icon in dashboard header + Quick Actions |
| Switch User / Log Out (superuser side) | ✅ BUILT | Header buttons on superuser dashboard |
| Forgot Password / reset | ❌ NOT STARTED | `supabase.auth.resetPasswordForEmail()` ready to wire up; Password Reset button in LO edit modal sends reset email |

### Superuser — Platform Management
| Feature | Status | Notes |
|---|---|---|
| Superuser dashboard | ✅ BUILT | `(superuser)` route group; tabs: Dashboard, Leagues, LO Accounts |
| League list (superuser view) | ✅ BUILT | |
| LO account list | ✅ BUILT | Cards show name + assigned league |
| Create LO account | ✅ BUILT | `create-lo-account` edge function; mandatory league assignment |
| Edit LO account (name + league) | ✅ BUILT | Slide-up modal; league picker pre-selected |
| Send LO password reset email | ✅ BUILT | Button in edit modal; `resetPasswordForEmail()` |
| Delete LO account | ✅ BUILT | `delete-lo-account` edge function; cascades auth user → profile |
| LO area = league name | ✅ BUILT | `profiles.league_id` FK; area shown from `leagues.name` |

### Admin/LO — League Management
| Feature | Status | Notes |
|---|---|---|
| League list | ✅ BUILT | |
| League detail + edit | ✅ BUILT | |
| Create league (name, format, season, year) | ✅ BUILT | |
| League type dropdown (APA/TAP/BCA/Other) | ❌ NOT STARTED | Spec req; only game_format stored |
| Auto-fill settings from league type | ❌ NOT STARTED | All settings currently hardcoded |
| "Modified from defaults" indicator | ❌ NOT STARTED | |
| Division management (add/remove) | ✅ BUILT | Within league detail screen |
| League Settings page (configurable rules) | 🔶 PARTIAL | `scorekeeper_count` (1 or 2) configurable via LO Settings page; other rule settings not started |

### Admin/LO — Match Management
| Feature | Status | Notes |
|---|---|---|
| Match list with filter chips | ✅ BUILT | Scheduled / In Progress / Completed / Disputed / Finalized |
| Match detail (read-only) | ✅ BUILT | Players, scores, audit log, disputes |
| Reopen finalized match | ✅ BUILT | Requires typed reason |
| Match flagging & notes | ❌ NOT STARTED | Tags: Score dispute, Stalled, Needs review, free-text |
| Force takeover (admin takes scoring control) | ❌ NOT STARTED | |
| Schedule generation | ❌ NOT STARTED | Matches currently imported via PDF |

### Admin/LO — PDF Import
| Feature | Status | Notes |
|---|---|---|
| File picker + upload to Storage | ✅ BUILT | Native FormData + REST API |
| PDF parsing (APA scoresheet format) | ✅ BUILT | Column-major layout, member# as key |
| Parse both teams from single PDF | ✅ BUILT | H/A flag on each row |
| Import results screen | ✅ BUILT | Filter chips, row detail, error messages |
| Staging screen (checkboxes before publish) | ✅ BUILT | `imported` status; admin promotes to `scheduled` |
| Select All / uncheck to exclude pairs | ✅ BUILT | Division filter (8-ball / 9-ball / by division); Leave or Remove unscheduled |
| Re-import updates existing records | ✅ BUILT | Player names + SL updated; MP updated on team_players |

### Admin/LO — Player & Team Management
| Feature | Status | Notes |
|---|---|---|
| Player management via import | ✅ BUILT | |
| Re-import updates captain flag | ✅ BUILT | First player per team = captain on every import; authoritative |
| Direct player CRUD | ❌ NOT STARTED | |
| Direct team CRUD | ❌ NOT STARTED | |
| Skill level history tracking | 🔶 PARTIAL | DB table exists; not surfaced in UI |

### Captain — Roster Management
| Feature | Status | Notes |
|---|---|---|
| Roster screen (view) | ✅ BUILT | Sorted captain-first then by SL desc; captain badge; "(You)" label on own card |
| Edit mode (captain-only) | ✅ BUILT | Edit button in header; gated by `isCaptain` from auth context |
| Remove player from roster | ✅ BUILT | Soft-delete: sets `team_players.left_at`; confirmation alert; cannot remove self |
| Promote / demote co-captain | ✅ BUILT | Star toggle per player card in edit mode; confirmation alert |
| Add Player | ✅ BUILT | Shown when `editMode && players.length < 8`; bottom sheet modal |
| Add Player — member number lookup | ✅ BUILT | `find_player_by_member_number` RPC; auto-fills name + SL for team's game format |
| Add Player — manual entry (new player) | ✅ BUILT | If member # not found; SL defaults to 3 |
| Add Player — division conflict check | ✅ BUILT | `check_division_conflict` RPC; blocks if player already on another team in same division |
| Add Player — re-join (left_at was set) | ✅ BUILT | Upsert clears `left_at` on conflict |
| Player check-in (match night attendance) | ❌ NOT STARTED | Future; requires player identity; captain sees who's checked in during put-up |

### Scorekeeping — Match Start
| Feature | Status | Notes |
|---|---|---|
| Coin flip modal (first match / not first) | ✅ BUILT | Steps: first_match → flip → result → accept/defer; Cancel button on every step |
| Catchup wizard (starting mid-match) | ✅ BUILT | Retroactive data entry for prior matches |
| Catchup: select starting match (1–5) | ✅ BUILT | Fresh match defaults to match 1 (skips select screen) |
| Catchup: retro player + winner + racks | ✅ BUILT | |
| Catchup: partial racks on starting match | ✅ BUILT | |
| Catchup saves to DB (23-rule consistent) | ✅ BUILT | Upserts individual_matches |
| Put-up screen (Realtime two-device) | ✅ BUILT | Supabase Realtime `postgres_changes` |
| Put-up offline fallback | ✅ BUILT | 10s Realtime timeout → manual player picker from roster; writes both player IDs and sets match in_progress |
| "Other team not started" message | ✅ BUILT | `opponentConnected` flag |
| Dev bypass (triple-tap title, solo testing) | ✅ BUILT | Hidden; auto-fills two different players; sets skill levels on individual_match |
| Stale put-up self-heal | ✅ BUILT | If team_match.status='scheduled' and individual_match already has both players, clears them on load |
| Resume screen (select in-progress match) | ✅ BUILT | Shows all 5 slots, status, last resumed time |
| Reset Match (dev/testing tool) | ✅ BUILT | On scoring index match card; deletes individual_matches + resets team_match to scheduled; only shown for non-scheduled matches |

### Scorekeeping — Active Match
| Feature | Status | Notes |
|---|---|---|
| Lag for break (first rack) | ✅ BUILT | |
| Turn-based flow | ✅ BUILT | Turn Over / Defensive Shot / Time Out / Foul / Game Over |
| Innings auto-increment (non-breaker ends turn) | ✅ BUILT | |
| Winner breaks next rack | ✅ BUILT | |
| Timeout countdown (60s) | ✅ BUILT | Flash "TAP — TIMEOUT OVER" banner |
| Timeout limit by SL (≤3 = 2/rack, ≥4 = 1/rack) | ✅ BUILT | |
| Inactivity alert (60s no tap) | ✅ BUILT | |
| Foul types (4 options) | ✅ BUILT | Scratch on Break, Scratched, Hit Wrong Ball First, Legal Contact — No Rail Hit |
| Game Over options (break vs. normal) | ✅ BUILT | 8-ball: Made 8 on Break, B&R, Fouled 8; Normal: Made 8, Scratch on 8, Wrong Pocket, Not Marked |
| Innings verification panel (after each rack) | ✅ BUILT | +/- adjust before confirm |
| Two-device innings verification | ✅ BUILT | When `scorekeeper_count=2`: each device submits independently via DB columns; Realtime detects agreement or discrepancy; discrepancy UI lets one device reconcile |
| Offline write queue | ✅ BUILT | `NetInfo` check before save; queued via `src/lib/pendingWrites.ts` (wraps MMKV sync queue); match data cached in SecureStore; flushed on scoring index focus |
| Sync pending badge (scoring index) | ✅ BUILT | Amber "Sync pending" badge on match cards with queued writes |
| Follower mode (second scorekeeper device) | ✅ BUILT | "Follow Match" button on in_progress + scorekeeper_count=2 matches; `?mode=follower` param; follower sees read-only scoreboard + waiting notice; enters innings count independently when primary scorer ends rack; Realtime syncs racks_home/away |
| Undo / Back (one level deep, snapshot-based) | ✅ BUILT | "Back to [Player]'s turn" / "Undo Game Over" |
| ON THE HILL indicator | ✅ BUILT | Yellow dot + text |
| Rack dots scoreboard | ✅ BUILT | |
| Defensive shot tracking | ✅ BUILT | |
| Break & Run / 8 on Break flags | ✅ BUILT | |
| Scorecard sessions (pessimistic locking) | ❌ NOT STARTED | Table exists; not wired into app |
| 9-ball scoring (ball-by-ball) | ❌ NOT STARTED | Format detected; rack tables exist; UI not built |

### Scorekeeping — Handoff
| Feature | Status | Notes |
|---|---|---|
| Hand Off button (header, during active match) | ✅ BUILT | `swap-horizontal-outline` icon, top right |
| Hand Off → resume screen | ✅ BUILT | Alert warns current rack lost |
| Full request/confirm/read-only handoff flow | ❌ NOT STARTED | Spec req (§4.2); current impl is simpler |
| Handoff enabled toggle (per session/league) | ❌ NOT STARTED | Spec req (§4.1) |

### Scorekeeping — Finalize
| Feature | Status | Notes |
|---|---|---|
| Finalize screen (APA points per match) | ✅ BUILT | 3/0, 2/1, 2/0 calculation |
| Total team points display | ✅ BUILT | |
| "Both captains agree" checkbox | ✅ BUILT | Required before lock |
| Finalize & Lock | ✅ BUILT | Sets status = 'completed', records scores |
| Locked view + Edit button | ✅ BUILT | |
| UNLOCK (type "UNLOCK") | ✅ BUILT | Sets status back to 'in_progress' |
| Incomplete match warning | ✅ BUILT | |

### Admin/LO — Disputes
| Feature | Status | Notes |
|---|---|---|
| Disputes table (DB) | ✅ BUILT | |
| Disputes UI | ❌ NOT STARTED | Admin dashboard shows count placeholder |
| Protest/dispute workflow | ❌ NOT STARTED | |

### APA Rules Assistant
| Feature | Status | Notes |
|---|---|---|
| Floating 🎱 FAB (all screens) | ✅ BUILT | `src/components/RulesAssistant.tsx`; absolute overlay, above tab bar |
| Chat panel (slide-up modal) | ✅ BUILT | Chip shortcuts, message bubbles, proof + audit buttons |
| Anthropic API integration | ✅ BUILT | `claude-opus-4-6`; key in `.env` as `EXPO_PUBLIC_ANTHROPIC_KEY` |
| Quick question chips (wrapped rows) | ✅ BUILT | 9 preset questions: 6 game rules + 23-Rule, coaching, timeout rules |
| "Show Me the Proof" citations | ✅ BUILT | Secondary API call extracts verbatim rule number + quote |
| "Are You Sure?" audit | ✅ BUILT | Deeper audit call; ✅/⚠️/❌ verdict card; injects correction into session; logs flag to `rules_flags` only for CORRECTED/NUANCE ADDED (CONFIRMED = no LO action needed, not logged) |
| Session-corrected answers | ✅ BUILT | CORRECTED/NUANCE ADDED verdicts injected into conversation so Claude carries them forward |
| LO-approved prompt overrides | ✅ BUILT | Fetches approved `prompt_overrides` from Supabase on open; prepended to system prompt |
| Press-and-hold voice input | 🔶 PARTIAL | Requires custom dev client (`expo-speech-recognition`); degrades gracefully in Expo Go |
| FAB long-press mic entry | ✅ BUILT | Hold the floating 🎱 to start recording before panel opens |
| Team Manual rules in knowledge base | ✅ BUILT | 23-Rule, 19-Rule, full timeout nuance (SL-based count, charge/no-charge, secondary consultation, Masters exception), forfeits, scoresheet |
| Rule 16 combo clarification | ✅ BUILT | System prompt explicit: 8-ball can NEVER be pocketed same shot as last category ball, regardless of order |

### Admin/LO — Flagged Rules Review
| Feature | Status | Notes |
|---|---|---|
| `rules_flags` table | ✅ BUILT | Player-challenged Q&As with verdict + proposed correction; migration `00024_rules_flags.sql` |
| `prompt_overrides` table | ✅ BUILT | LO-approved corrections injected into widget system prompt on next open |
| Disputes dashboard tile | ✅ BUILT | Red alert icon, disputed match count; navigates to `/(admin)/(tabs)/matches?filter=disputed` |
| Rules Flags dashboard tile | ✅ BUILT | Gold flag icon, live pending count; separate from Disputes tile; navigates to review screen |
| Flagged Rules review screen | ✅ BUILT | `/(admin)/rules-flags`; attribution, verdict badge, Q&A, proposed correction |
| Approve correction | ✅ BUILT | Flag → approved + inserts into `prompt_overrides` |
| Edit before approving | ✅ BUILT | Inline TextInput pre-filled with proposed correction |
| Dismiss flag | ✅ BUILT | Flag → dismissed |
| Player/team attribution | ✅ BUILT | `rules-flags.tsx` bulk-fetches `profiles` joined to `players` + `teams` for all `user_id`s in the flag list; shows "Name from Team" when player completed login (team + identity confirmed), falls back to "Anonymous" if widget was used before login (profile has no `player_id`) |

---

## 6. Screen Inventory

| Screen | Route | Status | Notes |
|---|---|---|---|
| **AUTH** | | | |
| Login | `/(auth)/login` | ✅ BUILT | 3-step: pick → confirm → who_are_you; always routes to dashboard |
| Admin Login | `/(auth)/admin-login` | ✅ BUILT | Email/password (LO + superuser) |
| Forgot Password | — | ❌ NOT STARTED | |
| **TEAM** | | | |
| Team Dashboard | `/(team)/(tabs)/` | ✅ BUILT | Next match, season summary, quick actions, logout |
| Scoring Index | `/(team)/(tabs)/scoring` | ✅ BUILT | Scorable match list |
| Coin Flip Modal | component | ✅ BUILT | Used by dashboard + scoring index |
| APA Rules Assistant | component (global) | ✅ BUILT | Floating 🎱 FAB + slide-up chat panel; mounted in root layout |
| Catchup Wizard | `/(team)/(tabs)/scoring/[matchId]/catchup` | ✅ BUILT | Retroactive data entry |
| Put Up | `/(team)/(tabs)/scoring/[matchId]/putup` | ✅ BUILT | Realtime two-device |
| Resume | `/(team)/(tabs)/scoring/[matchId]/resume` | ✅ BUILT | |
| Match Progress | `/(team)/(tabs)/scoring/[matchId]/progress` | ✅ BUILT | 5-slot list for in_progress matches; routes to putup or scoring per slot |
| Individual Match Scoring | `/(team)/(tabs)/scoring/[matchId]/[individualMatchIndex]` | ✅ BUILT | Full scoring screen |
| Finalize | `/(team)/(tabs)/scoring/[matchId]/finalize` | ✅ BUILT | |
| Schedule | `/(team)/(tabs)/schedule` | ✅ BUILT | Tappable match cards; pull-to-refresh |
| Match Detail (read-only) | `/(team)/(tabs)/schedule/[matchId]` | ✅ BUILT | scheduled → both rosters (SL, MP, captain); in_progress → 5-slot progress; completed/finalized → results with APA points |
| Roster | `/(team)/(tabs)/roster` | ✅ BUILT | View + captain edit mode (remove, add, co-captain promote) |
| Match History | `/(team)/(tabs)/history` | ❌ NOT STARTED | Linked from Quick Actions |
| Live Viewer (read-only) | — | ❌ NOT STARTED | |
| Handoff Request (Initiator) | — | ❌ NOT STARTED | Full flow per spec §4.2 |
| Handoff Request (Receiver) | — | ❌ NOT STARTED | |
| **ADMIN / LO** | | | |
| Admin Dashboard | `/(admin)/(tabs)/` | ✅ BUILT | Stats cards + quick actions |
| League List | `/(admin)/(tabs)/leagues` | ✅ BUILT | |
| League Detail | `/(admin)/(tabs)/leagues/[leagueId]` | ✅ BUILT | Edit + division management |
| Create League | `/(admin)/(tabs)/leagues/create` | ✅ BUILT | |
| League Settings | — | ❌ NOT STARTED | Spec §2.2 |
| Match List | `/(admin)/(tabs)/matches` | ✅ BUILT | |
| Match Detail | `/(admin)/(tabs)/matches/[matchId]` | ✅ BUILT | Read-only + reopen |
| Flagged Rules Review | `/(admin)/rules-flags` | ✅ BUILT | Approve/edit/dismiss player-flagged rule interpretations; feeds `prompt_overrides` |
| Match Flag / Notes | — | ❌ NOT STARTED | |
| Force Takeover Confirm | — | ❌ NOT STARTED | |
| Import Rosters | `/(admin)/(tabs)/import` | ✅ BUILT | Swipe-to-delete; cancel during upload; staged-count banner |
| Import Results | `/(admin)/(tabs)/import/[importId]` | ✅ BUILT | Filename formatted; conditional filter chips |
| Import Staging | `/(admin)/(tabs)/import/staging` | ✅ BUILT | Division filter, checkboxes, Move to Scheduled, Leave/Remove unscheduled |
| Divisions | `/(admin)/(tabs)/divisions` | ✅ BUILT | Navigated from dashboard; Stack sub-navigation |
| Division Detail | `/(admin)/(tabs)/divisions/[divisionId]` | ✅ BUILT | |
| Team Detail | `/(admin)/(tabs)/divisions/[divisionId]/team/[teamId]` | ✅ BUILT | |
| Player Management | — | ❌ NOT STARTED | Direct CRUD |
| Team Management | — | ❌ NOT STARTED | Direct CRUD |
| Admin/LO Settings | `/(admin)/(tabs)/settings` | ✅ BUILT | Account, sign out; Scoring section: scorekeeper count (1 or 2) segmented control |
| **SUPERUSER** | | | |
| Superuser Dashboard | `/(superuser)/(tabs)/` | ✅ BUILT | Switch User + Log Out buttons |
| Superuser Leagues | `/(superuser)/(tabs)/leagues` | ✅ BUILT | League list/management |
| LO Accounts | `/(superuser)/(tabs)/accounts` | ✅ BUILT | Create/edit/delete LO accounts; league picker |

---

## 7. Business Logic & Rules

### APA Race-To Table (8-Ball)
`RACE[homeSL][awaySL] = [homeRaceTo, awayRaceTo]`
Hardcoded in scoring screen and catchup wizard. Also exists in DB as `eight_ball_race_chart`.

| | SL2 | SL3 | SL4 | SL5 | SL6 | SL7 |
|---|---|---|---|---|---|---|
| **SL2** | 2-2 | 2-3 | 2-4 | 2-5 | 2-6 | 2-7 |
| **SL3** | 3-2 | 2-2 | 2-3 | 2-4 | 2-5 | 2-6 |
| **SL4** | 4-2 | 3-2 | 3-3 | 3-4 | 3-5 | 2-5 |
| **SL5** | 5-2 | 4-2 | 4-3 | 4-4 | 4-5 | 3-5 |
| **SL6** | 6-2 | 5-2 | 5-3 | 5-4 | 5-5 | 4-5 |
| **SL7** | 7-2 | 6-2 | 5-2 | 5-3 | 5-4 | 5-5 |

### APA Points Per Match (Finalize)
| Outcome | Home Points | Away Points |
|---|---|---|
| Home wins, away gets 0 racks | 3 | 0 |
| Home wins, away on the hill | 2 | 1 |
| Home wins, away gets racks but not on hill | 2 | 0 |
| Away wins (mirror of above) | 0/1/0 | 3/2/2 |
| Incomplete | 0 | 0 |

### Skill Cap (APA 23 Rule)
- Team roster skill total must be ≤ 23 for a given match
- Enforced by DB constraint on `lineups.total_skill_level`
- **Not yet enforced in UI** — only validated via catchup wizard data entry
- Lineups table populated but not integrated into active scoring flow

### Innings Rule
- Inning completes when the **non-breaker** ends their turn
- Both players must have shot at least once in the inning for it to count
- Innings tracked per-rack; total innings = sum across all racks

### Timeout Rules
- SL ≤ 3: 2 timeouts per rack
- SL ≥ 4: 1 timeout per rack
- 60-second countdown
- Expired timeout: flashing "TAP — TIMEOUT OVER" banner

### Break Order
- Rack 1: Lag winner breaks
- Subsequent racks: **winner of previous rack breaks** (not loser — important APA rule)

### Foul Types (8-Ball)
1. Scratch on Break
2. Scratched (cue ball in pocket)
3. Hit Wrong Ball First
4. Legal Contact — No Rail Hit

### Game Over — Break Result
1. Made 8 on the Break (current player wins — special flag)
2. Break and Run (current player wins — special flag; **only available to the breaking player while they have not yet ended their turn** — once the breaker's turn ends, Break and Run is permanently gone for that rack even if they return to the table)
3. Fouled & Pocketed 8 Ball (opponent wins)

### Game Over — Normal (8-Ball)
1. Made 8 Ball (current player wins)
2. Scratched on 8 Ball (opponent wins)
3. 8 Ball in Wrong Pocket (opponent wins)
4. Made 8 Ball, Pocket Not Marked (opponent wins)

### APA Scoresheet PDF Column Layout
`SL | MP | Player # (member number) | Name`
Digit block = column-major: all SLs, then all MPs, then all member numbers, then concatenated names.
Member numbers are immutable player identifiers. Names and SLs can change — both are updated on re-import.
`*` (incomplete info) and `N` (not paid) markers stripped before parsing.

**Captain detection:** The **first player listed** for each team on the scoresheet is the captain. `is_captain` is set `true` for that player and `false` for all others on every import. Each import is authoritative for captain status.

**Dual SL columns:** On import, `eight_ball_sl` or `nine_ball_sl` is written based on the league's `game_format`, in addition to `skill_level` (kept for backward compat). New players whose SL shows as 0 on their first scoresheet are stored with the imported value; captain can correct in roster edit (SL range 1–9).

### Put-Up Flow
After each individual match, the **loser** puts up first for the next match. The winning team then responds.

### Catchup / 23-Rule Consistency
When the app is started mid-match (e.g., app went down), the catchup wizard collects:
- Which individual match we're starting from (1–5)
- For all prior matches: home player, away player, winner, loser racks
- For the starting match: whether partial racks were played
Retroactive `individual_matches` records are saved so APA points remain consistent.

---

## 8. Known Gaps & Conflicts

### Spec vs. Actual Data Model
| Spec Model | Actual | Conflict |
|---|---|---|
| Match has `player_1_id`, `player_2_id` | `team_matches` is team-vs-team; `individual_matches` nested within | Spec is player-centric; app is team-centric. Not a bug — the team structure is more appropriate for APA. |
| `League.league_type` (APA/TAP/BCA/Other) | Only `game_format` (eight_ball/nine_ball) stored | League type dropdown not implemented |
| `LeagueSettings` (DB model) | All settings hardcoded in app constants | No dynamic settings; APA defaults only |
| `Match.scorekeeper_device_id` | `scorecard_sessions` table (pessimistic locking) | Table exists but not used in app |
| `MatchFlag` | `disputes` table | Different schema; disputes ≠ flags |

### Hardcoded APA Assumptions
The following are hardcoded and would need to move to `LeagueSettings` for multi-league support:
- RACE table (scoring screen + catchup wizard)
- Timeout rules (SL ≤ 3 = 2/rack, SL ≥ 4 = 1/rack)
- APA points formula (3/0, 2/1, 2/0)
- Skill cap (23)
- 5 individual matches per team match
- 8-ball game over options

### Lineups Table Not Integrated
The `lineups` table (with skill cap enforcement) exists in DB but is not used by the scoring flow. Players are selected via put-up screen (stored directly on `individual_matches`), bypassing lineup pre-confirmation.

### Generated Types Stale
`src/types/database.types.ts` (Supabase-generated) does not include several newer columns: `profiles.league_id`, `profiles.player_id`, `leagues.scorekeeper_count`, `individual_matches.innings_verify_home`/`innings_verify_away`, `players.eight_ball_sl`/`nine_ball_sl`. Code accessing these uses `as any` casts. Re-run `npx supabase gen types` to regenerate when convenient.

### Racks Not Written to DB
`racks_eight_ball` table exists but the scoring screen currently only writes match-level totals (`home_points_earned`, `away_points_earned`, `innings`) at match end. Per-rack data is not persisted.

### Scorecard Sessions Not Used
The pessimistic locking system (`scorecard_sessions`) is in the DB schema but the app does not acquire or release locks. Multiple devices can score simultaneously with no conflict detection.

### Handoff Flow Simplified
Spec §4.2 describes a request/confirm/read-only handoff. Current implementation: tapping the handoff icon shows an alert and navigates to the resume screen. No request flow, no read-only mode.

### Disputes UI Missing
The `disputes` table is in the DB and the admin dashboard shows an Open Disputes count, but there is no screen to view, create, or resolve disputes.

### Switch User vs. Log Out (Superuser)
Both buttons on the superuser dashboard sign out and navigate away (Switch User → player login, Log Out → admin login). The distinction is the destination only; there is no separate "switch user" session mechanism.

---

## 9. Implementation Roadmap

### Priority 1 — Core Stability (testing phase)
- [ ] Fix any bugs found during two-device testing
- [x] Offline write queue + match data cache (NetInfo → SecureStore → MMKV sync queue)
- [x] Two-device innings verification (Realtime + DB columns)
- [x] Follower mode (second device read-only + innings verify)
- [x] Put-up offline fallback (10s timeout → manual selection)
- [x] Scorekeeper count setting (LO Settings page → `leagues.scorekeeper_count`)
- [ ] Persist per-rack data to `racks_eight_ball` during scoring (currently only match totals saved at end)
- [ ] Wire `scorecard_sessions` for basic conflict detection (prevent two devices scoring same match simultaneously)

### Priority 2 — Missing Screens (team side)
- [x] Schedule screen `/(team)/(tabs)/schedule` — tappable cards + read-only detail views for all match statuses
- [x] Roster screen `/(team)/(tabs)/roster` — view + captain edit (add/remove/co-captain)
- [ ] Match History screen `/(team)/(tabs)/history`

### Priority 3 — Admin Completeness
- [ ] Match Flagging & Notes screen
- [ ] Disputes UI (list + detail + resolve)
- [x] PDF Import Staging screen (checkboxes before publish)
- [ ] Player Management CRUD
- [ ] Team Management CRUD

### Priority 4 — Multi-League Support
- [ ] League type dropdown (APA/TAP/BCA/Other) on Create League
- [ ] `LeagueSettings` model in DB with configurable rules
- [ ] Move hardcoded APA constants to DB-driven settings
- [ ] "Based on [League] defaults — modified" indicator

### Priority 5 — Advanced Features
- [ ] Full handoff request/confirm/read-only flow (spec §4.2)
- [ ] Force Takeover (admin takes scoring control)
- [ ] Live Viewer (read-only match view for non-scorekeepers)
- [ ] 9-ball active scoring (ball-by-ball rack tracking)
- [ ] Multi-admin notifications on flagging
- [ ] Protest/dispute workflow
- [ ] Forgot Password flow (UI; `resetPasswordForEmail()` already wired for LO accounts)

### Performance (deferred — app must be stable first)
- [ ] Parallelize DB writes in `saveAndNavigate` and finalize
- [ ] Parallelize edge function DB writes (currently sequential)

---

## Edge Functions

| Function | Purpose | Deploy Command |
|---|---|---|
| `parse-pdf` | Parse APA scoresheet PDF, write to DB | `npx supabase functions deploy parse-pdf --project-ref lyhlnaibdqznipllfmuu --no-verify-jwt` |
| `create-lo-account` | Create LO auth user + profile (admin only) | `npx supabase functions deploy create-lo-account --project-ref lyhlnaibdqznipllfmuu --no-verify-jwt` |
| `delete-lo-account` | Delete LO auth user + profile (admin only) | `npx supabase functions deploy delete-lo-account --project-ref lyhlnaibdqznipllfmuu --no-verify-jwt` |

`--no-verify-jwt` required — functions handle auth internally (role check via service role key).
Docker not required for remote deploys (warning appears but works).

---

## DB Reset (dev only)

Use `supabase/truncate_data.sql` for one-click data erasure. Preserves leagues and admin/lo profiles.
Truncates in strict reverse FK order (no CASCADE — CASCADE would wipe profiles via `profiles.team_id → teams`).

```sql
-- After running truncate_data.sql:
-- 1. No need to redeploy edge functions — RLS policies and schema unaffected
-- 2. Re-import scoresheets to repopulate divisions, teams, players, and match data
-- NOTE: If LO login stops working after a fresh schema change,
--       re-run supabase/migrations/00021_lo_rls_policies.sql in the SQL editor
```

## Restore Admin/LO Profile (if accidentally deleted)
```sql
-- Admin profile
INSERT INTO profiles (id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'your-admin@email.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- LO profile
INSERT INTO profiles (id, role)
SELECT id, 'lo' FROM auth.users WHERE email = 'your-lo@email.com'
ON CONFLICT (id) DO NOTHING;
```

---

## Applied Migrations

| # | File | Description |
|---|---|---|
| 00011 | `reconcile_schema.sql` | Rename columns; add skill_level, game_format, is_active to players; is_captain, left_at to team_players |
| 00012 | `team_players_matches_played.sql` | Add matches_played to team_players |
| 00013 | `public_login_policies.sql` | Public SELECT for login screen (scheduled matches, teams) |
| 00014 | `set_player_team_fn.sql` | SECURITY DEFINER RPC: upsert profile with team_id |
| 00015 | `putup_flow.sql` | put_up_team, resumed_at, innings verification columns, opponent RLS policies |
| 00016 | `scorekeeper_count.sql` | leagues.scorekeeper_count column |
| 00016 | `imported_status.sql` | match_status enum value 'imported' |
| 00017 | `team_match_import_id.sql` | team_matches.import_id FK |
| 00017 | `innings_verify_columns.sql` | innings_verify_home/away on individual_matches |
| 00018 | `role_restructure.sql` | LO role restructure |
| 00018 | `team_players_public_read.sql` | Authenticated users can read any team's roster (put-up screen needs opponent roster) |
| 00019 | `active_flags.sql` | is_active on divisions and teams |
| 00020 | `division_number.sql` | divisions.division_number column |
| 00021 | `lo_rls_policies.sql` | RLS policies scoped to LO's league |
| 00022 | `lo_profile_fields.sql` | profiles.first_name, last_name, email, league_id |
| 00023 | `roster_edit_player_identity.sql` | players: eight_ball_sl + nine_ball_sl; team_players: default SL→3; profiles: player_id FK; helper functions; captain/roster RLS; set_player_identity, find_player_by_member_number, check_division_conflict RPCs |
| 00024 | `rules_flags.sql` | rules_flags table (player-submitted rule challenges) + prompt_overrides table (LO-approved corrections); RLS: authenticated insert own flags, lo/admin read+update flags, authenticated read approved overrides, lo/admin insert+update overrides |
| 00025 | `players_opponent_roster_read.sql` | Allow authenticated users to read any player row (needed for full opponent roster browse during put-up) |
| 00026 | `broadcasts.sql` | broadcasts, broadcast_replies, broadcast_dismissals, broadcast_reads, broadcast_thread_messages tables; RLS; Realtime |
| 00027 | `scoreboard_stats.sql` | Timeout counts and lag winner columns on individual_matches for scoreboard display |
| 00028 | `broadcast_replies_player_id.sql` | Add player_id (FK → players) to broadcast_replies; partial unique index (broadcast_id, player_id); update own_read_replies RLS to match by player_id across sessions |

*Last updated: 2026-03-20 | Maintained alongside codebase in `/apa/SPEC.md`*
