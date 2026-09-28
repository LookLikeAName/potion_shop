import { describe, expect, it } from 'vitest';
import SCRIPT_JSON from '../src/game/config/script.json';
import { SCENES } from '../src/game/config/story';
import { SOURCE, tl } from '../src/i18n';
import { bubbleVoiceId } from '../src/audio/voice';
import { LOOPS, SFX, SFX_TOGGLES, setSfxOn, sfxOff } from '../src/audio/sfx';

describe('語音的台詞 ID', () => {
  it('泡泡台詞：<key>.<第幾句，兩位數>（語音工具用同樣的規則）', () => {
    expect(bubbleVoiceId(tl('mutter.global')[0])).toBe('mutter.global.01');
    expect(bubbleVoiceId(tl('wish.lines.new')[1])).toBe('wish.lines.new.02');
    expect(bubbleVoiceId(tl('lines.headpat')[0])).toBe('lines.headpat.01');
    expect(bubbleVoiceId('沒有這句話')).toBeNull();
  });

  it('每一組泡泡台詞的每一句都有 ID', () => {
    const keys = Object.keys(SOURCE).filter((k) => SCRIPT_JSON.bubbles.prefixes.some((p) => k.startsWith(p)) && Array.isArray(SOURCE[k]));
    expect(keys.length).toBeGreaterThan(10);
    for (const k of keys) tl(k).forEach((text) => expect(bubbleVoiceId(text)).not.toBeNull());
  });

  it('劇本的說話順序只有一份（script.json），遊戲與語音工具讀同一個檔', () => {
    for (const [id, s] of Object.entries(SCRIPT_JSON.scenes)) {
      const scene = SCENES[id as keyof typeof SCENES];
      expect(scene.lines.map((l) => [l.who, l.id.split('.')[1]])).toEqual(s.lines);
    }
    // 配音的說話者都是劇本裡有的；旁白不配音
    expect(SCRIPT_JSON.voiced).toEqual(['lumia', 'book']);
  });
});

describe('個別音效開關', () => {
  it('每個音效、循環音剛好屬於一項開關；每項都有文字', () => {
    const all = [...Object.keys(SFX), ...Object.keys(LOOPS)].sort();
    const covered = SFX_TOGGLES.flatMap((g) => g.sounds).sort();
    expect(covered).toEqual(all);
    for (const g of SFX_TOGGLES) expect(SOURCE[`settings.sfx.${g.key}`]).toBeTruthy();
  });

  it('關掉之後記在這台裝置，打開就移除', () => {
    setSfxOn('sale', false);
    expect(sfxOff.value).toContain('sale');
    setSfxOn('sale', false);
    expect(sfxOff.value.filter((k) => k === 'sale')).toHaveLength(1);
    setSfxOn('sale', true);
    expect(sfxOff.value).not.toContain('sale');
  });
});

describe('音效設定', () => {
  it('每個音效、循環音都有合成的版本，播放限制合理', () => {
    for (const d of Object.values(SFX)) {
      expect(typeof d.synth).toBe('function');
      expect(d.dur).toBeGreaterThan(0);
      expect(d.maxVoices).toBeGreaterThanOrEqual(1);
    }
    for (const d of Object.values(LOOPS)) expect(d.dur).toBeGreaterThan(1);
    // 生長與熬煮：同一個來源有最短間隔（很快時不會每一次都響）
    expect(SFX.harvest.keyGap).toBeGreaterThan(0);
    expect(SFX.brew.keyGap).toBeGreaterThan(0);
  });
});
