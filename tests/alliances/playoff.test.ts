import { describe, it, expect } from 'vitest';
import { PLAYOFF_PAIRINGS, allianceMatchScore, allianceTeams, computeAllianceStandings } from '@/lib/alliances/playoff';

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
    expect(allianceTeams({ seed: 1, captain: 4, picks: [7] })).toEqual([4, 7]);
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

describe('allianceMatchScore', () => {
  it('без карточек возвращает балл матча как есть', () => {
    expect(allianceMatchScore(140, ['none', 'none', 'none'])).toBe(140);
  });

  it('красная карточка у любой из трёх команд обнуляет ВЕСЬ альянс', () => {
    // Мануал, RED CARD: «In PLAYOFF and FINAL MATCHES, when a team is issued
    // a RED CARD, the full TOURNAMENT ALLIANCE receives 0 points for that
    // specific MATCH» — в отличие от квалификации, где обнуляется только
    // сама команда.
    expect(allianceMatchScore(140, ['red', 'none', 'none'])).toBe(0);
    expect(allianceMatchScore(140, ['none', 'red', 'none'])).toBe(0);
    expect(allianceMatchScore(140, ['none', 'none', 'red'])).toBe(0);
  });

  it('жёлтая карточка альянс не обнуляет', () => {
    expect(allianceMatchScore(140, ['yellow', 'yellow', 'yellow'])).toBe(140);
  });

  it('белая карточка альянс не обнуляет', () => {
    // Мануал задаёт последствие белой карточки только для квалификации
    // («In RANKING MATCHES … the team receives 0 points»), про плей-офф
    // не говорит ничего. Читаем буквально: обнуляет альянс только красная.
    expect(allianceMatchScore(140, ['white', 'none', 'none'])).toBe(140);
  });
});
