import { describe, expect, it } from 'vitest';
import { formatDuration } from '../src/game/format';
import { simulateOffline } from '../src/game/offline';
import { parseSave } from '../src/game/save';
import { tick, type SimContext } from '../src/game/sim';
import { createInitialState } from '../src/game/state';

const ctx = (extra: Partial<SimContext> = {}): SimContext => ({ rng: () => 0.5, offline: false, emit: () => {}, ...extra });

describe('遊玩時間', () => {
  it('遊戲開著的時間（前景、背景分開）與離開的時間（不受離線上限影響）', () => {
    const s = createInitialState();
    for (let k = 0; k < 100; k++) tick(s, 0.1, ctx());
    for (let k = 0; k < 50; k++) tick(s, 0.1, ctx({ foreground: false }));
    expect(s.stats.playOnline).toBeCloseTo(15);
    expect(s.stats.playForeground).toBeCloseTo(10);
    // 離開 30 小時：離線收益只算 12 小時，但遊玩時間記實際離開的 30 小時
    simulateOffline(s, 30 * 3600);
    expect(s.stats.playAway).toBe(30 * 3600);
    expect(s.stats.playOnline).toBeCloseTo(15);
  });

  it('舊存檔沒有紀錄：從 0 開始算', () => {
    const old = createInitialState() as unknown as { stats: Record<string, number> };
    delete old.stats.playOnline;
    delete old.stats.playForeground;
    delete old.stats.playAway;
    const save = parseSave(JSON.stringify({ version: 3, savedAt: 0, state: old }))!;
    expect(save.state.stats).toMatchObject({ playOnline: 0, playForeground: 0, playAway: 0 });
  });

  it('超過一天顯示天數', () => {
    expect(formatDuration(3 * 86400 + 5 * 3600 + 7 * 60)).toBe('3 天 5 小時 7 分');
    expect(formatDuration(5 * 3600 + 7 * 60)).toBe('5 小時 7 分');
  });
});
