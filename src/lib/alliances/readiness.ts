/**
 * Why alliances cannot be seated yet, or null when qualification is done.
 *
 * Alliance captains are the top three of the qualification ranking, so a draft
 * run while matches are still unplayed seats them on a ranking that is not
 * final — and that mistake is close to unrecoverable during an event: the
 * alliance rows cannot be removed, and a playoff bracket locks every pick
 * behind it. Both the draft and the bracket are gated on this.
 */
export function qualificationBlockReason(
  qualification: { total: number; played: number },
): string | null {
  if (qualification.total === 0) {
    return 'There is no qualification schedule yet — generate one and play it before seating alliances';
  }

  const remaining = qualification.total - qualification.played;
  if (remaining > 0) {
    return `${remaining} qualification match${remaining === 1 ? '' : 'es'} `
      + 'still to play — alliances are seated from the final ranking';
  }

  return null;
}
