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
  console.log('migrate: reports table ready');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
