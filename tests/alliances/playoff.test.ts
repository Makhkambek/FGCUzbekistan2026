import { describe, it, expect } from 'vitest';
import { PLAYOFF_PAIRINGS, allianceTeams, computeAllianceStandings } from '@/lib/alliances/playoff';

describe('PLAYOFF_PAIRINGS', () => {
  it('три матча по Table 6-3 мануала', () => {
    expect(PLAYOFF_PAIRINGS).toEqual([
      { matchNumber: 1, redSeed: 1, blueSeed: 3 },
      { matchNumber: 2, redSeed: 3, blueSeed: 2 },
      { matchNumber: 3, redSeed: 2, blueSeed: 1 },
    ]);
  });

  it('каждый альянс играет ровно два матча', () => {
    for (const seed of [1, 2, 3]) {
      const played = PLAYOFF_PAIRINGS.filter((p) => p.redSeed === seed || p.blueSeed === seed);
      expect(played).toHaveLength(2);
    }
  });
});

describe('allianceTeams', () => {
  it('возвращает капитана и оба пика', () => {
    expect(allianceTeams({ seed: 1, captain: 4, picks: [7, 9] })).toEqual([4, 7, 9]);
  });
});

describe('computeAllianceStandings', () => {
  it('суммирует два балла альянса и сортирует по убыванию', () => {
    const r = computeAllianceStandings([
      { seed: 1, score: 100 }, { seed: 3, score: 90 },
      { seed: 3, score: 80 }, { seed: 2, score: 70 },
      { seed: 2, score: 60 }, { seed: 1, score: 50 },
    ]);
    expect(r).toEqual([
      { seed: 3, total: 170, matchesPlayed: 2 },
      { seed: 1, total: 150, matchesPlayed: 2 },
      { seed: 2, total: 130, matchesPlayed: 2 },
    ]);
  });

  it('учитывает альянсы без сыгранных матчей', () => {
    const r = computeAllianceStandings([{ seed: 1, score: 10 }]);
    expect(r[0]).toEqual({ seed: 1, total: 10, matchesPlayed: 1 });
    expect(r).toHaveLength(3);
  });
});
