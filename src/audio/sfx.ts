// 音效：每個音效有 ID。src/assets/audio/sfx/<ID>.mp3（或 .ogg／.wav）存在就用檔案，
// 沒有就在瀏覽器裡合成（OfflineAudioContext 先畫成聲音，之後和檔案一樣播放）。和美術的佔位圖同一套作法。
//
// 生長、熬煮越來越快也不會變成噪音：
// - 一般速度：每次收成／熬好響一下，同一個來源有最短間隔、全部同時最多幾個，音高每次隨機一點點；
// - 高速模式（scene 的 FastTier ≥ 1）：不再一下一下響，改成一段輕柔的循環環境音（setLoop），越快只稍微大聲一點。
import { signal } from '@preact/signals';
import { audible, audioContext, busNode } from './engine';

export type SfxId =
  | 'harvest' | 'brew' | 'tapPot' | 'tapCauldron' | 'boil' | 'sale'
  | 'notify' | 'achievement' | 'event' | 'wish';
export type LoopId = 'ambGreenhouse' | 'ambCauldron' | 'boilLoop';

type Synth = (c: OfflineAudioContext) => void;

interface SfxDef {
  /** 合成版的長度（秒） */
  dur: number;
  synth: Synth;
  /** 同一個 ID 兩次之間最短間隔（秒） */
  minGap: number;
  /** 同一個來源（key）兩次之間最短間隔（秒） */
  keyGap?: number;
  /** 同時最多幾個在響 */
  maxVoices: number;
  /** 音高隨機 ±（比例） */
  jitter: number;
  gain: number;
}

interface LoopDef {
  dur: number;
  synth: Synth;
  /** level = 1 時的音量 */
  gain: number;
}

// ---------- 合成的小工具 ----------

interface ToneOpts {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  t?: number;
  dur: number;
  peak: number;
  attack?: number;
}

