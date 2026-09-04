-- The skills phase: one team on the field at a time, three attempts each.
--
-- Deliberately its own table rather than rows in `matches`. A match row
-- requires six teams and a schedule/ranking built around them; a skills
-- attempt is one team, and bending the match table to allow five empty slots
-- would put the qualification schedule, the playoff and the ranking at risk
-- the day before the event.
--
--   mysql -u root fgc < db/migrations/2026-09-04-skills.sql

CREATE TABLE IF NOT EXISTS skills_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- Which pass through the teams this is: every team takes attempt 1 before
  -- anyone takes attempt 2.
  round INT NOT NULL,
  -- Position within the round, so the running order is the operator's.
  position INT NOT NULL,
  team_id INT NOT NULL,
  -- Which side of the field the team plays from — the operator's choice.
  alliance ENUM('red','blue') NOT NULL DEFAULT 'red',
  played BOOLEAN NOT NULL DEFAULT FALSE,
  -- Balls the robot scored: one point each.
  suppression INT NOT NULL DEFAULT 0,
  -- Balls the human player threw in: five points each.
  human_balls INT NOT NULL DEFAULT 0,
  climb ENUM('none','contact','zone1','zone2','zone3') NOT NULL DEFAULT 'none',
  extinguisher INT NOT NULL DEFAULT 0,
  minor_fouls INT NOT NULL DEFAULT 0,
  major_fouls INT NOT NULL DEFAULT 0,
  card ENUM('none','yellow','white','red') NOT NULL DEFAULT 'none',
  FOREIGN KEY (team_id) REFERENCES teams(id),
  UNIQUE KEY uniq_round_team (round, team_id),
  INDEX idx_order (round, position)
) ENGINE=InnoDB;

-- The projector points at either a match or a skills attempt, never both.
ALTER TABLE display_state
  ADD COLUMN skills_attempt_id INT NULL AFTER match_id,
  ADD CONSTRAINT fk_display_skills FOREIGN KEY (skills_attempt_id) REFERENCES skills_attempts(id);
