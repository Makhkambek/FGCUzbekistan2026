import { describe, it, expect } from 'vitest';
import {
  HUMAN_BALL_POINTS, skillsAttemptScore, skillsStandings, skillsAttemptOrder,
  skillsAttemptsByTeam, skillsTeamIds,
} from '@/lib/skills/scoring';
import type { SkillsAttemptInput } from '@/lib/skills/scoring';

const attempt = (over: Partial<SkillsAttemptInput> = {}): SkillsAttemptInput => ({
  suppression: 0, humanBalls: 0, climb: 'none', extinguisher: 0,
  minorFouls: 0, majorFouls: 0, card: 'none', ...over,
});

describe('skillsAttemptScore', () => {
  it('мяч хюман-плеера стоит пять, обычный — один', () => {
    expect(HUMAN_BALL_POINTS).toBe(5);
    expect(skillsAttemptScore(attempt({ suppression: 10 }))).toBe(10);
    expect(skillsAttemptScore(attempt({ humanBalls: 10 }))).toBe(50);
  });

  it('мячи робота и хюман-плеера складываются в одну копилку', () => {
    expect(skillsAttemptScore(attempt({ suppression: 30, humanBalls: 4 }))).toBe(50);
  });

  // Подъём умножает всё подавление — и мячи хюман-плеера тоже, они такие же
  // мячи, просто дороже.
  it('множитель за подъём применяется ко всей копилке', () => {
    expect(skillsAttemptScore(attempt({ suppression: 100, climb: 'zone3' }))).toBe(130);
    expect(skillsAttemptScore(attempt({ humanBalls: 20, climb: 'zone3' }))).toBe(130);
  });

  it('дробные очки округляются вверх, как в мануале', () => {
    // 10 × 1.05 = 10.5 → 11
    expect(skillsAttemptScore(attempt({ suppression: 10, climb: 'contact' }))).toBe(11);
  });

  it('огнетушитель прибавляется без множителя', () => {
    expect(skillsAttemptScore(attempt({ suppression: 100, climb: 'zone3', extinguisher: 40 }))).toBe(170);
  });

  it('фолы снимают проценты с собственного счёта — соперника, которому их отдать, здесь нет', () => {
    // 100 очков, один MINOR (5%) → 95
    expect(skillsAttemptScore(attempt({ suppression: 100, minorFouls: 1 }))).toBe(95);
    // MAJOR — 10%
    expect(skillsAttemptScore(attempt({ suppression: 100, majorFouls: 1 }))).toBe(90);
    // складываются от одной базы, округление один раз
    expect(skillsAttemptScore(attempt({ suppression: 100, minorFouls: 2, majorFouls: 1 }))).toBe(80);
  });

  it('счёт не уходит в минус при куче фолов', () => {
    expect(skillsAttemptScore(attempt({ suppression: 10, minorFouls: 20, majorFouls: 20 }))).toBe(0);
  });

  it('красная карточка обнуляет попытку', () => {
    expect(skillsAttemptScore(attempt({ suppression: 200, humanBalls: 10, card: 'red' }))).toBe(0);
  });

  it('жёлтая и белая карточки на счёт не влияют', () => {
    expect(skillsAttemptScore(attempt({ suppression: 50, card: 'yellow' }))).toBe(50);
    expect(skillsAttemptScore(attempt({ suppression: 50, card: 'white' }))).toBe(50);
  });
});

describe('skillsAttemptOrder', () => {
  // Сначала все первые попытки, потом все вторые: команда успевает починить
  // робота, а зал не смотрит три подряд одну и ту же команду.
  it('идёт по кругу: все первые попытки, потом все вторые', () => {
    expect(skillsAttemptOrder([7, 3, 9], 3)).toEqual([
      { round: 1, teamId: 7 }, { round: 1, teamId: 3 }, { round: 1, teamId: 9 },
      { round: 2, teamId: 7 }, { round: 2, teamId: 3 }, { round: 2, teamId: 9 },
      { round: 3, teamId: 7 }, { round: 3, teamId: 3 }, { round: 3, teamId: 9 },
    ]);
  });

  it('порядок команд сохраняется таким, каким его задал судья', () => {
    expect(skillsAttemptOrder([2, 1], 1)).toEqual([{ round: 1, teamId: 2 }, { round: 1, teamId: 1 }]);
  });

  it('ноль попыток или ноль команд — пустое расписание', () => {
    expect(skillsAttemptOrder([1, 2], 0)).toEqual([]);
    expect(skillsAttemptOrder([], 3)).toEqual([]);
  });
});

