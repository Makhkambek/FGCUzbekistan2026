export type PickSlot = number | null;

export interface AllianceSlot {
  seed: number;
  captain: number;
  /**
   * One pick, not two: from 4 September 2026 an alliance is a captain and one
   * team, and the playoff is two robots a side. Still an array, because every
   * screen that draws the draft walks it.
   */
  picks: [PickSlot];
}

export type SelectionState = AllianceSlot[];

export const MIN_TEAMS = 6;

/**
 * Thrown when there are not enough teams to seat three alliances. A distinct
 * class, because the API has to tell this apart from a database failure: it
 * used to sniff the message text, so a lock timeout during the draft was
 * reported to the referee as "not enough teams".
 */
export class NotEnoughTeamsError extends Error {
  constructor(readonly available: number) {
    super(`Three alliances of two teams need at least ${MIN_TEAMS} teams`);
    this.name = 'NotEnoughTeamsError';
  }
}

export function initialSelection(rankedTeamIds: number[]): SelectionState {
  if (rankedTeamIds.length < MIN_TEAMS) {
    throw new NotEnoughTeamsError(rankedTeamIds.length);
  }
  return rankedTeamIds.slice(0, 3).map((captain, i) => ({ seed: i + 1, captain, picks: [null] }));
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
 * The alliance whose captain `teamId` is, if `allianceSeed` is allowed to take
 * that captain as its pick — a lower-seeded alliance that has not picked yet.
 * Null when the team is not a poachable captain.
 */
function poachableAlliance(state: SelectionState, allianceSeed: number, teamId: number): AllianceSlot | null {
  const owner = state.find((a) => a.captain === teamId);
  if (!owner || owner.seed <= allianceSeed) return null;
  if (owner.picks.some((p) => p !== null)) return null;
  return owner;
}

/** The best-ranked team seated nowhere, or null when everyone is taken. */
function nextFreeTeam(state: SelectionState, rankedTeamIds: number[]): number | null {
  const taken = assignedTeams(state);
  return rankedTeamIds.find((id) => !taken.has(id)) ?? null;
}

/**
 * True if `teamId` may be placed into `allianceSeed`'s picks right now.
 *
 * A free team always may. So may the captain of a lower-seeded alliance — the
 * FIRST rule, back since 6 September 2026: it was taken out two days earlier
 * to keep the ceremony simple, and at the real draft the second alliance
 * could not take the third captain, which is exactly the move the rule
 * exists for. Poaching is refused once that alliance has picked (the pick
 * would be orphaned), and — when the ranking is given — when no free team
 * is left to captain the alliance it leaves behind.
 *
 * There is no turn order: any alliance may be filled in any order.
 */
export function isPickable(
  state: SelectionState, allianceSeed: number, teamId: number, rankedTeamIds?: number[],
): boolean {
  if (!assignedTeams(state).has(teamId)) return true;
  if (!poachableAlliance(state, allianceSeed, teamId)) return false;
  return rankedTeamIds === undefined || nextFreeTeam(state, rankedTeamIds) !== null;
}

/**
 * Sets one pick slot of one alliance to `teamId`, in any order relative to
 * every other slot — including re-setting an already-filled slot to a
 * different team, or back to what it already held (a no-op in that case).
 *
 * When `teamId` captains a lower-seeded alliance, that alliance dissolves:
 * every alliance below it moves up a seed, and the best-ranked free team
 * captains the last seed with an empty pick. See isPickable for what is
 * refused.
 */
export function setPick(
  state: SelectionState, rankedTeamIds: number[],
  allianceSeed: number, slotIndex: 0, teamId: number,
): SelectionState {
  const alliance = state.find((a) => a.seed === allianceSeed);
  if (!alliance) throw new Error('No such alliance');
  if (slotIndex !== 0) throw new Error('An alliance has one pick slot');
  if (!rankedTeamIds.includes(teamId)) throw new Error('Team is not in the ranking');
  if (teamId === alliance.captain) throw new Error('This team is already the captain of this alliance');

  // Check availability as if this slot were empty first, so re-selecting
  // whatever already sits there — or swapping it for a different team — is
  // never blocked by that slot's own current occupant.
  const asIfEmpty = clearPick(state, allianceSeed, slotIndex);
  const owner = asIfEmpty.find((a) => a.captain === teamId);
  if (owner && owner.seed > allianceSeed && owner.picks.some((p) => p !== null)) {
    throw new Error(
      `Alliance ${owner.seed} has already picked — clear its pick before taking its captain`);
  }
  if (!isPickable(asIfEmpty, allianceSeed, teamId)) {
    throw new Error('This team is already in an alliance');
  }

  let next: SelectionState = asIfEmpty.map((a) => ({ ...a, picks: [...a.picks] as [PickSlot] }));
  next.find((a) => a.seed === allianceSeed)!.picks[slotIndex] = teamId;

  if (owner) {
    // The poached captain's alliance is gone; those below it move up, and
    // the best free team takes the seat at the bottom.
    const remaining = next.filter((a) => a.seed !== owner.seed);
    const replacement = nextFreeTeam(remaining, rankedTeamIds);
    if (replacement === null) {
      throw new Error(`No team left to captain alliance ${state.length}`);
    }
    next = [
      ...remaining.map((a, i) => ({ ...a, seed: i + 1 })),
      { seed: state.length, captain: replacement, picks: [null] as [PickSlot] },
    ];
  }

  return next;
}

/** Empties one pick slot; the team returns to the pool for every alliance. */
export function clearPick(state: SelectionState, allianceSeed: number, slotIndex: 0): SelectionState {
  const alliance = state.find((a) => a.seed === allianceSeed);
  if (!alliance) throw new Error('No such alliance');
  const next: SelectionState = state.map((a) => ({ ...a, picks: [...a.picks] as [PickSlot] }));
  next.find((a) => a.seed === allianceSeed)!.picks[slotIndex] = null;
  return next;
}
