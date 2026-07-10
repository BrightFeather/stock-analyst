import { getSql } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const download = searchParams.get('download') === '1';

  try {
    const sql = getSql();
    const [row] = await sql`SELECT * FROM reports WHERE id = ${id}`;
    if (!row) return Response.json({ error: 'not found' }, { status: 404 });

    if (download) {
      return new Response(row.markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${row.ticker}-${row.skill}-${row.report_date}.md"`,
        },
      });
    }
    return Response.json({ report: row });
  } catch (error) {
    console.error('get report failed', { id, error });
    return Response.json({ error: String((error as Error)?.message ?? error) }, { status: 500 });
  }
}