describe('skillsStandings', () => {
  const a = (teamId: number, round: number, score: number, played = true) =>
    ({ teamId, round, score, played });

  it('итог команды — сумма всех её попыток', () => {
    const s = skillsStandings([1, 2], [a(1, 1, 100), a(1, 2, 50), a(1, 3, 25), a(2, 1, 90)]);
    expect(s[0]).toMatchObject({ teamId: 1, total: 175, attemptsPlayed: 3, best: 100 });
    expect(s[1]).toMatchObject({ teamId: 2, total: 90, attemptsPlayed: 1 });
  });

  it('несыгранные попытки в сумму не идут', () => {
    const s = skillsStandings([1], [a(1, 1, 100), a(1, 2, 999, false)]);
    expect(s[0]).toMatchObject({ total: 100, attemptsPlayed: 1 });
  });

  it('команда без попыток стоит в таблице с нулём и уходит вниз', () => {
    const s = skillsStandings([1, 2], [a(2, 1, 10)]);
    expect(s.map((x) => x.teamId)).toEqual([2, 1]);
    expect(s[1]).toMatchObject({ teamId: 1, total: 0, attemptsPlayed: 0 });
  });

  it('при равной сумме выше тот, у кого лучше одна попытка', () => {
    const s = skillsStandings([1, 2], [a(1, 1, 50), a(1, 2, 50), a(2, 1, 90), a(2, 2, 10)]);
    expect(s.map((x) => x.teamId)).toEqual([2, 1]);
  });

  it('при полном равенстве порядок устойчив — по номеру команды', () => {
    const s = skillsStandings([5, 3], [a(5, 1, 40), a(3, 1, 40)]);
    expect(s.map((x) => x.teamId)).toEqual([3, 5]);
  });
});

describe('a team\'s attempts, listed for the board', () => {
  it('lists every round in order, whether or not it has been taken', () => {
    const rows = skillsAttemptsByTeam(
      [1],
      [
        { teamId: 1, round: 2, score: 30, played: true },
        { teamId: 1, round: 1, score: 40, played: true },
        { teamId: 1, round: 3, score: 0, played: false },
      ],
    );
    expect(rows[1]).toEqual([
      { round: 1, score: 40, played: true },
      { round: 2, score: 30, played: true },
      { round: 3, score: null, played: false },
    ]);
  });

  it('holds no score for an attempt that has not been taken yet', () => {
    const rows = skillsAttemptsByTeam([1], [{ teamId: 1, round: 1, score: 12, played: false }]);
    expect(rows[1][0].score).toBeNull();
  });

  it('keeps one team out of another team\'s list', () => {
    const rows = skillsAttemptsByTeam([1, 2], [
      { teamId: 1, round: 1, score: 40, played: true },
      { teamId: 2, round: 1, score: 10, played: true },
    ]);
    expect(rows[1]).toHaveLength(1);
    expect(rows[2][0].score).toBe(10);
  });

  it('gives a team with nothing in the order an empty list rather than nothing at all', () => {
    expect(skillsAttemptsByTeam([5], [])[5]).toEqual([]);
  });
});

describe('who belongs on the skills board', () => {
  const attempts = [
    { teamId: 1, round: 1, score: 40, played: true },
    { teamId: 2, round: 1, score: 0, played: false },
  ];

  it('lists a team that is in the order but has not played yet', () => {
    const rows = skillsStandings(skillsTeamIds(attempts), attempts);
    expect(rows.map((r) => r.teamId).sort()).toEqual([1, 2]);
  });

  it('leaves out a team that is not in the order at all', () => {
    expect(skillsTeamIds(attempts)).not.toContain(3);
  });

  it('names each team once, however many attempts it has', () => {
    expect(skillsTeamIds([
      { teamId: 1, round: 1, score: 1, played: true },
      { teamId: 1, round: 2, score: 2, played: true },
    ])).toEqual([1]);
  });

  it('keeps the order the operator built', () => {
    expect(skillsTeamIds([
      { teamId: 7, round: 1, score: 0, played: false },
      { teamId: 3, round: 1, score: 0, played: false },
    ])).toEqual([7, 3]);
  });
});
