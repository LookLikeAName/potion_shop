// 聲音系統的核心：一個 AudioContext、三條音量線（音效、配樂、語音），後面接一個總音量。
// 音量與靜音存在這台裝置的瀏覽器（不跟著存檔走），設定頁可以分別調整。
// 瀏覽器規定要使用者操作之後才能出聲：第一次點擊／按鍵時 unlockAudio() 喚醒。
import { effect, signal } from '@preact/signals';

export type Bus = 'sfx' | 'music' | 'voice';
export const BUSES: Bus[] = ['sfx', 'music', 'voice'];
/** 設定頁的每一列：總音量 + 三條音量線 */
export type Channel = 'master' | Bus;
export const CHANNELS: Channel[] = ['master', ...BUSES];

export interface BusSetting {
  /** 0～1 */
  volume: number;
  muted: boolean;
}
export type AudioSettings = Record<Channel, BusSetting>;

const KEY = 'idle-potion-shop/audio';
const DEFAULTS: AudioSettings = {
  master: { volume: 0.8, muted: false },
  sfx: { volume: 0.7, muted: false },
  music: { volume: 0.5, muted: false },
  voice: { volume: 0.8, muted: false },
};

function load(): AudioSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<AudioSettings>;
    return Object.fromEntries(CHANNELS.map((c) => [c, { ...DEFAULTS[c], ...raw[c] }])) as AudioSettings;
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const audioSettings = signal<AudioSettings>(load());

export function setBus(bus: Channel, patch: Partial<BusSetting>): void {
  audioSettings.value = { ...audioSettings.value, [bus]: { ...audioSettings.value[bus], ...patch } };
  try {
    localStorage.setItem(KEY, JSON.stringify(audioSettings.value));
  } catch {
    // 存不了：這次開著的期間照樣有效
  }
}

/** 這條線現在聽不聽得到（它或總音量靜音、音量 0 時，不必合成、播放） */
export function audible(bus: Bus): boolean {
  const on = (b: BusSetting) => !b.muted && b.volume > 0;
  return on(audioSettings.value[bus]) && on(audioSettings.value.master);
}

let ctx: AudioContext | null = null;
const buses = {} as Record<Channel, GainNode>;

/** 音量的曲線：人耳對音量是對數感受，滑桿用平方比較自然 */
const gainOf = (b: BusSetting) => (b.muted ? 0 : b.volume * b.volume);

/** 建立 AudioContext 與三條音量線（瀏覽器不支援時回傳 null，遊戲照常沒有聲音） */
export function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  // 音效／配樂／語音 → 總音量 → 喇叭
  buses.master = ctx.createGain();
  buses.master.connect(ctx.destination);
  for (const bus of BUSES) {
    const g = ctx.createGain();
    g.connect(buses.master);
    buses[bus] = g;
  }
  // 音量改了：短短地滑過去（直接跳會有爆音）
  effect(() => {
    const st = audioSettings.value;
    const now = ctx!.currentTime;
    for (const c of CHANNELS) buses[c].gain.setTargetAtTime(gainOf(st[c]), now, 0.03);
  });
  return ctx;
}

/** 某條音量線的輸入端 */
export function busNode(bus: Bus): GainNode | null {
  return audioContext() ? buses[bus] : null;
}

const unlockHandlers: (() => void)[] = [];
let unlocked = false;

/** 聲音喚醒之後要做的事（例如開始播配樂）；已經喚醒就馬上做 */
export function onAudioUnlock(fn: () => void): void {
  if (unlocked) fn();
  else unlockHandlers.push(fn);
}

/** 使用者第一次操作後喚醒聲音（之後的操作呼叫也沒關係） */
export function unlockAudio(): void {
  const c = audioContext();
  if (c && c.state === 'suspended') void c.resume();
  if (!unlocked && c) {
    unlocked = true;
    for (const fn of unlockHandlers.splice(0)) fn();
  }
}

/** 在整個頁面上掛好「第一次操作就喚醒聲音」 */
export function installAudioUnlock(): void {
  const once = () => unlockAudio();
  for (const type of ['pointerdown', 'keydown', 'touchend'] as const) {
    window.addEventListener(type, once, { capture: true, passive: true });
  }
}
