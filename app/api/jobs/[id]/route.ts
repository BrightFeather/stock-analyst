import { getSql } from '@/lib/db';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const sql = getSql();
    const [job] = await sql`
      SELECT id, ticker, skill, mode, status, error, report_id,
             created_at, started_at, finished_at
      FROM analysis_jobs WHERE id = ${id}
    `;
    if (!job) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ job });
  } catch (error) {
    console.error('get job failed', { id, error });
    return Response.json({ error: String((error as Error)?.message ?? error) }, { status: 500 });
  }
}
