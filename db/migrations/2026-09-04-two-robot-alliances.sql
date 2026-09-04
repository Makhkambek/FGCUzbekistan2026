-- A playoff alliance is two robots, not three, from 4 September 2026: three
-- alliances of two, seven teams at the event, and the qualification unchanged
-- at three robots a side.
--
-- Only the third slot of a match changes. It stays in the table because a
-- qualification match still fills it; a playoff match now leaves it empty.
--
--   mysql -u root fgc < db/migrations/2026-09-04-two-robot-alliances.sql

ALTER TABLE matches
  MODIFY red3_id INT NULL,
  MODIFY blue3_id INT NULL;

-- alliances.pick2_team_id is left in place and left empty: dropping it would
-- make a rollback to the previous build impossible mid-event.
