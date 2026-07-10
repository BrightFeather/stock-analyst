import { runAnalysis } from '@/lib/agent';
import { getSql } from '@/lib/db';
import type { SkillId } from '@/lib/skills/loader';

const VALID_SKILLS: SkillId[] = ['berkshire', 'panel'];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ticker = String(body?.ticker ?? '').trim().toUpperCase();
  const skill = String(body?.skill ?? '') as SkillId;

  if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 });
  if (!VALID_SKILLS.includes(skill)) {
    return Response.json({ error: `skill must be one of: ${VALID_SKILLS.join(', ')}` }, { status: 400 });
  }

  try {
    const markdown = await runAnalysis(ticker, skill);
    const sql = getSql();
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
