export const dollars = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const wholeDollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-AU')}`;

// Deterministic pseudo-random generator so the synthetic data is identical on every run.
export function seeded(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    chance: (p: number) => next() < p,
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    weighted: <T>(items: readonly [T, number][]) => {
      let r = next() * items.reduce((s, [, w]) => s + w, 0);
      for (const [v, w] of items) if ((r -= w) <= 0) return v;
      return items[items.length - 1][0];
    },
  };
}
