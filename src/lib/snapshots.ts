/**
 * A snapshot is taken automatically before anything deletes or replaces
 * matches — a schedule reset, a regeneration over an existing schedule, or a
 * single result being cleared. It holds the phase's rows exactly as they were,
 * so restoring puts back the same matches with the same ids and the same
 * scores, not an equivalent-looking schedule.
 */
export interface RestoreState {
  snapshotExists: boolean;
  /** Results entered in this phase since the snapshot was taken. */
  currentPlayed: number;
}

/**
 * Why the last snapshot cannot be restored right now, or null when it can.
 *
 * Restoring replaces everything currently in the phase. If results have been
 * entered since the snapshot, they would be the thing that gets lost — the
 * exact loss the snapshot exists to prevent — so that case is refused by
 * default. It is a warning, not a wall: the operator can still override it
 * deliberately, which is also how several resets in a row are walked back one
 * step at a time. Missing snapshot is a wall, since there is nothing to put
 * back.
 */
export function restoreBlockReason(state: RestoreState): string | null {
  if (!state.snapshotExists) {
    return 'Nothing to restore — no schedule has been reset or replaced yet';
  }

  if (state.currentPlayed > 0) {
    return `${state.currentPlayed} match${state.currentPlayed === 1 ? '' : 'es'} `
      + 'scored since the reset would be lost — clear those results first if you '
      + 'really mean to go back';
  }

  return null;
}
