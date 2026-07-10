import type { NewsItem } from './types';

const BASE_URL = 'https://finnhub.io/api/v1';

function apiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY is not set');
  return key;
}

function isoDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

interface FinnhubArticle {
  datetime: number; // unix seconds
  headline: string;
  source: string;
  url: string;
}

/**
 * Company news from Finnhub over a trailing 30-day window, newest first.
 * FMP gates news behind a paid tier (402), so news is sourced from Finnhub
 * while fundamentals stay on FMP — see lib/data/index.ts.
 */
export async function getFinnhubNews(ticker: string, limit = 10): Promise<NewsItem[]> {
  const url = new URL(`${BASE_URL}/company-news`);
  url.searchParams.set('symbol', ticker);
  url.searchParams.set('from', isoDate(30));
  url.searchParams.set('to', isoDate(0));
  url.searchParams.set('token', apiKey());

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Finnhub company-news failed: ${res.status} ${await res.text()}`);

  const rows = (await res.json()) as FinnhubArticle[];
  if (!Array.isArray(rows)) return [];
  return rows
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, limit)
    .map((row) => ({
      title: row.headline,
      publishedAt: new Date(row.datetime * 1000).toISOString(),
      source: row.source ?? 'unknown',
      url: row.url,
    }));
}
