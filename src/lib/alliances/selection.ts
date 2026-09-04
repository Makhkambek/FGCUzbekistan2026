export type PickSlot = number | null;

export interface AllianceSlot {
  seed: number;
  captain: number;
  picks: [PickSlot, PickSlot];
}

export type SelectionState = AllianceSlot[];

export const MIN_TEAMS = 9;

/**
 * Thrown when there are not enough teams to seat three alliances. A distinct
 * class, because the API has to tell this apart from a database failure: it
 * used to sniff the message text, so a lock timeout during the draft was
 * reported to the referee as "not enough teams".
 */
export class NotEnoughTeamsError extends Error {
  constructor(readonly available: number) {
    super(`Three alliances of three teams need at least ${MIN_TEAMS} teams`);
    this.name = 'NotEnoughTeamsError';
  }
}

export function initialSelection(rankedTeamIds: number[]): SelectionState {
  if (rankedTeamIds.length < MIN_TEAMS) {
    throw new NotEnoughTeamsError(rankedTeamIds.length);
  }
  return rankedTeamIds.slice(0, 3).map((captain, i) => ({ seed: i + 1, captain, picks: [null, null] }));
}

function assignedTeams(state: SelectionState): Set<number> {
  const taken = new Set<number>();
  for (const a of state) {
    taken.add(a.captain);
    for (const p of a.picks) if (p !== null) taken.add(p);
  }
  return taken;
}

/**
 * True if `teamId` may be placed into `allianceSeed`'s picks right now: only a
 * team that is not already in an alliance at all, as a captain or as a pick.
 *
 * Captains are off the board. FIRST allows a higher-seeded alliance to poach a
 * lower-seeded captain, and this used to implement it — but at this event the
 * draft is run by one operator in front of the hall, and a pick that dissolves
 * another alliance mid-ceremony is a way to confuse everyone at once for no
 * gain across three alliances. The decision is Makhkambek's, 4 September 2026.
 *
 * There is no turn order: any alliance may be filled in any order, and either
 * of its two pick slots may be set independently of the other.
 */
export function isPickable(state: SelectionState, allianceSeed: number, teamId: number): boolean {
  return !assignedTeams(state).has(teamId);
}

/**
 * Sets one pick slot of one alliance to `teamId`, in any order relative to
 * every other slot — including re-setting an already-filled slot to a
 * different team, or back to what it already held (a no-op in that case).
 *
 * A team already seated anywhere, captain or pick, is refused: see isPickable.
 */
export function setPick(
  state: SelectionState, rankedTeamIds: number[],
  allianceSeed: number, slotIndex: 0 | 1, teamId: number,
): SelectionState {
  const alliance = state.find((a) => a.seed === allianceSeed);
  if (!alliance) throw new Error('No such alliance');
  if (!rankedTeamIds.includes(teamId)) throw new Error('Team is not in the ranking');
  if (teamId === alliance.captain) throw new Error('This team is already the captain of this alliance');

  // Check availability as if this slot were empty first, so re-selecting
  // whatever already sits there — or swapping it for a different team — is
  // never blocked by that slot's own current occupant.
  const asIfEmpty = clearPick(state, allianceSeed, slotIndex);
  if (!isPickable(asIfEmpty, allianceSeed, teamId)) {
    throw new Error('This team is already in an alliance');
  }

  const next: SelectionState = asIfEmpty.map((a) => ({ ...a, picks: [...a.picks] as [PickSlot, PickSlot] }));
  next.find((a) => a.seed === allianceSeed)!.picks[slotIndex] = teamId;
  return next;
}

/** Empties one pick slot; the team returns to the pool for every alliance. */
export function clearPick(state: SelectionState, allianceSeed: number, slotIndex: 0 | 1): SelectionState {
  const alliance = state.find((a) => a.seed === allianceSeed);
  if (!alliance) throw new Error('No such alliance');
  const next: SelectionState = state.map((a) => ({ ...a, picks: [...a.picks] as [PickSlot, PickSlot] }));
  next.find((a) => a.seed === allianceSeed)!.picks[slotIndex] = null;
  return next;
}
