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

let current: { el: HTMLAudioElement; node: MediaElementAudioSourceNode } | null = null;

export function stopVoice(): void {
  if (!current) return;
  current.el.pause();
  current.node.disconnect();
  current = null;
}

/** 播一句（會先停掉正在播的） */
export function playVoice(id: string): void {
  stopVoice();
  const file = manifest[id];
  const ctx = audioContext();
  const bus = busNode('voice');
  if (!file || !ctx || !bus || !audible('voice') || ctx.state !== 'running') return;
  const el = new Audio(`${import.meta.env.BASE_URL}voice/${file}`);
  const node = ctx.createMediaElementSource(el);
  node.connect(bus);
  current = { el, node };
  el.onended = () => {
    if (current?.el === el) stopVoice();
  };
  el.play().catch(() => {
    if (current?.el === el) stopVoice();
  });
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
