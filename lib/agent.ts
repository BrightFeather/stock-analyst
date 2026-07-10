import { getDataProvider } from './data';
import { runToolAgent, type ToolDef } from './llm/deepseek';
import { loadSkillSystemPrompt, type SkillId } from './skills/loader';
import {
  crossValidate,
  threeScenarioValuation,
  verifyMarketCap,
  verifyValuation,
} from './skills/berkshire/financialRigor';

function buildTools(): ToolDef[] {
  const provider = getDataProvider();
  return [
    {
      name: 'get_quote',
      description: 'Current price, market cap, PE, EPS, volume, 52-week range for a ticker.',
      parameters: {
        type: 'object',
        properties: { ticker: { type: 'string' } },
        required: ['ticker'],
      },
      handler: ({ ticker }) => provider.getQuote(ticker),
    },
    {
      name: 'get_profile',
      description: 'Company name, sector, industry, description, CEO.',
      parameters: {
        type: 'object',
        properties: { ticker: { type: 'string' } },
        required: ['ticker'],
      },
      handler: ({ ticker }) => provider.getProfile(ticker),
    },
    {
      name: 'get_key_ratios',
      description: 'Margins, ROE, ROIC, current ratio, debt/equity, FCF/share by fiscal year (most recent first).',
      parameters: {
        type: 'object',
        properties: { ticker: { type: 'string' }, years: { type: 'number' } },
        required: ['ticker'],
      },
      handler: ({ ticker, years }) => provider.getKeyRatios(ticker, years),
    },
    {
      name: 'get_financials',
      description: 'Revenue, net income, operating/free cash flow, total debt/cash by fiscal year (most recent first).',
      parameters: {
        type: 'object',
        properties: { ticker: { type: 'string' }, years: { type: 'number' } },
        required: ['ticker'],
      },
      handler: ({ ticker, years }) => provider.getFinancials(ticker, years),
    },
    {
      name: 'get_news',
      description: 'Recent news headlines for a ticker.',
      parameters: {
        type: 'object',
        properties: { ticker: { type: 'string' }, limit: { type: 'number' } },
        required: ['ticker'],
      },
      handler: ({ ticker, limit }) => provider.getNews(ticker, limit),
    },
    {
      name: 'verify_market_cap',
      description: 'Verify reported market cap against price x shares outstanding; flags >1%/>5% deviation.',
      parameters: {
        type: 'object',
        properties: {
          price: { type: 'number' },
          shares: { type: 'number' },
          reported_cap: { type: 'number' },
        },
        required: ['price', 'shares', 'reported_cap'],
      },
      handler: ({ price, shares, reported_cap }) => verifyMarketCap(price, shares, reported_cap),
    },
    {
      name: 'verify_valuation',
      description: 'Compute PE, PB, ROE, P/FCF, FCF yield, dividend yield, PS from raw per-share inputs.',
      parameters: {
        type: 'object',
        properties: {
          price: { type: 'number' },
          eps: { type: 'number' },
          bvps: { type: 'number' },
          fcf_per_share: { type: 'number' },
          dividend: { type: 'number' },
          revenue_per_share: { type: 'number' },
        },
        required: ['price'],
      },
      handler: (args) =>
        verifyValuation({
          price: args.price,
          eps: args.eps,
          bvps: args.bvps,
          fcfPerShare: args.fcf_per_share,
          dividend: args.dividend,
          revenuePerShare: args.revenue_per_share,
        }),
    },
    {
      name: 'cross_validate',
      description: 'Compare a data point across multiple named sources; returns consensus (median) and per-source deviation.',
      parameters: {
        type: 'object',
        properties: {
          source_values: { type: 'object', additionalProperties: { type: 'number' } },
          tolerance_pct: { type: 'number' },
        },
        required: ['source_values'],
      },
      handler: ({ source_values, tolerance_pct }) => crossValidate(source_values, tolerance_pct),
    },
    {
      name: 'three_scenario_valuation',
      description: 'Bull/base/bear target price from current price/EPS and per-scenario growth rate + target PE.',
      parameters: {
        type: 'object',
        properties: {
          current_price: { type: 'number' },
          current_eps: { type: 'number' },
          years: { type: 'number' },
          bull: {
            type: 'object',
            properties: { growth_pct: { type: 'number' }, target_pe: { type: 'number' } },
            required: ['growth_pct', 'target_pe'],
          },
          base: {
            type: 'object',
            properties: { growth_pct: { type: 'number' }, target_pe: { type: 'number' } },
            required: ['growth_pct', 'target_pe'],
          },
          bear: {
            type: 'object',
            properties: { growth_pct: { type: 'number' }, target_pe: { type: 'number' } },
            required: ['growth_pct', 'target_pe'],
          },
        },
        required: ['current_price', 'current_eps', 'bull', 'base', 'bear'],
      },
      handler: (args) =>
        threeScenarioValuation({
          currentPrice: args.current_price,
          currentEps: args.current_eps,
          years: args.years,
          bull: { growthPct: args.bull.growth_pct, targetPe: args.bull.target_pe },
          base: { growthPct: args.base.growth_pct, targetPe: args.base.target_pe },
          bear: { growthPct: args.bear.growth_pct, targetPe: args.bear.target_pe },
        }),
    },
  ];
}

export async function runAnalysis(ticker: string, skillId: SkillId): Promise<string> {
  const systemPrompt = await loadSkillSystemPrompt(skillId);
  const tools = buildTools();
  const markdown = await runToolAgent({
    systemPrompt,
    userPrompt: `Run the full skill analysis for ticker: ${ticker}. Return only the final markdown report.`,
    tools,
    maxIterations: 12,
    maxTokens: 8192,
  });
  return markdown;
}
