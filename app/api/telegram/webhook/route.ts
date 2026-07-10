import { after } from 'next/server';
import { runAnalysis } from '@/lib/agent';
import { getSql } from '@/lib/db';
import type { SkillId } from '@/lib/skills/loader';
import { sendChatAction, sendDocument, sendMessage } from '@/lib/telegram';

// The agent loop realistically takes 30-90s; this needs Vercel Pro (Hobby caps
// serverless duration at 60s) — see plan note on maxDuration for /api/analyze too.
export const maxDuration = 120;

const VALID_SKILLS: SkillId[] = ['berkshire', 'panel'];
const DEFAULT_SKILL: SkillId = 'berkshire';

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

async function handleAnalyze(chatId: number, ticker: string, skill: SkillId) {
  await sendChatAction(chatId, 'typing');
  try {
    const markdown = await runAnalysis(ticker, skill);
    const sql = getSql();
    const [row] = await sql`
      INSERT INTO reports (ticker, skill, report_date, markdown)
      VALUES (${ticker}, ${skill}, CURRENT_DATE, ${markdown})
      ON CONFLICT (ticker, skill, report_date)
      DO UPDATE SET markdown = EXCLUDED.markdown, created_at = now()
      RETURNING report_date
    `;
    await sendDocument(chatId, `${ticker}-${skill}-${row.report_date}.md`, markdown, `${ticker} · ${skill}`);
  } catch (error) {
    console.error('telegram analyze failed', { ticker, skill, error });
    await sendMessage(chatId, `Analysis failed: ${String((error as Error)?.message ?? error)}`);
  }
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const chatId = update?.message?.chat.id;
  const text = update?.message?.text?.trim();

  if (chatId && text?.startsWith('/analyze')) {
    const parts = text.replace(/^\/analyze(@\w+)?/, '').trim().split(/\s+/).filter(Boolean);
    const ticker = parts[0]?.toUpperCase();
    const requestedSkill = parts[1]?.toLowerCase() as SkillId | undefined;
    const skill = requestedSkill && VALID_SKILLS.includes(requestedSkill) ? requestedSkill : DEFAULT_SKILL;

    if (!ticker) {
      after(() => sendMessage(chatId, 'Usage: /analyze TICKER [berkshire|panel]'));
    } else {
      after(() => sendMessage(chatId, `Analyzing ${ticker} via ${skill}… this can take up to 90s.`));
      after(() => handleAnalyze(chatId, ticker, skill));
    }
  }

  return Response.json({ ok: true });
}
