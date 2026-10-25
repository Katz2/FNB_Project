import type { CaseRef } from "./store";
import type { TipInput } from "./validate";

const commonPrefix = (a: string, b: string) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i; };

/**
 * Rule-based auto-assignment on non-identifying routing metadata only.
 * Category must match; geohash must share >= 4 chars (~20km). Closest case wins.
 * Returns undefined -> tip goes to the manual triage queue.
 */
export function autoAssign(tip: Pick<TipInput, "category" | "geohash">, cases: readonly CaseRef[]): string | undefined {
  let best: { id: string; score: number } | undefined;
  for (const c of cases) {
    if (c.category !== tip.category) continue;
    const score = commonPrefix(c.geohash, tip.geohash);
    if (score >= 4 && (!best || score > best.score)) best = { id: c.id, score };
  }
  return best?.id;
}
