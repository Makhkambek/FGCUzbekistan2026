-- Adds the match clock to the display state.
--
-- The projector counts 2:30 down from the moment the referee pressed
-- "Start match on display", so the start has to live on the server: three
-- screens reading their own laptop clocks would each show a different time.
--
-- Safe to run on a live database — the column is nullable and nothing reads
-- it until the new code is deployed.
--
--   mysql -u root fgc < db/migrations/2026-09-04-display-started-at.sql

ALTER TABLE display_state ADD COLUMN started_at DATETIME(3) NULL AFTER match_id;
