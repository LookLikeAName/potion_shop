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

/** 一輪的時間：1 秒以上顯示秒數；更快時改顯示「每秒幾輪」（小數點後兩位已經看不出差異） */
export function formatCycle(sec: number): string {
  if (!Number.isFinite(sec)) return '無';
  if (sec >= 1) return formatSeconds(sec);
  return `每秒 ${formatRate(1 / sec)} 輪`;
}

/** 每秒速率：小數字保留小數（0.35、4.2），大數字同 formatNumber */
export function formatRate(n: number): string {
  const v = Math.abs(n);
  if (v >= 100) return formatNumber(n);
  if (v < 0.005) return '0';
  return n.toFixed(v >= 10 ? 1 : 2).replace(/\.?0+$/, '');
}

/**
 * 完整數字加千分位（12,345,678），不用 K/M 縮寫：成交與收購的金額用這個，讓玩家感覺數字很大。
 * 小於 100 的非整數留一位小數（收購原料可能只有零點幾金）。
 */
export function formatFull(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (Math.abs(n) < 100 && !Number.isInteger(n)) return n.toFixed(1).replace(/\.0$/, '');
  return Math.floor(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * 精確數字（圖表提示框用）：不縮寫、加千分位；小於 100 的留到小數點後 2 位（每秒 0.14 瓶這種速率也看得出來）
 */
export function formatExact(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (Math.abs(n) < 100) return n.toFixed(2).replace(/\.?0+$/, '') || '0';
  return Math.round(n).toLocaleString('en-US');
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
