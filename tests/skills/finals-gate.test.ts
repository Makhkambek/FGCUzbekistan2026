import { describe, it, expect } from 'vitest';
import { finalsAreOver } from '@/lib/alliances/playoff';

const q = (played: boolean) => ({ phase: 'qualification' as const, played });
const p = (played: boolean) => ({ phase: 'playoff' as const, played });

describe('when the finals are over', () => {
  it('is not over while the bracket has a match left', () => {
    expect(finalsAreOver([p(true), p(true), p(false)])).toBe(false);
  });

  it('is over once every playoff match has been played', () => {
    expect(finalsAreOver([q(true), p(true), p(true), p(true)])).toBe(true);
  });

  it('is not over before the bracket exists at all', () => {
    // No playoff matches yet: the event is still in qualification, and an
    // empty bracket must not read as a finished one.
    expect(finalsAreOver([q(true), q(true)])).toBe(false);
  });

  it('is not over on an empty schedule', () => {
    expect(finalsAreOver([])).toBe(false);
  });

  it('ignores qualification matches that are still to be played', () => {
    // A qualification match left unscored by mistake cannot hold the skills
    // award back once the finals themselves are done.
    expect(finalsAreOver([q(false), p(true)])).toBe(true);
  });
});
