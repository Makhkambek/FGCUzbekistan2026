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
 * True if `teamId` may be placed into `allianceSeed`'s picks right now: not
 * already assigned anywhere (as a captain or a pick), UNLESS it is the
 * captain of a LOWER-seeded alliance (a strictly higher seed number) — that
 * remains a legal poach, reported separately by `isPoach`.
 *
 * There is no turn order any more: any alliance may be filled in any order,
 * and any of its two pick slots may be set independently of the other.
 */
export function isPickable(state: SelectionState, allianceSeed: number, teamId: number): boolean {
  const taken = assignedTeams(state);
  const captainAlliance = state.find((a) => a.captain === teamId);
  const isLowerCaptain = captainAlliance !== undefined && captainAlliance.seed > allianceSeed;
  return !taken.has(teamId) || isLowerCaptain;
}

/** True if picking `teamId` into `allianceSeed` would poach a captain — the caller must get operator confirmation before calling `setPick` for this pair. */
export function isPoach(state: SelectionState, allianceSeed: number, teamId: number): boolean {
  const captainAlliance = state.find((a) => a.captain === teamId);
  return captainAlliance !== undefined && captainAlliance.seed > allianceSeed;
}

/**
 * Sets one pick slot of one alliance to `teamId`, in any order relative to
 * every other slot — including re-setting an already-filled slot to a
 * different team, or back to what it already held (a no-op in that case).
 *
 * Poaching a lower-seeded alliance's captain promotes the next available
 * team by ranking into the vacated captaincy, same rule as before — the
 * caller (the route) is expected to have already gotten operator
 * confirmation via `isPoach` before calling this for a poaching pick.
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
  const poach = isPoach(asIfEmpty, allianceSeed, teamId);

  const next: SelectionState = asIfEmpty.map((a) => ({ ...a, picks: [...a.picks] as [PickSlot, PickSlot] }));
  next.find((a) => a.seed === allianceSeed)!.picks[slotIndex] = teamId;

  if (poach) {
    const poachedAlliance = next.find((a) => a.captain === teamId)!;
    const busy = assignedTeams(next);
    const promoted = rankedTeamIds.find((id) => !busy.has(id));
    if (promoted === undefined) throw new Error('No available team is left to take over the captaincy');
    poachedAlliance.captain = promoted;
  }

  return next;
}

/**
 * Empties one pick slot. Does NOT undo a captaincy promotion that happened
 * because that slot held a poached captain — reversing a poach is a
 * separate, deliberate action the operator has to do by hand (or by using
 * the full "Reset alliance selection").
 */
export function clearPick(state: SelectionState, allianceSeed: number, slotIndex: 0 | 1): SelectionState {
  const alliance = state.find((a) => a.seed === allianceSeed);
  if (!alliance) throw new Error('No such alliance');
  const next: SelectionState = state.map((a) => ({ ...a, picks: [...a.picks] as [PickSlot, PickSlot] }));
  next.find((a) => a.seed === allianceSeed)!.picks[slotIndex] = null;
  return next;
}
