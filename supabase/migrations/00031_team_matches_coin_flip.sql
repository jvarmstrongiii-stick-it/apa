-- Migration 00031: Track coin flip result on team_matches.
-- The coin flip is currently UI-only (no DB trace). Writing the result here
-- lets the Schedule detail screen show contextual state: awaiting flip vs
-- awaiting first put-up.

ALTER TABLE team_matches
  ADD COLUMN coin_flip_done    boolean NOT NULL DEFAULT false,
  ADD COLUMN first_put_up_team text    CHECK (first_put_up_team IN ('home', 'away')),
  ADD COLUMN coin_flip_winner  text    CHECK (coin_flip_winner  IN ('home', 'away'));
