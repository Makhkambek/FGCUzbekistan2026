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
}

export function computeTeamStanding(teamId: number, results: TeamMatchResult[]): TeamStanding {
  if (results.length === 0) {
    return { teamId, rankingScore: 0, played: 0, best: 0, suppressionTotal: 0, droppedMatchId: null };
  }

  // Выкидываем один худший матч, но матч с красной карточкой выкинуть нельзя (M21).
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

  return {
    teamId,
    rankingScore: kept.length > 0 ? sum / kept.length : 0,
    played: results.length,
    best: Math.max(...kept.map((r) => r.score)),
    suppressionTotal: kept.reduce((acc, r) => acc + r.suppression, 0),
    droppedMatchId,
  };
}

export function sortStandings(standings: TeamStanding[]): TeamStanding[] {
  return [...standings].sort((a, b) =>
    b.rankingScore - a.rankingScore
    || b.best - a.best
    || b.suppressionTotal - a.suppressionTotal
    || a.teamId - b.teamId);
}
