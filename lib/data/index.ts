import type { FinancialDataProvider } from './types';
import { createFmpProvider } from './fmp';
import { getFinnhubNews } from './finnhub';

let _provider: FinancialDataProvider | null = null;

export function getDataProvider(): FinancialDataProvider {
  if (!_provider) {
    const kind = process.env.DATA_PROVIDER ?? 'fmp';
    switch (kind) {
      case 'fmp': {
        const base = createFmpProvider();
        // FMP news needs a paid tier (402 on ours); source news from Finnhub
        // when its key is set, keeping fundamentals on FMP.
        _provider = process.env.FINNHUB_API_KEY
          ? { ...base, getNews: (ticker, limit) => getFinnhubNews(ticker, limit) }
          : base;
        break;
      }
      default:
        throw new Error(`unknown DATA_PROVIDER: ${kind}`);
    }
  }
  return _provider;
}

export * from './types';
