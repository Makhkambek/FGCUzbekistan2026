-- Automatic rollback point for destructive schedule actions.
--
-- Before a reset, a regeneration over an existing schedule, or a single result
-- being cleared, the phase's rows are copied here verbatim. Restoring puts the
-- same matches back with the same ids and the same scores.
--
-- Safe to run on a live database — nothing reads the table until the new code
-- is deployed.
--
--   mysql -u root fgc < db/migrations/2026-09-04-match-snapshots.sql

CREATE TABLE IF NOT EXISTS match_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  phase ENUM('qualification','playoff') NOT NULL,
  -- What was about to happen: 'reset', 'regenerate' or 'match-reset'.
  reason VARCHAR(32) NOT NULL,
  match_count INT NOT NULL,
  played_count INT NOT NULL,
  -- The rows themselves, exactly as SELECT * returned them.
  rows_json JSON NOT NULL,
  INDEX idx_phase_created (phase, created_at)
) ENGINE=InnoDB;
