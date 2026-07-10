import { getSql } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.trim().toUpperCase();

  try {
    const sql = getSql();
    const rows = ticker
      ? await sql`
          SELECT id, ticker, skill, report_date, created_at
          FROM reports WHERE ticker = ${ticker}
          ORDER BY report_date DESC, created_at DESC
        `
      : await sql`
          SELECT id, ticker, skill, report_date, created_at
          FROM reports ORDER BY report_date DESC, created_at DESC LIMIT 50
        `;
    return Response.json({ reports: rows });
  } catch (error) {
    console.error('list reports failed', { ticker, error });
    return Response.json({ error: String((error as Error)?.message ?? error) }, { status: 500 });
  }
}
