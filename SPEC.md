# Pool League Scoring App — Working Specification
**Living Document | Updated 2026-02-28**

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

Two user roles: **Team** (scorekeepers, anonymous auth) and **Admin** (league operators, email/password).

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

**Supabase project ref:** `lyhlnaibdqznipllfmuu`

**Realtime:** Enabled on `individual_matches` table via `ALTER PUBLICATION supabase_realtime ADD TABLE individual_matches`.

---

## 3. Auth & Roles

### Team (Player) Auth
- `supabase.auth.signInAnonymously()` — no credentials
- `supabase.rpc('set_player_team', { p_team_id })` upserts profile (SECURITY DEFINER, bypasses RLS)
- Cold launch always shows login screen (existing session signed out on bootstrap)
- "My Teams" preference stored in `expo-secure-store` key `team-prefs`
- Season fingerprint: active league IDs — change clears stored teams

### Admin Auth
- Standard email/password via `supabase.auth.signInWithPassword()`
- Profile `role = 'admin'`

### Login Flow (3 steps)
1. **Pick**: "Continue as Player" (team picker, plain list from scheduled matches only) | "League Operator Login"
2. **Confirm**: "You selected [team]?" → Yes / Change Team
3. **Match**: sign in → fetch active matches → 0 matches → dashboard | 1 match → auto-navigate | 2+ matches → list

### Match Navigation by Status (from login)
| Status | Route |
|---|---|
| `scheduled` | `/(team)/(tabs)/scoring/${id}/lineup` |
| `lineup_set` | `/(team)/(tabs)/scoring/${id}/0` |
| `in_progress` | `/(team)/(tabs)/scoring/${id}/${currentIndividualMatch ?? 0}` |

---

## 4. Data Model (Actual Schema)

### Enums
| Type | Values |
|---|---|
| `game_format` | `eight_ball`, `nine_ball` |
| `match_status` | `imported`, `scheduled`, `lineup_set`, `in_progress`, `completed`, `finalized`, `disputed` |
| `audit_action` | `create`, `update`, `delete`, `finalize`, `reopen`, `lock`, `unlock`, `import`, `dispute_create`, `dispute_resolve` |
| `user_role` | `admin`, `team` |
| `import_status` | `pending`, `processing`, `completed`, `failed` |
| `import_row_status` | `success`, `error`, `skipped` |
| `dispute_status` | `open`, `under_review`, `resolved`, `dismissed` |

### profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | FK → auth.users |
| role | user_role | DEFAULT 'team' |
| team_id | uuid | FK → teams |
| display_name | text | |

### leagues
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| game_format | game_format | |
| season | text | e.g. 'Spring' |
| year | integer | |
| is_active | boolean | DEFAULT true |
| created_by | uuid | FK → profiles |

### divisions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| league_id | uuid | FK → leagues |
| name | text | |
| day_of_week | integer | 0–6 |
| location | text | |

### teams
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| division_id | uuid | FK → divisions |
| name | text | |
| team_number | text | APA team number |

### players
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| first_name | text | |
| last_name | text | |
| member_number | text UNIQUE | APA 5-digit ID |
| skill_level | integer | 1–9, DEFAULT 5 |
| game_format | game_format | |

### team_players (roster junction)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| team_id | uuid | FK → teams |
| player_id | uuid | FK → players |
| skill_level | integer | team-specific SL override |
| is_active | boolean | DEFAULT true |
| is_captain | boolean | DEFAULT false |
| matches_played | integer | DEFAULT 0 |
| joined_at | timestamptz | |
| left_at | timestamptz | |

### skill_level_history
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| player_id | uuid | FK → players |
| league_id | uuid | FK → leagues |
| old_level / new_level | integer | |
| effective_date | date | |

