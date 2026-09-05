import { describe, it, expect } from 'vitest';
import { teamDeletionBlockReason } from '@/lib/teams/guards';

const clear = {
  inQualificationMatches: false,
  inPlayoffMatches: false,
  inAlliances: false,
  hasSkillsAttempts: false,
};

describe('teamDeletionBlockReason', () => {
  it('allows deletion when nothing references the team(s)', () => {
    expect(teamDeletionBlockReason(clear, 'all')).toBeNull();
    expect(teamDeletionBlockReason(clear, 'single')).toBeNull();
  });

  // The old guard only looked at matches, so an alliance or a skills attempt
  // took the delete down with a foreign key error and a blank 500.
  it('blocks on alliances even when no match exists', () => {
    const reason = teamDeletionBlockReason({ ...clear, inAlliances: true }, 'all');
    expect(reason).toMatch(/alliance/i);
  });

  it('blocks on skills attempts even when no match exists', () => {
    const reason = teamDeletionBlockReason({ ...clear, hasSkillsAttempts: true }, 'all');
    expect(reason).toMatch(/skills/i);
  });

  // "Reset the schedule first" is wrong advice when the rows are in the
  // bracket — resetting qualification leaves the playoff matches untouched.
  it('names the playoff bracket, not the qualification schedule, for playoff rows', () => {
    const reason = teamDeletionBlockReason({ ...clear, inPlayoffMatches: true }, 'all');
    expect(reason).toMatch(/playoff/i);
    expect(reason).not.toMatch(/qualification schedule/i);
  });

  it('names the qualification schedule for qualification rows', () => {
    const reason = teamDeletionBlockReason({ ...clear, inQualificationMatches: true }, 'all');
    expect(reason).toMatch(/qualification/i);
  });

  // Whatever has to go first is what the operator should be told about first.
  it('reports the playoff bracket ahead of the other blockers', () => {
    const reason = teamDeletionBlockReason(
      { inQualificationMatches: true, inPlayoffMatches: true, inAlliances: true, hasSkillsAttempts: true },
      'all');
    expect(reason).toMatch(/playoff/i);
  });

  it('reports alliances ahead of the qualification schedule', () => {
    const reason = teamDeletionBlockReason(
      { ...clear, inQualificationMatches: true, inAlliances: true }, 'all');
    expect(reason).toMatch(/alliance/i);
  });

  it('phrases the single-team block about that one team', () => {
    const reason = teamDeletionBlockReason({ ...clear, inQualificationMatches: true }, 'single');
    expect(reason).toMatch(/this team/i);
  });

  it('phrases the delete-all block about every team', () => {
    const reason = teamDeletionBlockReason({ ...clear, inQualificationMatches: true }, 'all');
    expect(reason).not.toMatch(/this team/i);
  });
});
