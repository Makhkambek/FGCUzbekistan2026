export interface TeamMatchResult {
  matchId: number;
  score: number;
  suppression: number;
  redCard: boolean;
}

export interface TeamStanding {
  teamId: number;
  rankingScore: number;
  played: number;
  best: number;
  suppressionTotal: number;
  droppedMatchId: number | null;
  sum: number;
  keptCount: number;
}

export function computeTeamStanding(teamId: number, results: TeamMatchResult[]): TeamStanding {
  if (results.length === 0) {
    return { teamId, rankingScore: 0, played: 0, best: 0, suppressionTotal: 0, droppedMatchId: null, sum: 0, keptCount: 0 };
  }

  // Drop the single worst match, except a match with a red card cannot be dropped (M21).
  let droppedMatchId: number | null = null;
  if (results.length >= 2) {
    const droppable = results.filter((r) => !r.redCard);
    if (droppable.length > 0) {
      const worst = droppable.reduce((a, b) => (b.score < a.score ? b : a));
      droppedMatchId = worst.matchId;
    }
  }

  const kept = results.filter((r) => r.matchId !== droppedMatchId);
  const sum = kept.reduce((acc, r) => acc + r.score, 0);
  const keptCount = kept.length;

  return {
    teamId,
    rankingScore: keptCount > 0 ? sum / keptCount : 0,
    played: results.length,
    best: Math.max(...results.map((r) => r.score)),
    suppressionTotal: kept.reduce((acc, r) => acc + r.suppression, 0),
    droppedMatchId,
    sum,
    keptCount,
  };
}

export function sortStandings(standings: TeamStanding[]): TeamStanding[] {
  return [...standings].sort((a, b) => {
    // Compare ranking scores using integer cross-multiplication
    // Avoid floating-point dust: b.sum/b.keptCount vs a.sum/a.keptCount
    // becomes b.sum * a.keptCount vs a.sum * b.keptCount
    if (a.keptCount > 0 && b.keptCount > 0) {
      const cmp = b.sum * a.keptCount - a.sum * b.keptCount;
      if (cmp !== 0) return cmp;
    } else if (a.keptCount === 0 && b.keptCount > 0) {
      return 1; // a has no matches, b has matches → b ranks higher
    } else if (a.keptCount > 0 && b.keptCount === 0) {
      return -1; // a has matches, b has no matches → a ranks higher
    }
    // Both have keptCount === 0, fall through to tiebreakers

    // Tiebreaker 1: best match score
    if (b.best !== a.best) return b.best - a.best;

    // Tiebreaker 2: suppression total
    if (b.suppressionTotal !== a.suppressionTotal) return b.suppressionTotal - a.suppressionTotal;

    // Tiebreaker 3: team ID (ascending)
    return a.teamId - b.teamId;
  });
}