function tone(c: OfflineAudioContext, o: ToneOpts): void {
  const { type = 'sine', f0, f1 = f0, t = 0, dur, peak, attack = 0.004 } = o;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

interface NoiseOpts {
  t?: number;
  dur: number;
  peak: number;
  filter?: BiquadFilterType;
  f0: number;
  f1?: number;
  q?: number;
  attack?: number;
  /** false = 音量固定（循環音的底噪），不做衰減 */
  decay?: boolean;
}

function noise(c: OfflineAudioContext, o: NoiseOpts): void {
  const { t = 0, dur, peak, filter = 'bandpass', f0, f1 = f0, q = 1, attack = 0.004, decay = true } = o;
  const len = Math.ceil((dur + 0.05) * c.sampleRate);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  if (decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  } else {
    g.gain.setValueAtTime(peak, t);
  }
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// ---------- 音效 ----------

export const SFX: Record<SfxId, SfxDef> = {
  // 收成：葉子輕輕「啵」一聲往上彈
  harvest: {
    dur: 0.2, minGap: 0.06, keyGap: 0.3, maxVoices: 4, jitter: 0.08, gain: 0.7,
    synth: (c) => {
      tone(c, { f0: 520, f1: 1040, dur: 0.12, peak: 0.35 });
      tone(c, { f0: 1560, t: 0.02, dur: 0.08, peak: 0.1 });
      noise(c, { f0: 3200, q: 0.8, dur: 0.06, peak: 0.12 });
    },
  },
  // 熬好：鍋裡冒出兩顆泡泡「咕嘟」
  brew: {
    dur: 0.2, minGap: 0.06, keyGap: 0.3, maxVoices: 4, jitter: 0.08, gain: 0.7,
    synth: (c) => {
      tone(c, { f0: 180, f1: 520, dur: 0.11, peak: 0.45, attack: 0.003 });
      tone(c, { f0: 240, f1: 640, t: 0.07, dur: 0.09, peak: 0.28, attack: 0.003 });
    },
  },
  // 點盆栽：輕輕的木頭與葉子聲
  tapPot: {
    dur: 0.1, minGap: 0.03, maxVoices: 3, jitter: 0.1, gain: 0.55,
    synth: (c) => {
      tone(c, { type: 'triangle', f0: 380, f1: 300, dur: 0.07, peak: 0.35 });
      noise(c, { f0: 2600, q: 1.2, dur: 0.035, peak: 0.18 });
    },
  },
  // 點大釜：金屬鍋「咚」一聲加上一顆小泡泡
  tapCauldron: {
    dur: 0.3, minGap: 0.03, maxVoices: 3, jitter: 0.06, gain: 0.55,
    synth: (c) => {
      tone(c, { f0: 220, dur: 0.25, peak: 0.3 });
      tone(c, { f0: 560, dur: 0.18, peak: 0.08 });
      tone(c, { f0: 180, f1: 420, t: 0.03, dur: 0.08, peak: 0.16, attack: 0.003 });
    },
  },
  // 極速沸騰：火焰往上竄的「呼」＋低沉的轟聲與嘶嘶聲
  boil: {
    dur: 0.8, minGap: 0.2, maxVoices: 2, jitter: 0.03, gain: 0.7,
    synth: (c) => {
      noise(c, { f0: 400, f1: 2400, q: 0.7, dur: 0.6, peak: 0.35, attack: 0.08 });
      tone(c, { f0: 90, f1: 70, dur: 0.7, peak: 0.25, attack: 0.05 });
      noise(c, { filter: 'highpass', f0: 5000, t: 0.2, dur: 0.5, peak: 0.08 });
    },
  },
  // 結帳成功：收銀機「喀－鏘」：機械的喀噠聲、清脆的鈴，加上一點零錢聲。
  // 後期客人很多時一秒會成交好幾次：最少隔 0.12 秒、同時最多 3 個，不會糊成一片
  sale: {
    dur: 0.9, minGap: 0.12, maxVoices: 3, jitter: 0.03, gain: 0.5,
    synth: (c) => {
      // 抽屜彈開的喀噠
      noise(c, { filter: 'bandpass', f0: 1800, q: 2, dur: 0.03, peak: 0.35, attack: 0.001 });
      noise(c, { filter: 'bandpass', f0: 900, q: 1.5, t: 0.04, dur: 0.05, peak: 0.25, attack: 0.001 });
      // 鈴：基音與不和諧的泛音一起，慢慢消失
      tone(c, { f0: 2637, t: 0.06, dur: 0.8, peak: 0.2, attack: 0.002 });
      tone(c, { f0: 3951, t: 0.06, dur: 0.55, peak: 0.1, attack: 0.002 });
      tone(c, { f0: 5274, t: 0.06, dur: 0.3, peak: 0.05, attack: 0.002 });
      // 零錢碰撞
      for (let k = 0; k < 3; k++) {
        tone(c, { f0: rand(3200, 4200), t: 0.1 + k * 0.05 + Math.random() * 0.02, dur: 0.07, peak: 0.06, attack: 0.001 });
      }
    },
  },
  // 一般通知：兩個音的小鈴聲
  notify: {
    dur: 0.7, minGap: 0.25, maxVoices: 2, jitter: 0, gain: 0.55,
    synth: (c) => {
      tone(c, { f0: 1318.5, dur: 0.5, peak: 0.22 });
      tone(c, { f0: 1975.5, t: 0.09, dur: 0.6, peak: 0.18 });
    },
  },
  // 成就：往上的琶音
  achievement: {
    dur: 0.8, minGap: 0.3, maxVoices: 2, jitter: 0, gain: 0.55,
    synth: (c) => {
      [1046.5, 1318.5, 1568, 2093].forEach((f, k) => {
        tone(c, { f0: f, t: k * 0.07, dur: 0.45, peak: 0.16 });
        tone(c, { type: 'triangle', f0: f / 2, t: k * 0.07, dur: 0.3, peak: 0.05 });
      });
    },
  },
  // 突發事件出現：一道閃光往上滑，接著兩聲清脆的鈴
  event: {
    dur: 0.8, minGap: 0.5, maxVoices: 1, jitter: 0, gain: 0.55,
    synth: (c) => {
      tone(c, { f0: 1200, f1: 2400, dur: 0.25, peak: 0.12 });
      tone(c, { f0: 1760, t: 0.18, dur: 0.5, peak: 0.18 });
      tone(c, { f0: 2637, t: 0.26, dur: 0.5, peak: 0.12 });
    },
  },
  // 小心願：柔和的兩個音
  wish: {
    dur: 0.6, minGap: 0.5, maxVoices: 1, jitter: 0, gain: 0.55,
    synth: (c) => {
      tone(c, { type: 'triangle', f0: 784, dur: 0.4, peak: 0.22 });
      tone(c, { type: 'triangle', f0: 1175, t: 0.1, dur: 0.45, peak: 0.2 });
    },
  },
};

// ---------- 循環音 ----------

export const LOOPS: Record<LoopId, LoopDef> = {
  // 溫室的高速模式：葉子沙沙聲，慢慢起伏（4 秒剛好兩個起伏，接得起來）
  ambGreenhouse: {
    dur: 4, gain: 0.35,
    synth: (c) => {
      const len = Math.ceil(4 * c.sampleRate);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin((i / len) * Math.PI * 4));
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1800;
      f.Q.value = 0.6;
      const g = c.createGain();
      g.gain.value = 0.12;
      src.connect(f).connect(g).connect(c.destination);
      src.start(0);
      // 偶爾一聲很輕的「啵」
      for (let k = 0; k < 6; k++) tone(c, { f0: rand(500, 700), f1: rand(900, 1200), t: rand(0.1, 3.6), dur: 0.1, peak: 0.06 });
    },
  },
  // 大釜的高速模式：一直咕嘟咕嘟冒泡，加上小火的底噪
  ambCauldron: {
    dur: 4, gain: 0.4,
    synth: (c) => {
      noise(c, { filter: 'lowpass', f0: 300, dur: 4, peak: 0.05, decay: false });
      for (let k = 0; k < 22; k++) {
        const f0 = rand(150, 260);
        tone(c, { f0, f1: f0 * rand(2.2, 2.8), t: rand(0, 3.8), dur: rand(0.08, 0.14), peak: rand(0.12, 0.28), attack: 0.003 });
      }
    },
  },
  // 極速沸騰中：劈啪的火焰聲
  boilLoop: {
    dur: 3, gain: 0.45,
    synth: (c) => {
      noise(c, { filter: 'lowpass', f0: 900, dur: 3, peak: 0.08, decay: false });
      for (let k = 0; k < 40; k++) {
        noise(c, { filter: 'highpass', f0: 3000, t: rand(0, 2.95), dur: rand(0.01, 0.025), peak: rand(0.1, 0.3), attack: 0.001 });
      }
    },
  },
};

// ---------- 個別開關（設定頁「個別音效」；存在這台裝置） ----------

/** 玩家看到的每一項（同類的聲音合成一項），文字在語言檔 settings.sfx.<key> */
export const SFX_TOGGLES: { key: string; sounds: (SfxId | LoopId)[]; preview?: SfxId }[] = [
  { key: 'harvest', sounds: ['harvest'], preview: 'harvest' },
  { key: 'brew', sounds: ['brew'], preview: 'brew' },
  { key: 'tapPot', sounds: ['tapPot'], preview: 'tapPot' },
  { key: 'tapCauldron', sounds: ['tapCauldron'], preview: 'tapCauldron' },
  { key: 'boil', sounds: ['boil', 'boilLoop'], preview: 'boil' },
  { key: 'sale', sounds: ['sale'], preview: 'sale' },
  { key: 'ambient', sounds: ['ambGreenhouse', 'ambCauldron'] },
  { key: 'notify', sounds: ['notify'], preview: 'notify' },
  { key: 'achievement', sounds: ['achievement'], preview: 'achievement' },
  { key: 'event', sounds: ['event'], preview: 'event' },
  { key: 'wish', sounds: ['wish'], preview: 'wish' },
];

const OFF_KEY = 'idle-potion-shop/sfx-off';

function loadOff(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(OFF_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 關掉的項目（SFX_TOGGLES 的 key） */
export const sfxOff = signal<string[]>(loadOff());

export function setSfxOn(key: string, on: boolean): void {
  sfxOff.value = on ? sfxOff.value.filter((k) => k !== key) : [...new Set([...sfxOff.value, key])];
  try {
    localStorage.setItem(OFF_KEY, JSON.stringify(sfxOff.value));
  } catch {
    // 存不了：這次開著的期間照樣有效
  }
}

/** 這個聲音有沒有被玩家關掉 */
function isOff(id: SfxId | LoopId): boolean {
  const off = sfxOff.value;
  return off.length > 0 && SFX_TOGGLES.some((g) => off.includes(g.key) && g.sounds.includes(id));
}

// ---------- 載入：有檔案用檔案，沒有就合成 ----------

/** src/assets/audio/sfx/<ID>.<格式>：放了就取代合成的聲音 */
const FILES = import.meta.glob('../assets/audio/sfx/*.{mp3,ogg,wav}', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
const fileOf = (id: string) => Object.entries(FILES).find(([p]) => p.split('/').pop()!.replace(/\.\w+$/, '') === id)?.[1];

const buffers = new Map<string, AudioBuffer>();
let loading: Promise<void> | null = null;

async function render(dur: number, synth: Synth): Promise<AudioBuffer> {
  const sr = 44100;
  const c = new OfflineAudioContext(1, Math.ceil(dur * sr), sr);
  synth(c);
  return c.startRendering();
}

async function loadOne(ctx: AudioContext, id: string, dur: number, synth: Synth): Promise<void> {
  const url = fileOf(id);
  try {
    if (url) {
      const data = await (await fetch(url)).arrayBuffer();
      buffers.set(id, await ctx.decodeAudioData(data));
      return;
    }
  } catch {
    // 檔案讀不到：退回合成
  }
  buffers.set(id, await render(dur, synth));
}

/** 準備所有音效（第一次需要時才做；之後重複呼叫直接回傳） */
export function initSfx(): Promise<void> {
  if (loading) return loading;
  const ctx = audioContext();
  if (!ctx || typeof OfflineAudioContext === 'undefined') return (loading = Promise.resolve());
  loading = Promise.all([
    ...Object.entries(SFX).map(([id, d]) => loadOne(ctx, id, d.dur, d.synth)),
    ...Object.entries(LOOPS).map(([id, d]) => loadOne(ctx, id, d.dur, d.synth)),
  ]).then(() => undefined);
  return loading;
}

// ---------- 播放 ----------

const lastAt = new Map<string, number>();
const voices = new Map<SfxId, number>();

export interface PlayOpts {
  /** 來源（例如 pot:0、cauldron:glow），同一個來源有最短間隔 */
  key?: string;
  /** 額外的音高倍率 */
  rate?: number;
  /** 額外的音量倍率 */
  gain?: number;
}

export function playSfx(id: SfxId, opts: PlayOpts = {}): void {
  if (!audible('sfx') || isOff(id)) return;
  const ctx = audioContext();
  const bus = busNode('sfx');
  const buf = buffers.get(id);
  if (!ctx || !bus || ctx.state !== 'running' || !buf) return;
  const def = SFX[id];
  const now = ctx.currentTime;
  if (now - (lastAt.get(id) ?? -1) < def.minGap) return;
  if (opts.key && def.keyGap && now - (lastAt.get(`${id}:${opts.key}`) ?? -1) < def.keyGap) return;
  if ((voices.get(id) ?? 0) >= def.maxVoices) return;
  lastAt.set(id, now);
  if (opts.key) lastAt.set(`${id}:${opts.key}`, now);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * def.jitter);
  const g = ctx.createGain();
  g.gain.value = def.gain * (opts.gain ?? 1);
  src.connect(g).connect(bus);
  voices.set(id, (voices.get(id) ?? 0) + 1);
  src.onended = () => voices.set(id, Math.max(0, (voices.get(id) ?? 1) - 1));
  src.start();
}

const loops = new Map<LoopId, { src: AudioBufferSourceNode; gain: GainNode; level: number }>();

/** 循環音的大小：0 = 停（淡出），1 = 最大；每一幀呼叫也可以（只有改變時才動作） */
export function setLoop(id: LoopId, level: number): void {
  const ctx = audioContext();
  const bus = busNode('sfx');
  if (!ctx || !bus) return;
  // 分頁在背景時畫面不更新、沒辦法跟著調整：一律淡出
  const target = document.hidden || !audible('sfx') || isOff(id) ? 0 : Math.max(0, Math.min(1, level));
  let cur = loops.get(id);
  if (!cur) {
    const buf = buffers.get(id);
    if (target <= 0 || !buf || ctx.state !== 'running') return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(bus);
    src.start();
    cur = { src, gain, level: 0 };
    loops.set(id, cur);
  }
  if (Math.abs(target - cur.level) < 0.02) return;
  cur.level = target;
  cur.gain.gain.setTargetAtTime(target * LOOPS[id].gain, ctx.currentTime, 0.25);
  if (target <= 0) {
    const done = cur;
    loops.delete(id);
    done.src.stop(ctx.currentTime + 1.2);
  }
}

// 切到背景：循環音淡出（回來時畫面更新會再把它們叫起來）
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) for (const id of [...loops.keys()]) setLoop(id, 0);
  });
}
