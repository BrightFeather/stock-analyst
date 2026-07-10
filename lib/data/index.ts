import type { FinancialDataProvider } from './types';
import { createFmpProvider } from './fmp';

let _provider: FinancialDataProvider | null = null;

export function getDataProvider(): FinancialDataProvider {
  if (!_provider) {
    const kind = process.env.DATA_PROVIDER ?? 'fmp';
    switch (kind) {
      case 'fmp':
        _provider = createFmpProvider();
        break;
      default:
        throw new Error(`unknown DATA_PROVIDER: ${kind}`);
    }
  }
  return _provider;
}

export * from './types';
