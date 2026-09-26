const SUFFIXES = ['', 'K', 'M', 'B', 'T'];

/** 1,234 → 1.23K → 1.23M → B → T → aa, ab… */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v < 1000) return sign + Math.floor(v).toLocaleString('en-US');
  const tier = Math.floor(Math.log10(v) / 3);
  const scaled = v / 1000 ** tier;
  let suffix: string;
  if (tier < SUFFIXES.length) {
    suffix = SUFFIXES[tier];
  } else {
    const k = tier - SUFFIXES.length;
    suffix = String.fromCharCode(97 + Math.floor(k / 26)) + String.fromCharCode(97 + (k % 26));
  }
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return sign + scaled.toFixed(digits) + suffix;
}

/** 解析玩家輸入的數量：500、2k、1.5M、1,200；看不懂就回傳 null */
export function parseAmount(input: string): number | null {
  const m = input.trim().replace(/,/g, '').match(/^(\d+(?:\.\d*)?|\.\d+)\s*([kKmMbB]?)$/);
  if (!m) return null;
  const mult = { '': 1, k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase() as '' | 'k' | 'm' | 'b'];
  return Number(m[1]) * mult;
}

/** 每秒速率：小數字保留小數（0.35、4.2），大數字同 formatNumber */
export function formatRate(n: number): string {
  const v = Math.abs(n);
  if (v >= 100) return formatNumber(n);
  if (v < 0.005) return '0';
  return n.toFixed(v >= 10 ? 1 : 2).replace(/\.?0+$/, '');
}

export function formatHappiness(n: number): string {
  return n.toFixed(4);
}

export function formatDuration(sec: number): string {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} 小時 ${m} 分`;
  if (m > 0) return `${m} 分 ${s % 60} 秒`;
  return `${s} 秒`;
}

export function formatSeconds(sec: number): string {
  if (sec >= 100) return `${Math.round(sec)} 秒`;
  return `${sec.toFixed(sec >= 10 ? 1 : 2)} 秒`;
}
