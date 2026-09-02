import { describe, it, expect } from 'vitest';
import { computeTeamStanding, sortStandings } from '@/lib/scoring/ranking';
import type { TeamMatchResult } from '@/lib/scoring/ranking';

const res = (matchId: number, score: number, suppression = 0, redCard = false): TeamMatchResult =>
  ({ matchId, score, suppression, redCard });

describe('computeTeamStanding', () => {
  it('без матчей даёт нули', () => {
    const s = computeTeamStanding(1, []);
    expect(s.rankingScore).toBe(0);
    expect(s.played).toBe(0);
    expect(s.droppedMatchId).toBeNull();
  });

  it('один матч не выкидывается', () => {
    const s = computeTeamStanding(1, [res(10, 50)]);
    expect(s.rankingScore).toBe(50);
    expect(s.droppedMatchId).toBeNull();
  });

  it('выкидывает один худший матч', () => {
    const s = computeTeamStanding(1, [res(10, 100), res(11, 40), res(12, 60)]);
    expect(s.droppedMatchId).toBe(11);
    expect(s.rankingScore).toBe(80); // (100 + 60) / 2
    expect(s.played).toBe(3);
  });

  it('матч с красной карточкой выкинуть нельзя', () => {
    const s = computeTeamStanding(1, [res(10, 100), res(11, 0, 0, true), res(12, 60)]);
    expect(s.droppedMatchId).toBe(12);      // выкидываем 60, а не ноль с карточкой
    expect(s.rankingScore).toBe(50);        // (100 + 0) / 2
  });

  it('если все матчи с красной карточкой — не выкидываем ничего', () => {
    const s = computeTeamStanding(1, [res(10, 0, 0, true), res(11, 0, 0, true)]);
    expect(s.droppedMatchId).toBeNull();
    expect(s.rankingScore).toBe(0);
  });

  it('лучший матч и suppression считаются без выкинутого', () => {
    const s = computeTeamStanding(1, [res(10, 100, 30), res(11, 40, 5), res(12, 60, 20)]);
    expect(s.best).toBe(100);
    expect(s.suppressionTotal).toBe(50); // 30 + 20, матч 11 выкинут
  });

  it('best включает выкинутый матч (приоритет красной карточки)', () => {
    // Матч 1: 100, не красная карточка, выкидывается
    // Матч 2: 20, красная карточка, не выкидывается
    // Матч 3: 10, красная карточка, не выкидывается
    // best должен быть 100 (из всех), rankingScore = (20+10)/2 = 15
    const s = computeTeamStanding(1, [res(1, 100, 0, false), res(2, 20, 0, true), res(3, 10, 0, true)]);
    expect(s.best).toBe(100);
    expect(s.droppedMatchId).toBe(1);
    expect(s.rankingScore).toBe(15);
  });
});

describe('sortStandings', () => {
  const st = (teamId: number, rankingScore: number, best: number, suppressionTotal: number, keptCount = 3) => ({
    teamId,
    rankingScore,
    best,
    suppressionTotal,
    played: 3,
    droppedMatchId: null,
    sum: rankingScore * keptCount,
    keptCount,
  });

  it('сортирует по рейтингу по убыванию', () => {
    const r = sortStandings([st(1, 50, 60, 10), st(2, 80, 90, 10)]);
    expect(r.map((x) => x.teamId)).toEqual([2, 1]);
  });

  it('первый тайбрейк — лучший одиночный матч', () => {
    const r = sortStandings([st(1, 50, 60, 99), st(2, 50, 90, 10)]);
    expect(r.map((x) => x.teamId)).toEqual([2, 1]);
  });

  it('второй тайбрейк — сумма suppression', () => {
    const r = sortStandings([st(1, 50, 60, 10), st(2, 50, 60, 40)]);
    expect(r.map((x) => x.teamId)).toEqual([2, 1]);
  });

  it('равные средние при разных суммах и количествах матчей', () => {
    // Team 1: 100/2 = 50
    // Team 2: 150/3 = 50 (математически одинаково)
    // Они равны по рейтингу, поэтому применяется первый тайбрейк (best)
    // Team 1 имеет best=100, Team 2 имеет best=90, поэтому Team 1 выше
    const r = sortStandings([
      { teamId: 1, rankingScore: 50, best: 100, suppressionTotal: 10, played: 2, droppedMatchId: null, sum: 100, keptCount: 2 },
      { teamId: 2, rankingScore: 50, best: 90, suppressionTotal: 10, played: 3, droppedMatchId: null, sum: 150, keptCount: 3 },
    ]);
    expect(r.map((x) => x.teamId)).toEqual([1, 2]);
  });
});
