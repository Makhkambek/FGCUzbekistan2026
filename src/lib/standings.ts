import { computeMatchScores } from './scoring/match';
import { allianceMatchScore } from './alliances/playoff';
import { computeTeamStanding, sortStandings } from './scoring/ranking';
import type { TeamMatchResult, TeamStanding } from './scoring/ranking';
import type { ClimbPosition, MatchInput } from './scoring/types';
import type { MatchRow } from './db/matches';

export function matchRowToInput(row: MatchRow): MatchInput {
  return {
    extinguisher: row.extinguisher,
    red: {
      suppression: row.suppression_red,
      climbs: [row.climb_red1, row.climb_red2, row.climb_red3] as [ClimbPosition, ClimbPosition, ClimbPosition],
      partnerClimbs: row.partner_climb_red,
      minorFouls: row.minor_fouls_red,
      majorFouls: row.major_fouls_red,
    },
    blue: {
      suppression: row.suppression_blue,
      climbs: [row.climb_blue1, row.climb_blue2, row.climb_blue3] as [ClimbPosition, ClimbPosition, ClimbPosition],
      partnerClimbs: row.partner_climb_blue,
      minorFouls: row.minor_fouls_blue,
      majorFouls: row.major_fouls_blue,
    },
  };
}

/**
 * The scores as they should be SHOWN for one match: the raw computation,
 * with the playoff red-card rule applied (a red card zeroes the whole
 * alliance for that match). Every surface that prints a match score must go
 * through this — the alliance table applied the rule and the projector and
 * match lists did not, so the same playoff match showed two different scores.
 *
 * Qualification is untouched here: there a card zeroes only the carded team,
 * inside the ranking, not the alliance's match score.
 */
export function matchScoresForDisplay(row: MatchRow) {
  const raw = computeMatchScores(matchRowToInput(row));
  if (row.phase !== 'playoff') return raw;
  return {
    ...raw,
    red: allianceMatchScore(raw.red, [row.card_red1, row.card_red2, row.card_red3]),
    blue: allianceMatchScore(raw.blue, [row.card_blue1, row.card_blue2, row.card_blue3]),
  };
}

export function teamResultsFromRows(rows: MatchRow[]): Map<number, TeamMatchResult[]> {
  const byTeam = new Map<number, TeamMatchResult[]>();

  for (const row of rows) {
    if (!row.played) continue;
    const scores = computeMatchScores(matchRowToInput(row));

    const sides = [
      { teams: [row.red1_id, row.red2_id, row.red3_id],
        cards: [row.card_red1, row.card_red2, row.card_red3],
        score: scores.red, suppression: row.suppression_red },
      { teams: [row.blue1_id, row.blue2_id, row.blue3_id],
        cards: [row.card_blue1, row.card_blue2, row.card_blue3],
        score: scores.blue, suppression: row.suppression_blue },
    ];

    for (const side of sides) {
      side.teams.forEach((teamId, i) => {
        const card = side.cards[i];
        const zeroed = card === 'white' || card === 'red';
        const list = byTeam.get(teamId) ?? [];
        list.push({
          matchId: row.id,
          score: zeroed ? 0 : side.score,
          suppression: zeroed ? 0 : side.suppression,
          redCard: card === 'red',
        });
        byTeam.set(teamId, list);
      });
    }
  }

  return byTeam;
}

export function standingsFromRows(teamIds: number[], rows: MatchRow[]): TeamStanding[] {
  const byTeam = teamResultsFromRows(rows);
  return sortStandings(teamIds.map((id) => computeTeamStanding(id, byTeam.get(id) ?? [])));
}
