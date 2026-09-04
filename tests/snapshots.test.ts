import { describe, it, expect } from 'vitest';
import { restoreBlockReason } from '@/lib/snapshots';

describe('restoreBlockReason', () => {
  it('есть копия, текущие матчи не сыграны — откат разрешён', () => {
    expect(restoreBlockReason({ snapshotExists: true, currentPlayed: 0 })).toBeNull();
  });

  it('копии нет — откатывать нечего', () => {
    expect(restoreBlockReason({ snapshotExists: false, currentPlayed: 0 }))
      .toMatch(/nothing to restore/i);
  });

  // Откат затирает то, что сейчас в фазе. Если после сброса уже успели занести
  // результаты, они исчезнут — а это ровно та потеря, от которой копия и защищает.
  it('после сброса уже занесли результаты — откат запрещён', () => {
    const reason = restoreBlockReason({ snapshotExists: true, currentPlayed: 3 });
    expect(reason).toContain('3');
    expect(reason).toMatch(/scored since/i);
  });

  it('один занесённый результат — единственное число', () => {
    expect(restoreBlockReason({ snapshotExists: true, currentPlayed: 1 }))
      .toMatch(/1 match /);
  });
});
