// 主線劇情（原稿在 story.md）：序章 → 第一次的慶功宴 → 三封遠方的來信 → 星空下的誓約。
//
// 劇本的結構（預留配音的空間）：
// - 每一句台詞有固定的 ID：「場景.編號」，例如 opening.07。
//   文字在語言檔 dialogue.json：script.<ID> 是台詞（要唸出來的部分），script.<ID>.act 是動作、表情（括號裡的舞台指示，不唸）。
//   兩個都可以省略：只有動作的句子沒有 script.<ID>，沒有動作的句子沒有 script.<ID>.act。
// - 場景的說話順序在 script.json（語音工具 tools/voice 也讀這個檔）。
// - 配音檔照 ID 放：public/voice/<ID>.<格式>，由 public/voice/manifest.json 列出（語音工具產生；所有語言共用一套）。
//   有了配音之後 ID 就不要改；要插入新句子就用新的編號（例如 07b），播放順序由 script.json 的清單決定，不看編號大小。
// - 說話者：lumia 露米婭、book 魔導書（老師）、narration 旁白與場景描述（不顯示名字、不配音）。
import { hasText, localized, localizedList, t } from '../../i18n';
import SCRIPT_JSON from './script.json';

export type Speaker = 'lumia' | 'book' | 'narration';

export type SceneId = 'opening' | 'celebration' | 'letter1' | 'letter2' | 'letter3' | 'vow';

export interface ScriptLine {
  /** 固定的台詞 ID（場景.編號），也是配音檔的名字 */
  readonly id: string;
  readonly who: Speaker;
  /** 台詞（沒有 = 只有動作） */
  readonly text: string;
  /** 動作、表情（不唸出來） */
  readonly act: string;
}

export interface Scene {
  readonly id: SceneId;
  /** 劇情 CG 的資源 ID；null = 不顯示 CG */
  readonly cg: string | null;
  readonly title: string;
  readonly lines: readonly ScriptLine[];
}

const line = (scene: SceneId, who: Speaker, n: string): ScriptLine => {
  const id = `${scene}.${n}`;
  return {
    id, who,
    get text() { return hasText(`script.${id}`) ? t(`script.${id}`) : ''; },
    get act() { return hasText(`script.${id}.act`) ? t(`script.${id}.act`) : ''; },
  };
};

/** 各場景的說話順序：[說話者, 編號]（script.json；信件的感想 letter1～3 讀完信之後接著播） */
const SCRIPT = SCRIPT_JSON.scenes as Record<SceneId, { cg: string | null; title: string; lines: [Speaker, string][] }>;

/** 場景裡露米婭頭上泡泡的台詞：語言檔裡這些開頭的陣列（配音 ID = <key>.<第幾句，兩位數>） */
export const BUBBLE_PREFIXES: readonly string[] = SCRIPT_JSON.bubbles.prefixes;

export const SCENES = Object.fromEntries(
  (Object.keys(SCRIPT) as SceneId[]).map((id) => {
    const s = SCRIPT[id];
    const scene: Scene = {
      id, cg: s.cg, lines: s.lines.map(([who, n]) => line(id, who, n)),
      get title() { return t(s.title); },
    };
    return [id, scene];
  }),
) as Record<SceneId, Scene>;

export const isScene = (id: string): id is SceneId => id in SCRIPT;

/** 說話者顯示的名字（語言檔 speaker.<who>；旁白沒有名字） */
export function speakerName(who: Speaker): string {
  return who === 'narration' ? '' : t(`speaker.${who}`);
}

/**
 * 三封遠方的來信：兌換「第一次的慶功宴」之後，羈絆到 bond 級就寄來下一封（events.ts 的 letterReady）。
 * 信的文字在語言檔 letter.<n>.title／to（稱呼）／body（段落）／closing（結尾，靠右）／note（信紙的描述，可省略）；
 * 讀完接著播 scene（露米婭的感想）。
 */
export interface Letter {
  readonly title: string;
  readonly to: string;
  readonly body: string[];
  readonly closing: string[];
  readonly note: string;
  readonly bond: number;
  readonly scene: SceneId;
}

export const LETTERS: Letter[] = ([13, 14, 15] as const).map((bond, k) => {
  const n = k + 1;
  const base = localizedList(localized({ bond, scene: `letter${n}` as SceneId }, `letter.${n}`, ['title', 'to']), `letter.${n}`, ['body', 'closing']);
  return Object.defineProperty(base, 'note', {
    get: () => (hasText(`letter.${n}.note`) ? t(`letter.${n}.note`) : ''),
    enumerable: true,
  }) as Letter;
});
