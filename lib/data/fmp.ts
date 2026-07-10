import type {
  CompanyProfile,
  FinancialDataProvider,
  FinancialStatementSummary,
  KeyRatios,
  NewsItem,
  Quote,
} from './types';

const BASE_URL = 'https://financialmodelingprep.com/stable';

function apiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error('FMP_API_KEY is not set');
  return key;
}

async function fmpGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('apikey', apiKey());
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`FMP ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

// NOTE: FMP has migrated most endpoints to /stable/ over the last couple of
// years and field names shift between plan tiers — verify these paths/fields
// against https://site.financialmodelingprep.com/developer/docs once
// FMP_API_KEY is available, this was written against documented shapes but
// not smoke-tested live.
export function createFmpProvider(): FinancialDataProvider {
  return {
    async getQuote(ticker) {
      const [row] = await fmpGet<any[]>('/quote', { symbol: ticker });
      if (!row) throw new Error(`no quote for ${ticker}`);
      return {
        ticker,
        price: row.price,
        change: row.change,
        changePercent: row.changesPercentage ?? row.changePercentage,
        marketCap: row.marketCap ?? null,
        peRatio: row.pe ?? null,
        eps: row.eps ?? null,
        volume: row.volume ?? null,
        fiftyTwoWeekHigh: row.yearHigh ?? null,
        fiftyTwoWeekLow: row.yearLow ?? null,
      } satisfies Quote;
    },

    async getProfile(ticker) {
      const [row] = await fmpGet<any[]>('/profile', { symbol: ticker });
      if (!row) throw new Error(`no profile for ${ticker}`);
      return {
        name: row.companyName ?? ticker,
        sector: row.sector ?? null,
        industry: row.industry ?? null,
        description: row.description ?? null,
        ceo: row.ceo ?? null,
      } satisfies CompanyProfile;
    },

    async getKeyRatios(ticker, years = 5) {
      const rows = await fmpGet<any[]>('/ratios', { symbol: ticker, limit: String(years) });
      return rows.map(
        (row): KeyRatios => ({
          fiscalYear: row.fiscalYear ?? row.date,
          grossMargin: row.grossProfitMargin ?? null,
          operatingMargin: row.operatingProfitMargin ?? null,
          netMargin: row.netProfitMargin ?? null,
          returnOnEquity: row.returnOnEquity ?? null,
          returnOnInvestedCapital: row.returnOnInvestedCapital ?? null,
          currentRatio: row.currentRatio ?? null,
          debtToEquity: row.debtToEquityRatio ?? null,
          freeCashFlowPerShare: row.freeCashFlowPerShare ?? null,
        }),
      );
    },

    async getFinancials(ticker, years = 5) {
      const [income, cashflow, balance] = await Promise.all([
        fmpGet<any[]>('/income-statement', { symbol: ticker, limit: String(years) }),
        fmpGet<any[]>('/cash-flow-statement', { symbol: ticker, limit: String(years) }),
        fmpGet<any[]>('/balance-sheet-statement', { symbol: ticker, limit: String(years) }),
      ]);
      const cashflowByYear = new Map(cashflow.map((row) => [row.fiscalYear ?? row.date, row]));
      const balanceByYear = new Map(balance.map((row) => [row.fiscalYear ?? row.date, row]));
      return income.map((row): FinancialStatementSummary => {
        const year = row.fiscalYear ?? row.date;
        const cf = cashflowByYear.get(year);
        const bs = balanceByYear.get(year);
        return {
          fiscalYear: year,
          revenue: row.revenue ?? null,
          netIncome: row.netIncome ?? null,
          operatingCashFlow: cf?.operatingCashFlow ?? null,
          freeCashFlow: cf?.freeCashFlow ?? null,
          totalDebt: bs?.totalDebt ?? null,
          totalCash: bs?.cashAndCashEquivalents ?? null,
        };
      });
    },

    async getNews(ticker, limit = 10) {
      const rows = await fmpGet<any[]>('/news/stock', { symbols: ticker, limit: String(limit) });
      return rows.map(
        (row): NewsItem => ({
          title: row.title,
          publishedAt: row.publishedDate ?? row.date,
          source: row.site ?? row.source ?? 'unknown',
          url: row.url,
        }),
      );
    },
  };
}
