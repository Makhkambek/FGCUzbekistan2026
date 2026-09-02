export interface AllianceSlot {
  seed: number;
  captain: number;
  picks: number[];
}

export type SelectionState = AllianceSlot[];

/** Порядок выбора «змейкой»: 1→2→3, затем 3→2→1. */
export const PICK_ORDER: number[] = [0, 1, 2, 2, 1, 0];

export function initialSelection(rankedTeamIds: number[]): SelectionState {
  if (rankedTeamIds.length < 9) {
    throw new Error('Для трёх альянсов по три команды нужно минимум 9 команд');
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
  if (pickerIndex === null) throw new Error('Выбор альянсов уже завершён');

  if (!rankedTeamIds.includes(pickedTeamId)) {
    throw new Error('Команда не найдена в рейтинге');
  }

  const taken = assignedTeams(state);
  const pickedIsCaptainOf = state.findIndex((a) => a.captain === pickedTeamId);

  // Занятую команду выбрать нельзя. Исключение — капитан НИЖЕСТОЯЩЕГО альянса:
  // он уходит к вышестоящему, а его капитанство переходит вниз по рейтингу.
  const isLowerCaptain = pickedIsCaptainOf > pickerIndex;
  if (taken.has(pickedTeamId) && !isLowerCaptain) {
    throw new Error('Эта команда уже в альянсе');
  }

  const next: SelectionState = state.map((a) => ({ ...a, picks: [...a.picks] }));
  next[pickerIndex].picks.push(pickedTeamId);

  if (isLowerCaptain) {
    const busy = assignedTeams(next);
    const promoted = rankedTeamIds.find((id) => !busy.has(id));
    if (promoted === undefined) throw new Error('Нет свободных команд для нового капитана');
    next[pickedIsCaptainOf].captain = promoted;
  }

  return next;
}
