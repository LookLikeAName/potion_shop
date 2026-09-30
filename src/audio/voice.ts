// 語音：劇情台詞與露米婭頭上泡泡的台詞。所有語言共用一套配音（字幕跟著遊戲語言）。
// 檔案由語音工具（tools/voice）產生到 public/voice/，清單在 public/voice/manifest.json：
//   { "files": { "<台詞 ID>": "<檔名>" } }
// 只播清單裡有的，沒有配音的句子就安靜（不會一句一句去試找檔案）。
import { BUBBLE_PREFIXES } from '../game/config/story';
import { SOURCE, tl } from '../i18n';
import { audible, audioContext, busNode } from './engine';

let manifest: Record<string, string> = {};
let loaded: Promise<void> | null = null;

/** 讀語音清單（沒有清單 = 還沒有配音） */
export function loadVoiceManifest(): Promise<void> {
  if (loaded) return loaded;
  loaded = fetch(`${import.meta.env.BASE_URL}voice/manifest.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : { files: {} }))
    .then((m: { files?: Record<string, string> }) => {
      manifest = m.files ?? {};
    })
    .catch(() => {
      manifest = {};
    });
  return loaded;
}

export const hasVoice = (id: string) => id in manifest;

/** 語音檔的網址（預先下載用；要先讀完清單）。給 scene 就只列那一段劇情的 */
export const voiceUrls = (scene?: string): string[] =>
  [...new Set(Object.entries(manifest).filter(([id]) => !scene || id.startsWith(`${scene}.`)).map(([, f]) => f))]
    .map((f) => `${import.meta.env.BASE_URL}voice/${f}`);

/** 一句語音怎麼結束的：播完／被別的語音或 stopVoice 打斷／播不出來 */
export type VoiceEnd = 'ended' | 'stopped' | 'failed';

let current: { el: HTMLAudioElement; node: MediaElementAudioSourceNode; onEnd?: (r: VoiceEnd) => void } | null = null;

function finish(reason: VoiceEnd): void {
  if (!current) return;
  const c = current;
  current = null;
  c.el.pause();
  c.node.disconnect();
  c.onEnd?.(reason);
}

export function stopVoice(): void {
  finish('stopped');
}

/**
 * 播一句（會先停掉正在播的）。onEnd 在這句結束時呼叫（播完、被打斷或播不出來）。
 * 回傳播放中的標記（沒有配音、聲音關掉或還沒解鎖 = null，這時不會呼叫 onEnd）
 */
export function playVoice(id: string, onEnd?: (r: VoiceEnd) => void): HTMLAudioElement | null {
  stopVoice();
  const file = manifest[id];
  const ctx = audioContext();
  const bus = busNode('voice');
  if (!file || !ctx || !bus || !audible('voice') || ctx.state !== 'running') return null;
  const el = new Audio(`${import.meta.env.BASE_URL}voice/${file}`);
  const node = ctx.createMediaElementSource(el);
  node.connect(bus);
  current = { el, node, onEnd };
  el.onended = () => {
    if (current?.el === el) finish('ended');
  };
  el.play().catch(() => {
    if (current?.el === el) finish('failed');
  });
  return el;
}

/**
 * 依序播一串語音（每句前面先停 pause 毫秒）。onStep(i) 在第 i 句開始時呼叫；全部播完、
 * 或被別的語音打斷時呼叫 onDone。回傳停止函式（呼叫它就不會再呼叫 onDone）
 */
export function playVoiceSequence(
  steps: { id: string; pause: number }[], onStep: (i: number) => void, onDone: () => void,
): () => void {
  let cancelled = false;
  let timer = 0;
  let mine: HTMLAudioElement | null = null;
  const next = (i: number): void => {
    if (cancelled) return;
    if (i >= steps.length) {
      onDone();
      return;
    }
    onStep(i);
    mine = playVoice(steps[i].id, (r) => {
      mine = null;
      if (cancelled) return;
      if (r === 'stopped') {
        // 被別的語音打斷：整串停下來
        cancelled = true;
        onDone();
        return;
      }
      timer = window.setTimeout(() => next(i + 1), steps[i + 1]?.pause ?? 0);
    });
    if (!mine) timer = window.setTimeout(() => next(i + 1), 0);
  };
  timer = window.setTimeout(() => next(0), steps[0]?.pause ?? 0);
  return () => {
    if (cancelled) return;
    cancelled = true;
    clearTimeout(timer);
    if (mine && current?.el === mine) stopVoice();
  };
}

// ---------- 老師的信：一段拆成好幾小句的配音 ----------

/** 同一段裡小句之間、段落之間的停頓（毫秒） */
const LETTER_PAUSE = { sentence: 250, paragraph: 700, start: 400 };
const LETTER_PART_ORDER: Record<string, number> = { to: 0, body: 1, closing: 2 };

/**
 * 第 n 封信有配音的小句，依朗讀順序：{id, para, pause}。
 * para = 屬於哪一段：'to'、'body.01'、'closing.01'（語音工具的 ID：letter.<n>.<部分>.<第幾段>.<第幾小句>）
 */
export function letterVoiceSteps(n: number): { id: string; para: string; pause: number }[] {
  const prefix = `letter.${n}.`;
  const parsed = Object.keys(manifest)
    .filter((id) => id.startsWith(prefix))
    .map((id) => {
      const [part, para, sub] = id.slice(prefix.length).split('.');
      return { id, part, para: `${part}.${para}`, key: [LETTER_PART_ORDER[part] ?? 9, Number(para), Number(sub)] };
    })
    .filter((s) => s.key.every(Number.isFinite))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]);
  return parsed.map((s, k) => ({
    id: s.id,
    para: s.part === 'to' ? 'to' : s.para,
    pause: k === 0 ? LETTER_PAUSE.start : parsed[k - 1].para === s.para ? LETTER_PAUSE.sentence : LETTER_PAUSE.paragraph,
  }));
}

// ---------- 泡泡台詞：文字 → 配音 ID ----------

/** 目前語言的泡泡台詞文字 → ID（<key>.<第幾句，兩位數>）；各語言的陣列長度一樣，ID 對得上 */
let bubbleIds: Map<string, string> | null = null;

function buildBubbleIds(): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of Object.keys(SOURCE)) {
    if (!BUBBLE_PREFIXES.some((p) => key.startsWith(p)) || !Array.isArray(SOURCE[key])) continue;
    tl(key).forEach((text, k) => map.set(text, `${key}.${String(k + 1).padStart(2, '0')}`));
  }
  return map;
}

/** 泡泡上的這句話的配音 ID（找不到 = null） */
export function bubbleVoiceId(text: string): string | null {
  bubbleIds ??= buildBubbleIds();
  return bubbleIds.get(text) ?? null;
}

/** 露米婭頭上泡泡說話時：有配音就播（劇情或其他語音正在播時不打斷） */
export function playBubbleVoice(text: string): void {
  if (current) return;
  const id = bubbleVoiceId(text);
  if (id) playVoice(id);
}