### team_matches
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| division_id | uuid | FK → divisions |
| home_team_id | uuid | FK → teams |
| away_team_id | uuid | FK → teams |
| match_date | date | |
| week_number | integer | |
| status | match_status | DEFAULT 'scheduled'; `imported` = parsed but not yet promoted by admin |
| import_id | uuid | FK → imports ON DELETE SET NULL; set by edge function; used to cascade-delete unscheduled matches when import is deleted |
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
| Admin email/password login | ✅ BUILT | |
| Cold-launch always show login | ✅ BUILT | Bootstrap signs out session |
| Remembered team preferences | ✅ BUILT | `expo-secure-store` |
| Season fingerprint (clear stale teams) | ✅ BUILT | |
| Logout (team side) | ✅ BUILT | Icon in dashboard header + Quick Actions |
| Forgot Password / reset | ❌ NOT STARTED | |

### Admin — League Management
| Feature | Status | Notes |
|---|---|---|
| League list | ✅ BUILT | |
| League detail + edit | ✅ BUILT | |
| Create league (name, format, season, year) | ✅ BUILT | |
| League type dropdown (APA/TAP/BCA/Other) | ❌ NOT STARTED | Spec req; only game_format stored |
| Auto-fill settings from league type | ❌ NOT STARTED | All settings currently hardcoded |
| "Modified from defaults" indicator | ❌ NOT STARTED | |
| Division management (add/remove) | ✅ BUILT | Within league detail screen |
| League Settings page (configurable rules) | ❌ NOT STARTED | See §8 Gaps |

### Admin — Match Management
| Feature | Status | Notes |
|---|---|---|
| Match list with filter chips | ✅ BUILT | Scheduled / In Progress / Completed / Disputed / Finalized |
| Match detail (read-only) | ✅ BUILT | Players, scores, audit log, disputes |
| Reopen finalized match | ✅ BUILT | Requires typed reason |
| Match flagging & notes | ❌ NOT STARTED | Tags: Score dispute, Stalled, Needs review, free-text |
| Force takeover (admin takes scoring control) | ❌ NOT STARTED | |
| Schedule generation | ❌ NOT STARTED | Matches currently imported via PDF |

### Admin — PDF Import
| Feature | Status | Notes |
|---|---|---|
| File picker + upload to Storage | ✅ BUILT | Native FormData + REST API |
| PDF parsing (APA scoresheet format) | ✅ BUILT | Column-major layout, member# as key |
| Parse both teams from single PDF | ✅ BUILT | H/A flag on each row |
| Import results screen | ✅ BUILT | Filter chips, row detail, error messages |
| Staging screen (checkboxes before publish) | ✅ BUILT | `imported` status; admin promotes to `scheduled` |
| Select All / uncheck to exclude pairs | ✅ BUILT | Division filter (8-ball / 9-ball / by division); Leave or Remove unscheduled |
| Re-import updates existing records | ✅ BUILT | Player names + SL updated; MP updated on team_players |

### Admin — Player & Team Management
| Feature | Status | Notes |
|---|---|---|
| Player management via import | ✅ BUILT | |
| Direct player CRUD | ❌ NOT STARTED | |
| Direct team CRUD | ❌ NOT STARTED | |
| Skill level history tracking | 🔶 PARTIAL | DB table exists; not surfaced in UI |

### Scorekeeping — Match Start
| Feature | Status | Notes |
|---|---|---|
| Coin flip modal (first match / not first) | ✅ BUILT | Steps: first_match → flip → result → accept/defer |
| Catchup wizard (starting mid-match) | ✅ BUILT | Retroactive data entry for prior matches |
| Catchup: select starting match (1–5) | ✅ BUILT | |
| Catchup: retro player + winner + racks | ✅ BUILT | |
| Catchup: partial racks on starting match | ✅ BUILT | |
| Catchup saves to DB (23-rule consistent) | ✅ BUILT | Upserts individual_matches |
| Put-up screen (Realtime two-device) | ✅ BUILT | Supabase Realtime `postgres_changes` |
| "Other team not started" message | ✅ BUILT | `opponentConnected` flag |
| Dev bypass (triple-tap title, solo testing) | ✅ BUILT | Hidden; auto-fills both players from roster |
| Resume screen (select in-progress match) | ✅ BUILT | Shows all 5 slots, status, last resumed time |

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
| Undo / Back (one level deep, snapshot-based) | ✅ BUILT | "Back to [Player]'s turn" / "Undo Game Over" |
| ON THE HILL indicator | ✅ BUILT | Yellow dot + text |
| Rack dots scoreboard | ✅ BUILT | |
| Defensive shot tracking | ✅ BUILT | |
| Break & Run / 8 on Break flags | ✅ BUILT | |
| Scorecard sessions (pessimistic locking) | ❌ NOT STARTED | Table exists; not wired into app |
| Live viewer (read-only mode) | ❌ NOT STARTED | |
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

