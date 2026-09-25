// 等比級數價格：第 k 次購買（從 0 起算）價格 = base × growth^k

export type BuyMode = 1 | 10 | 'max';

export function bulkCost(base: number, growth: number, owned: number, count: number): number {
  if (count <= 0) return 0;
  if (growth === 1) return base * count;
  return (base * growth ** owned * (growth ** count - 1)) / (growth - 1);
}

export function maxAffordable(base: number, growth: number, owned: number, budget: number, cap = 1000): number {
  const first = base * growth ** owned;
  if (budget < first) return 0;
  let n = growth === 1
    ? Math.floor(budget / base)
    : Math.floor(Math.log((budget * (growth - 1)) / first + 1) / Math.log(growth));
  n = Math.min(cap, Math.max(0, n));
  // 浮點誤差保護
  while (n > 0 && bulkCost(base, growth, owned, n) > budget) n--;
  return n;
}

export interface Quote {
  count: number;
  cost: number;
  affordable: boolean;
}

export function quote(
  base: number, growth: number, owned: number, mode: BuyMode, budget: number, remaining = Infinity,
): Quote {
  let count: number;
  if (mode === 'max') {
    count = Math.min(remaining, maxAffordable(base, growth, owned, budget));
    // 一個都買不起時，顯示下一級的價格
    if (count === 0) count = Math.min(1, remaining);
  } else {
    count = Math.min(mode, remaining);
  }
  const cost = bulkCost(base, growth, owned, count);
  return { count, cost, affordable: count > 0 && cost <= budget };
}
