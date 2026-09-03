export interface ScheduleResetState {
  hasPlayedMatches: boolean;
  hasAlliances: boolean;
  hasPlayoffMatches: boolean;
}

/**
 * Why a full reset of the qualification schedule must be refused right now,
 * or null when it is safe.
 *
 * Deleting the qualification phase throws away every entered result with it,
 * so the played check belongs here just as much as it belongs on regeneration
 * — the two endpoints destroy exactly the same rows. It was missing on the
 * reset path, which meant one click on the schedule page could wipe a day of
 * scoring while alliances did not exist yet and the other guard stayed quiet.
 *
 * The played reason wins over the others: it is the one that names data the
 * operator cannot get back.
 */
export function scheduleResetBlockReason(state: ScheduleResetState): string | null {
  if (state.hasPlayedMatches) {
    return 'Some matches have been played — the schedule cannot be reset. '
      + 'Reset those match results first if you really mean to discard them.';
  }
  if (state.hasAlliances || state.hasPlayoffMatches) {
    return 'Alliances or playoff matches already exist — reset those first';
  }
  return null;
}
