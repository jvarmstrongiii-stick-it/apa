# Mid-Session Start — Spec

## Overview

When a match begins mid-night (the app couldn't be used for the first one or more individual matches), the home team enters the previously played results so the app can correctly track put-up order, player greyout, SL totals, and match points. The away team waits, then verifies the home team's entries before proceeding.

---

## Entry Point

`scoring/index.tsx` → `handleScheduledPress` routes to `first-match-check` (not directly to `coin-flip`).

---

## Screen: First Match Check (`first-match-check.tsx`)

Shown to both devices immediately after "Score Match" is tapped on a scheduled match.

- **Yes — Flip a Coin** → `coin-flip` (normal flow)
- **No — Enter Previous Matches** → `backfill`
- **Cancel** → back to scoring tab

Android hardware back is blocked on this screen.

---

## Screen: Backfill (`backfill.tsx`)

### Role detection

On load, the app checks `team_matches.home_team_id` against the signed-in user's `team_id`:
- `home_team_id === teamId` → **home team** (enters data)
- otherwise → **away team** (waits and verifies)

### Realtime channel

Both devices subscribe to `backfill_${matchId}` on load. Events:

| Event | Direction | Meaning |
|---|---|---|
| `backfill_saved` | home → away | Home finished entering data |
| `backfill_verified` | away → home | Away confirmed the data |
| `backfill_disputed` | away → home | Away flagged a discrepancy |
| `match_reset` | home → away | Match was reset; return to start |

---

## Home Team Flow

### Step 0 — Which match are you starting on?

Buttons: **1 · 2 · 3 · 4 · 5**

- Pick **1** → 0 backfill matches needed → navigate directly to `coin-flip`
- Pick **N (2–5)** → N−1 matches to enter → proceed to wizard

### Step 1 — Coin flip

- Who won the coin flip? (Home / Away)
- Did the winner put up first or defer?

### Steps 2–N — Per-match entry

For each previously played match:
- Select home player (from home roster)
- Select away player (from away roster)
- Enter racks won for each side (stepper)
- Winner badge shows **player name** (not team name)

SL is read from `team_players.current_8_ball_sl` or `current_9_ball_sl` based on `team_matches.game_format`.

Race-to values are computed from the RACE table using each player's SL.

### Step N+1 — Review

Read-only summary of all entered matches before saving. Home can go back to edit.

"Confirm & Save" button:
1. Upserts `individual_matches` rows (one per backfilled match) with `is_backfilled: true`
2. Writes `home_racks_won`, `away_racks_won`, `home_racks_needed`, `away_racks_needed`
3. Calculates and writes `home_points_earned`, `away_points_earned` (APA formula)
4. Sets `coin_flip_done: true` on `team_matches`
5. Broadcasts `backfill_saved` on `backfill_${matchId}`
6. Transitions to `home_waiting` phase

### Home Waiting phase

```
✓  Previous matches recorded.
   Waiting for [Away Team] to verify…
```

Listens for:
- `backfill_verified` → navigate to put-up for the next unplayed match
- `backfill_disputed` → snap back to the review step in the wizard

---

## Away Team Flow

### Away Waiting phase

```
⏳  Waiting for [Home Team]
    to enter previous match results…
```

Listens for:
- `backfill_saved` → fetch individual_matches rows, transition to `away_verifying`
- `match_reset` → navigate back to `first-match-check`

### Away Verifying phase — "Verify Previous Matches"

Read-only card for each backfilled match showing:
- Player names and skill levels
- Race to label (e.g., "Race to 3" if equal, "Race to 3–5" if different)
- Racks Won: X–Y
- Winner player name
- Points Earned (larger, blue)

**Looks Correct** button:
1. Broadcasts `backfill_verified` on `backfill_${matchId}`
2. Navigates to put-up for the next unplayed match

**Dispute button** ("Something looks off — approach [Home Team]'s captain to resolve"):
- Orange background (`#FF9800`), white text, same size as primary button
1. Broadcasts `backfill_disputed` on `backfill_${matchId}`
2. Returns away device to `away_waiting` phase

---

## APA Points Formula

| Outcome | Winner pts | Loser pts |
|---|---|---|
| Loser had 0 racks | 3 | 0 |
| Loser was on the hill (race_to − 1) | 2 | 1 |
| Loser had racks but not on hill | 2 | 0 |

---

## DB Columns Involved

### `individual_matches`

| Column | Type | Notes |
|---|---|---|
| `home_racks_needed` | int | Computed from RACE table at put-up time |
| `away_racks_needed` | int | Computed from RACE table at put-up time |
| `home_racks_won` | int | Rack count (game logic, completion detection) |
| `away_racks_won` | int | Rack count |
| `home_points_earned` | int | APA match points (0–3) |
| `away_points_earned` | int | APA match points (0–3) |
| `is_backfilled` | boolean | `true` if entered from scoresheet, `false` if scored live |
| `is_completed` | boolean | Authoritative completion flag |

### `team_matches`

| Column | Notes |
|---|---|
| `coin_flip_done` | Set `true` after backfill save (or live coin flip) |
| `first_put_up_team` | `'home'` or `'away'` — who puts up first |

---

## Reset Match

If a match is reset (`scoring/index.tsx` → `handleResetMatch`):
1. All `individual_matches` rows for this match are deleted
2. `team_matches` fields reset: `status`, `coin_flip_done`, `coin_flip_winner`, `first_put_up_team`
3. Broadcasts `match_reset` so any device in the backfill flow returns to `first-match-check`

---

## Finalize Screen

When all 5 individual matches are complete, the finalize screen shows a backfill summary banner if any matches have `is_backfilled: true`:

```
N matches from scoresheet · N scored in app
```

Points are calculated correctly regardless of whether the match was backfilled or scored live, using `home_racks_won`/`away_racks_won` for rack counts.

---

## Bug Fixes Included

- **False "no network" alert**: `NetInfo.isConnected` returns `null` briefly during navigation. Fixed: `=== false` check instead of `!value` in `putup.tsx` and `OfflineIndicator.tsx`.
- **Put-up waiting text**: Removed `opponentConnected` conditional that caused "Waiting for other team to open the app…" after backfill. Now always shows the meaningful message.
- **`lag_winner` not written**: Added `await` to the DB update in the scoring screen so errors surface rather than being silently dropped.
- **Progress screen showing backfilled matches as in-progress**: Was using APA points (0–3) as rack counts for completion detection. Fixed: uses `is_completed` flag and `home_racks_won`.

---

## Migrations Required (run manually in Supabase SQL editor)

- `00028_racks_needed.sql` — renames `home_race_to`→`home_racks_needed`, `away_race_to`→`away_racks_needed`, `home_games_won`→`home_racks_won`, `away_games_won`→`away_racks_won`
- `00033_is_backfilled.sql` — adds `is_backfilled boolean NOT NULL DEFAULT false` to `individual_matches`
