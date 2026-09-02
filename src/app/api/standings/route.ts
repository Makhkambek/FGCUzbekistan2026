import { NextResponse } from 'next/server';
import { listTeams } from '@/lib/db/teams';
import { listMatches } from '@/lib/db/matches';
import type { MatchRow } from '@/lib/db/matches';
import { standingsFromRows, matchRowToInput } from '@/lib/standings';
import { computeMatchScores } from '@/lib/scoring/match';
import type { MatchScores } from '@/lib/scoring/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [teams, rows] = await Promise.all([listTeams(), listMatches()]);
  const names = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  // Считаем очки построчно и изолируем сбои: если один матч не удаётся
  // просчитать (повреждённые данные и т.п.), остальное табло не должно падать.
  // Строка исключается и из standings (чтобы не звать ту же вычислительную
  // функцию повторно на заведомо плохих данных), и получает null-очки в матчах.
  const validRows: MatchRow[] = [];
  const scoresById = new Map<number, MatchScores>();

  for (const r of rows) {
    try {
      scoresById.set(r.id, computeMatchScores(matchRowToInput(r)));
      validRows.push(r);
    } catch (err) {
      console.error(`/api/standings: failed to score match id=${r.id} (#${r.match_number}), skipping row`, err);
    }
  }

  const standings = standingsFromRows(teams.map((t) => t.id), validRows).map((s) => ({
    ...s, name: names[s.teamId] ?? String(s.teamId),
  }));

  const matches = rows.map((r) => {
    const s = scoresById.get(r.id) ?? null;
    return {
      id: r.id, number: r.match_number, phase: r.phase, played: !!r.played,
      red: [r.red1_id, r.red2_id, r.red3_id].map((id) => names[id] ?? id),
      blue: [r.blue1_id, r.blue2_id, r.blue3_id].map((id) => names[id] ?? id),
      redScore: r.played && s ? s.red : null,
      blueScore: r.played && s ? s.blue : null,
    };
  });

  return NextResponse.json({ standings, matches });
}