### Admin — Disputes
| Feature | Status | Notes |
|---|---|---|
| Disputes table (DB) | ✅ BUILT | |
| Disputes UI | ❌ NOT STARTED | Admin dashboard shows count placeholder |
| Protest/dispute workflow | ❌ NOT STARTED | |

---

## 6. Screen Inventory

| Screen | Route | Status | Notes |
|---|---|---|---|
| **AUTH** | | | |
| Login | `/(auth)/login` | ✅ BUILT | 3-step: pick → confirm → match |
| Admin Login | `/(auth)/admin-login` | ✅ BUILT | Email/password |
| Forgot Password | — | ❌ NOT STARTED | |
| **TEAM** | | | |
| Team Dashboard | `/(team)/(tabs)/` | ✅ BUILT | Next match, season summary, quick actions, logout |
| Scoring Index | `/(team)/(tabs)/scoring` | ✅ BUILT | Scorable match list |
| Coin Flip Modal | component | ✅ BUILT | Used by dashboard + scoring index |
| Catchup Wizard | `/(team)/(tabs)/scoring/[matchId]/catchup` | ✅ BUILT | |
| Put Up | `/(team)/(tabs)/scoring/[matchId]/putup` | ✅ BUILT | Realtime two-device |
| Resume | `/(team)/(tabs)/scoring/[matchId]/resume` | ✅ BUILT | |
| Individual Match Scoring | `/(team)/(tabs)/scoring/[matchId]/[individualMatchIndex]` | ✅ BUILT | Full scoring screen |
| Finalize | `/(team)/(tabs)/scoring/[matchId]/finalize` | ✅ BUILT | |
| Schedule | `/(team)/(tabs)/schedule` | ❌ NOT STARTED | Linked from Quick Actions |
| Roster | `/(team)/(tabs)/roster` | ❌ NOT STARTED | Linked from Quick Actions |
| Match History | `/(team)/(tabs)/history` | ❌ NOT STARTED | Linked from Quick Actions |
| Live Viewer (read-only) | — | ❌ NOT STARTED | |
| Handoff Request (Initiator) | — | ❌ NOT STARTED | Full flow per spec §4.2 |
| Handoff Request (Receiver) | — | ❌ NOT STARTED | |
| **ADMIN** | | | |
| Admin Dashboard | `/(admin)/(tabs)/` | ✅ BUILT | Stats cards + quick actions |
| League List | `/(admin)/(tabs)/leagues` | ✅ BUILT | |
| League Detail | `/(admin)/(tabs)/leagues/[leagueId]` | ✅ BUILT | Edit + division management |
| Create League | `/(admin)/(tabs)/leagues/create` | ✅ BUILT | |
| League Settings | — | ❌ NOT STARTED | Spec §2.2 |
| Match List | `/(admin)/(tabs)/matches` | ✅ BUILT | |
| Match Detail | `/(admin)/(tabs)/matches/[matchId]` | ✅ BUILT | Read-only + reopen |
| Match Flag / Notes | — | ❌ NOT STARTED | |
| Force Takeover Confirm | — | ❌ NOT STARTED | |
| Import Rosters | `/(admin)/(tabs)/import` | ✅ BUILT | Swipe-to-delete; cancel during upload; staged-count banner |
| Import Results | `/(admin)/(tabs)/import/[importId]` | ✅ BUILT | Filename formatted; conditional filter chips (Errors/Skipped hidden if clean) |
| Import Staging | `/(admin)/(tabs)/import/staging` | ✅ BUILT | Division filter, checkboxes, Move to Scheduled, Leave/Remove unscheduled |
| Player Management | — | ❌ NOT STARTED | Direct CRUD |
| Team Management | — | ❌ NOT STARTED | Direct CRUD |
| Admin Settings | `/(admin)/(tabs)/settings` | ✅ BUILT | Account, biometrics (TODO), sign out |

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
2. Break and Run (current player wins — special flag)
3. Fouled & Pocketed 8 Ball (opponent wins)

