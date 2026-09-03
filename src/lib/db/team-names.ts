/**
 * The existing team name that collides with `candidate`, or null when the name
 * is free.
 *
 * Compared trimmed and case-insensitively: on a tournament day two rows that
 * read the same to a judge are the same team, whatever the whitespace or
 * capitalisation says. `teams.name` carries no UNIQUE constraint (adding one
 * to a live database mid-tournament is riskier than checking here), so this is
 * what keeps a double-clicked "Add" from seating a phantom team that then
 * turns up in the generated schedule and in the rankings.
 */
export function findDuplicateName(existingNames: string[], candidate: string): string | null {
  const needle = candidate.trim().toLocaleLowerCase();
  return existingNames.find((name) => name.trim().toLocaleLowerCase() === needle) ?? null;
}
