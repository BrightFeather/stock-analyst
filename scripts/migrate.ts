import { getSql } from '../lib/db';

async function main() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      ticker TEXT NOT NULL,
      skill TEXT NOT NULL,
      report_date DATE NOT NULL,
      markdown TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (ticker, skill, report_date)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS reports_ticker_idx ON reports (ticker)`;

  // Stage 3 (UZI-Skill): reports can be markdown (berkshire/panel) or html (uzi).
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS output_format TEXT NOT NULL DEFAULT 'markdown'`;

  // Async job queue — uzi runs on an out-of-band worker, not inline.
  await sql`
    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id SERIAL PRIMARY KEY,
      ticker TEXT NOT NULL,
      skill TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      report_id INTEGER REFERENCES reports (id),
      telegram_chat_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ
    )
  `;
  // Worker poll: cheapest pending job per skill, oldest first.
  await sql`CREATE INDEX IF NOT EXISTS analysis_jobs_poll_idx ON analysis_jobs (skill, status, created_at)`;

  // Non-markdown assets (self-contained HTML, metadata JSON, social cards).
  await sql`
    CREATE TABLE IF NOT EXISTS report_assets (
      id SERIAL PRIMARY KEY,
      report_id INTEGER NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS report_assets_report_idx ON report_assets (report_id)`;

  console.log('migrate: reports + analysis_jobs + report_assets ready');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
