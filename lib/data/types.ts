export interface Quote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number | null;
  peRatio: number | null;
  eps: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

export interface KeyRatios {
  fiscalYear: string;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  returnOnEquity: number | null;
  returnOnInvestedCapital: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
  freeCashFlowPerShare: number | null;
}

export interface FinancialStatementSummary {
  fiscalYear: string;
  revenue: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  totalDebt: number | null;
  totalCash: number | null;
}

export interface NewsItem {
  title: string;
  publishedAt: string;
  source: string;
  url: string;
}

export interface CompanyProfile {
  name: string;
  sector: string | null;
  industry: string | null;
  description: string | null;
  ceo: string | null;
}

/** Abstraction over a financial data vendor so FMP can be swapped for another provider later. */
export interface FinancialDataProvider {
  getQuote(ticker: string): Promise<Quote>;
  getProfile(ticker: string): Promise<CompanyProfile>;
  /** Most recent N fiscal years, most recent first. */
  getKeyRatios(ticker: string, years?: number): Promise<KeyRatios[]>;
  getFinancials(ticker: string, years?: number): Promise<FinancialStatementSummary[]>;
  getNews(ticker: string, limit?: number): Promise<NewsItem[]>;
}
