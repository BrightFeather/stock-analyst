import { runAnalysis } from '@/lib/agent';
import { getSql } from '@/lib/db';
import { ALL_SKILLS, DEFAULT_UZI_MODE, isUziMode } from '@/lib/jobs';
import type { SkillId } from '@/lib/skills/loader';

// The agent loop runs synchronously here and has been observed at ~120s for a
// single ticker; give generous headroom. Requires Vercel Pro (Hobby caps at 60s;
// Pro allows up to 300s). Matches the webhook route.
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ticker = String(body?.ticker ?? '').trim().toUpperCase();
  const skill = String(body?.skill ?? '') as SkillId;
  const mode = isUziMode(body?.mode) ? body.mode : DEFAULT_UZI_MODE;

  if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 });
  if (!ALL_SKILLS.includes(skill)) {
    return Response.json({ error: `skill must be one of: ${ALL_SKILLS.join(', ')}` }, { status: 400 });
  }

  const sql = getSql();

  try {
    // Only run a new query if this ticker+skill hasn't been analyzed today;
    // otherwise showcase today's existing report.
    const [existing] = await sql`
      SELECT id, report_date, markdown, output_format
      FROM reports
      WHERE ticker = ${ticker} AND skill = ${skill} AND report_date = CURRENT_DATE
    `;
    if (existing) {
      return Response.json({
        id: existing.id,
        ticker,
        skill,
        reportDate: existing.report_date,
        markdown: existing.markdown,
        outputFormat: existing.output_format,
        cached: true,
      });
    }

    // uzi runs on an out-of-band worker; enqueue and return immediately.
    if (skill === 'uzi') {
      // Reuse an in-flight job for the same ticker today rather than duplicating.
      const [inflight] = await sql`
        SELECT id, status FROM analysis_jobs
        WHERE ticker = ${ticker} AND skill = 'uzi'
          AND status IN ('pending', 'running')
          AND created_at::date = CURRENT_DATE
        ORDER BY created_at DESC LIMIT 1
      `;
      if (inflight) {
        return Response.json({ jobId: inflight.id, status: inflight.status }, { status: 202 });
      }
      const [job] = await sql`
        INSERT INTO analysis_jobs (ticker, skill, mode)
        VALUES (${ticker}, 'uzi', ${mode})
        RETURNING id, status
      `;
      return Response.json({ jobId: job.id, status: job.status }, { status: 202 });
    }

    // berkshire/panel run inline.
    const markdown = await runAnalysis(ticker, skill);
    const [row] = await sql`
      INSERT INTO reports (ticker, skill, report_date, markdown)
      VALUES (${ticker}, ${skill}, CURRENT_DATE, ${markdown})
      ON CONFLICT (ticker, skill, report_date)
      DO UPDATE SET markdown = EXCLUDED.markdown, created_at = now()
      RETURNING id, report_date
    `;
    return Response.json({ id: row.id, ticker, skill, reportDate: row.report_date, markdown });
  } catch (error) {
    console.error('analyze failed', { ticker, skill, error });
    return Response.json({ error: String((error as Error)?.message ?? error) }, { status: 500 });
  }
}
