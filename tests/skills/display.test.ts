import { describe, it, expect } from 'vitest';
import { buildSkillsPayload } from '../../src/lib/skills/display';
import type { SkillsAttemptRow } from '../../src/lib/db/skills';
import type { DisplayState } from '../../src/lib/display';

// `SkillsAttemptRow` carries mysql2's RowDataPacket brand, which a plain
// object literal cannot satisfy — the fields are what these tests are about.
function attempt(over: Record<string, unknown> = {}): SkillsAttemptRow {
  return {
    id: 1, round: 1, position: 1, team_id: 7, alliance: 'red', played: 1,
    suppression: 10, human_balls: 2, climb: 'zone2', extinguisher: 20,
    minor_fouls: 0, major_fouls: 0, card: 'none', ...over,
  } as SkillsAttemptRow;
}

const state = (phase: DisplayState['phase']): DisplayState => ({
  phase, matchId: null, skillsAttemptId: 1, startedAt: null, serverNow: 1000,
});

describe('the skills screen is shaped like a match screen', () => {
  it('puts the team in the first slot of its own side', () => {
    const p = buildSkillsPayload(state('result'), attempt({ alliance: 'blue' }), 'Uzbekistan');
    expect(p.blue.teams[0]).toBe('Uzbekistan');
  });

  it('fills every other slot on the field with a dash', () => {
    const p = buildSkillsPayload(state('result'), attempt({ alliance: 'blue' }), 'Uzbekistan');
    expect(p.blue.teams).toEqual(['Uzbekistan', '—', '—']);
    expect(p.red.teams).toEqual(['—', '—', '—']);
    expect(p.blue.ranks).toEqual([null, null, null]);
  });

  it('follows the team when it plays from the red side instead', () => {
    const p = buildSkillsPayload(state('result'), attempt({ alliance: 'red' }), 'Uzbekistan');
    expect(p.red.teams).toEqual(['Uzbekistan', '—', '—']);
    expect(p.blue.teams).toEqual(['—', '—', '—']);
  });

  it('reports what the fouls took off the attempt, as a negative', () => {
    // 10 + 2×5 = 20 balls, ×1.20 for zone2 = 24, +20 extinguisher = 44.
    // One major foul is 10% of 44 = 4.4, rounded up to 5 as the manual says.
    const p = buildSkillsPayload(state('result'), attempt({ major_fouls: 1 }), 'Uzbekistan');
    expect(p.score).toBe(39);
    expect(p.penalty).toBe(-5);
  });

  it('has nothing taken off when there are no fouls', () => {
    expect(buildSkillsPayload(state('result'), attempt(), 'Uzbekistan').penalty).toBe(0);
  });

  it('does not dress a red card up as a foul deduction', () => {
    // The card zeroes the attempt; nothing was taken off it by fouls. Without
    // this the screen reports "own fouls -60" for a team that committed none.
    const p = buildSkillsPayload(state('result'), attempt({ card: 'red' }), 'Uzbekistan');
    expect(p.score).toBe(0);
    expect(p.penalty).toBe(0);
    expect(p.redCard).toBe(true);
  });

  it('says there is no card when there is none', () => {
    expect(buildSkillsPayload(state('result'), attempt(), 'Uzbekistan').redCard).toBe(false);
  });

  it('a yellow card leaves the attempt alone', () => {
    const p = buildSkillsPayload(state('result'), attempt({ card: 'yellow' }), 'Uzbekistan');
    expect(p.redCard).toBe(false);
    expect(p.score).toBe(44);
  });

  it('holds the score back while the attempt is still running', () => {
    const p = buildSkillsPayload(state('live'), attempt(), 'Uzbekistan');
    expect(p.phase).toBe('skills-live');
    expect(p.score).toBeNull();
  });
});
