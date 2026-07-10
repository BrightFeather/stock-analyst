/**
 * TypeScript port of ai-berkshire's tools/financial_rigor.py (MIT, xbtlin/ai-berkshire).
 * Ported (instead of shelling out to python3) so this stays deployable on Vercel Node
 * functions without a subprocess dependency. Same tolerance thresholds as the original.
 */

export interface MarketCapCheck {
  calculated: number;
  reported: number;
  deviationPct: number;
  status: 'ok' | 'warn' | 'fail';
}

export function verifyMarketCap(price: number, shares: number, reportedCap: number): MarketCapCheck {
  const calculated = price * shares;
  const deviationPct = reportedCap !== 0 ? (Math.abs(calculated - reportedCap) / Math.abs(reportedCap)) * 100 : 0;
  const status = deviationPct > 5 ? 'fail' : deviationPct > 1 ? 'warn' : 'ok';
  return { calculated, reported: reportedCap, deviationPct, status };
}

export interface ValuationRatios {
  pe?: number;
  earningsYieldPct?: number;
  pb?: number;
  roePct?: number;
  pFcf?: number;
  fcfYieldPct?: number;
  dividendYieldPct?: number;
  ps?: number;
}

export function verifyValuation(input: {
  price: number;
  eps?: number;
  bvps?: number;
  fcfPerShare?: number;
  dividend?: number;
  revenuePerShare?: number;
}): ValuationRatios {
  const { price } = input;
  const out: ValuationRatios = {};
  if (input.eps != null && input.eps !== 0) {
    out.pe = price / input.eps;
    out.earningsYieldPct = (input.eps / price) * 100;
  }
  if (input.bvps != null && input.bvps !== 0) {
    out.pb = price / input.bvps;
    if (input.eps != null) out.roePct = (input.eps / input.bvps) * 100;
  }
  if (input.fcfPerShare != null && input.fcfPerShare !== 0) {
    out.pFcf = price / input.fcfPerShare;
    out.fcfYieldPct = (input.fcfPerShare / price) * 100;
  }
  if (input.dividend != null && price !== 0) {
    out.dividendYieldPct = (input.dividend / price) * 100;
  }
  if (input.revenuePerShare != null && input.revenuePerShare !== 0) {
    out.ps = price / input.revenuePerShare;
  }
  return out;
}

export interface CrossValidateResult {
  consensus: number;
  allConsistent: boolean;
  deviations: Record<string, number>;
}

export function crossValidate(sourceValues: Record<string, number>, tolerancePct = 2): CrossValidateResult {
  const nums = Object.values(sourceValues).sort((a, b) => a - b);
  const n = nums.length;
  const median = n % 2 === 1 ? nums[(n - 1) / 2]! : (nums[n / 2 - 1]! + nums[n / 2]!) / 2;
  const deviations: Record<string, number> = {};
  let allConsistent = true;
  for (const [source, value] of Object.entries(sourceValues)) {
    const dev = median !== 0 ? (Math.abs(value - median) / Math.abs(median)) * 100 : 0;
    deviations[source] = dev;
    if (dev > tolerancePct) allConsistent = false;
  }
  return { consensus: median, allConsistent, deviations };
}

export interface ScenarioResult {
  scenario: 'bull' | 'base' | 'bear';
  growthPct: number;
  targetPe: number;
  futureEps: number;
  targetPrice: number;
  changePct: number;
}

export function threeScenarioValuation(input: {
  currentPrice: number;
  currentEps: number;
  years?: number;
  bull: { growthPct: number; targetPe: number };
  base: { growthPct: number; targetPe: number };
  bear: { growthPct: number; targetPe: number };
}): ScenarioResult[] {
  const years = input.years ?? 3;
  const scenarios: Array<['bull' | 'base' | 'bear', { growthPct: number; targetPe: number }]> = [
    ['bull', input.bull],
    ['base', input.base],
    ['bear', input.bear],
  ];
  return scenarios.map(([scenario, { growthPct, targetPe }]) => {
    const futureEps = input.currentEps * (1 + growthPct / 100) ** years;
    const targetPrice = futureEps * targetPe;
    const changePct = ((targetPrice - input.currentPrice) / input.currentPrice) * 100;
    return { scenario, growthPct, targetPe, futureEps, targetPrice, changePct };
  });
}
