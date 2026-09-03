export interface AllianceSlot {
  seed: number;
  captain: number;
  picks: number[];
}

export type SelectionState = AllianceSlot[];

/** Serpentine pick order: 1→2→3, then 3→2→1. */
export const PICK_ORDER: number[] = [0, 1, 2, 2, 1, 0];

export function initialSelection(rankedTeamIds: number[]): SelectionState {
  if (rankedTeamIds.length < 9) {
    throw new Error('Three alliances of three teams need at least 9 teams');
  }
  return rankedTeamIds.slice(0, 3).map((captain, i) => ({ seed: i + 1, captain, picks: [] }));
}

function assignedTeams(state: SelectionState): Set<number> {
  const taken = new Set<number>();
  for (const a of state) {
    taken.add(a.captain);
    for (const p of a.picks) taken.add(p);
  }
  return taken;
}

export function nextPicker(state: SelectionState): number | null {
  const made = state.reduce((acc, a) => acc + a.picks.length, 0);
  return made < PICK_ORDER.length ? PICK_ORDER[made] : null;
}

/**
 * True if `teamId` may legally be picked next by the alliance at
 * `pickerIndex` (0-based, same indexing as `nextPicker`'s return value).
 *
 * This mirrors — rather than reimplements — the exact acceptance rule
 * enforced inside `applyPick`: a team is pickable if it is not already taken
 * (captain or pick of any alliance), UNLESS it is the captain of a
 * LOWER-ranked alliance, which is always pickable (that captain moves up and
 * their vacated captaincy passes to the next free team by ranking).
 */
export function isPickable(state: SelectionState, pickerIndex: number, teamId: number): boolean {
  const taken = assignedTeams(state);
  const captainOfSeedIndex = state.findIndex((a) => a.captain === teamId);
  const isLowerCaptain = captainOfSeedIndex > pickerIndex;
  return !taken.has(teamId) || isLowerCaptain;
}

export function applyPick(
  state: SelectionState, rankedTeamIds: number[], pickedTeamId: number,
): SelectionState {
  const pickerIndex = nextPicker(state);
  if (pickerIndex === null) throw new Error('Alliance selection is already complete');

  if (!rankedTeamIds.includes(pickedTeamId)) {
    throw new Error('Team is not in the ranking');
  }

  const taken = assignedTeams(state);
  const pickedIsCaptainOf = state.findIndex((a) => a.captain === pickedTeamId);

  // A team already taken cannot be picked. The exception is the captain of a
  // LOWER-seeded alliance: they move up, and the captaincy passes down the ranking.
  const isLowerCaptain = pickedIsCaptainOf > pickerIndex;
  if (taken.has(pickedTeamId) && !isLowerCaptain) {
    throw new Error('This team is already in an alliance');
  }

  const next: SelectionState = state.map((a) => ({ ...a, picks: [...a.picks] }));
  next[pickerIndex].picks.push(pickedTeamId);

  if (isLowerCaptain) {
    const busy = assignedTeams(next);
    const promoted = rankedTeamIds.find((id) => !busy.has(id));
    if (promoted === undefined) throw new Error('No available team is left to take over the captaincy');
    next[pickedIsCaptainOf].captain = promoted;
  }

  return next;
}
