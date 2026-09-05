export interface TeamDeletionState {
  inQualificationMatches: boolean;
  inPlayoffMatches: boolean;
  inAlliances: boolean;
  hasSkillsAttempts: boolean;
}

/**
 * Why a team — or every team at once — cannot be deleted right now, or null
 * when it is safe.
 *
 * `matches` has no foreign key to `teams`, so that one has to be checked by
 * hand or the schedule ends up pointing at ids that no longer exist. But
 * `alliances` and `skills_attempts` *do* have real foreign keys, and the old
 * guard looked at matches only: with the schedule already reset, "Delete all"
 * reached the DELETE, MySQL refused it, and the operator got a 500 rendered as
 * "Something went wrong" with nothing to act on.
 *
 * The order is the order the operator has to clear things in: the bracket is
 * built from the alliances, the alliances from the qualification standings.
 * Skills attempts are independent, so they come last.
 */
export function teamDeletionBlockReason(
  state: TeamDeletionState, scope: 'all' | 'single',
): string | null {
  const subject = scope === 'single' ? 'This team' : 'Teams';
  const verb = scope === 'single' ? 'is' : 'are';

  if (state.inPlayoffMatches) {
    return `${subject} cannot be deleted — the playoff bracket still references ${
      scope === 'single' ? 'it' : 'them'}. Clear the bracket first.`;
  }
  if (state.inAlliances) {
    return `${subject} cannot be deleted — ${
      scope === 'single' ? 'it is' : 'they are'} part of an alliance. Reset the alliance selection first.`;
  }
  if (state.inQualificationMatches) {
    return `${subject} cannot be deleted — ${verb} already in the qualification schedule. Reset the schedule first.`;
  }
  if (state.hasSkillsAttempts) {
    return `${subject} cannot be deleted — skills attempts have been recorded. Delete the skills attempts first.`;
  }
  return null;
}