### Game Over — Normal (8-Ball)
1. Made 8 Ball (current player wins)
2. Scratched on 8 Ball (opponent wins)
3. 8 Ball in Wrong Pocket (opponent wins)
4. Made 8 Ball, Pocket Not Marked (opponent wins)

### APA Scoresheet PDF Column Layout
`SL | MP | Player # (5-digit member number) | Name`
Digit block = column-major: all SLs, then all MPs, then all member numbers, then concatenated names.
Member numbers are immutable identifiers. Names can change. `*` (incomplete) and `N` (not paid) markers stripped.

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

### Racks Not Written to DB
`racks_eight_ball` table exists but the scoring screen currently only writes match-level totals (`home_points_earned`, `away_points_earned`, `innings`) at match end. Per-rack data is not persisted.

### Scorecard Sessions Not Used
The pessimistic locking system (`scorecard_sessions`) is in the DB schema but the app does not acquire or release locks. Multiple devices can score simultaneously with no conflict detection.

### Handoff Flow Simplified
Spec §4.2 describes a request/confirm/read-only handoff. Current implementation: tapping the handoff icon shows an alert and navigates to the resume screen. No request flow, no read-only mode.

### PDF Import Staging — Implemented
Parsed matches land in `status = 'imported'` (invisible to teams). Admin reviews in staging screen, promotes selected matches to `scheduled`, and can leave or remove unchosen matches. Division filter supports 8-ball / 9-ball separation since the league has both formats.

### Disputes UI Missing
The `disputes` table is in the DB and the admin dashboard shows an Open Disputes count, but there is no screen to view, create, or resolve disputes.

---

## 9. Implementation Roadmap

### Priority 1 — Core Stability (testing phase)
- [ ] Fix any bugs found during two-device testing
- [ ] Persist per-rack data to `racks_eight_ball` during scoring (currently only match totals saved at end)
- [ ] Wire `scorecard_sessions` for basic conflict detection (prevent two devices scoring same match simultaneously)

### Priority 2 — Missing Screens (team side)
- [ ] Schedule screen `/(team)/(tabs)/schedule`
- [ ] Roster screen `/(team)/(tabs)/roster`
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
- [ ] Forgot Password flow

### Performance (deferred — app must be stable first)
- [ ] Parallelize DB writes in `saveAndNavigate` and finalize
- [ ] Parallelize edge function DB writes (currently sequential)

---

## Edge Function

**Deploy command:**
```bash
npx supabase functions deploy parse-pdf --project-ref lyhlnaibdqznipllfmuu --no-verify-jwt
```
`--no-verify-jwt` required — function handles auth internally (admin role check).
Docker not required for remote deploys (warning appears but works).

---

## DB Reset (dev only)
```sql
-- Clear match data, keep league + admin
TRUNCATE TABLE team_matches, team_players, players, skill_level_history CASCADE;
DELETE FROM teams;
DELETE FROM auth.users WHERE is_anonymous = true;
```

## Restore Admin Profile
```sql
INSERT INTO profiles (id, role)
SELECT id, 'admin' FROM auth.users WHERE is_anonymous = false
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

---

*Last updated: 2026-02-28 | Maintained alongside codebase in `/apa/SPEC.md`*
