# TASKS

Handoff note: this file exists because Bash in the session that did most of this
work was pinned to a different project root (`WhereToEat`), so it could edit
files here via Read/Write/Edit but couldn't run `npm`/`tsc`/`git` in this repo.
None of the code below has been type-checked, built, or run in a browser yet.
Do that first in this session.

## Status

1. ✅ Scaffold Next.js repo + Neon `reports` table — `lib/db.ts`, `scripts/migrate.ts`.
2. ✅ Data layer — `lib/data/{types,fmp,index}.ts`, Financial Modeling Prep as the
   first provider behind a `FinancialDataProvider` interface (swap in Alpha
   Vantage etc. later behind the same shape).
3. ✅ Skills — `lib/skills/berkshire/*` vendored from `xbtlin/ai-berkshire` (MIT,
   safe to vendor, `LICENSE` copied alongside). `investor-panel-skill` has **no
   LICENSE file** — deliberately NOT vendored; `lib/skills/loader.ts` fetches it
   at runtime instead and should carry an attribution comment. Verify that's
   still true if this file gets touched.
4. ✅ Agent loop — `lib/llm/deepseek.ts` (chat completion wrapper, reuses the
   `DEEP_SEEK_API` key pattern from WhereToEat's feedback-agent) + `lib/agent.ts`
   (tool-use loop: model calls data-fetch tools, we execute them, feed results
   back, capped iterations, final markdown out).
5. ✅ Routes — `app/api/analyze/route.ts` (POST ticker+skill → runs agent → saves
   to `reports`, unique on `(ticker, skill, report_date)` so same-day reruns
   overwrite), `app/api/reports/route.ts` + `[id]/route.ts` (history/detail).
6. ✅ Frontend — `app/page.tsx` + `page.module.css` + `layout.tsx` + `globals.css`.
   Just redesigned to an "editorial financial research memo" direction: warm
   paper background, Fraunces (display) / Newsreader (report body, drop cap +
   pull-quote) / IBM Plex Mono (tickers, dates, badges) via `next/font/google`,
   single oxblood accent, green/coral reserved for verdict semantics. **Not
   yet viewed in a browser** — font names/weights/`next/font` usage should be
   sanity-checked against current Next.js 16 docs before trusting it renders
   as intended.
7. 🟡 Telegram webhook — `app/api/telegram/webhook/route.ts` looks functionally
   complete: parses `/analyze TICKER [berkshire|panel]`, uses `after()` to run
   the agent in the background, sends a typing indicator, saves the report,
   replies with the markdown as a document. **Not verified to compile or run.**
   Also unverified: whether `next/server`'s `after()` API is still current for
   Next 16 (flagged for a docs check, not confirmed against source).
8. ⬜ Deploy to Vercel + wire env vars + register webhook — not started.
   - **Known risk**: `maxDuration = 120` is set on the webhook route, but the
     agent loop realistically takes 30-90s and Vercel's **Hobby plan caps
     serverless function duration at 60s** — this repo needs Pro, or the
     analyze flow needs to become async (kick off + poll) before this works
     reliably in production. Same constraint likely applies to
     `app/api/analyze/route.ts` — check its `maxDuration` too.
   - Env vars needed: `DEEP_SEEK_API` (reuse from
     `~/.config/wte-feedback-agent/secrets.env`), `FMP_API_KEY`, Neon
     `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`.

## New: UZI-Skill integration (third skill, added 2026-07-10)

Adding `wbh604/UZI-Skill` (MIT) — A-share/HK/US analysis, 66 investor personas
across 9 schools, 22 data dimensions, deterministic Python scoring pipeline
(not an LLM-roleplay skill like the other two). This is architecturally
different enough from berkshire/panel that it needs new infra, not just a
third option in the existing flow:

- **Not markdown, not LLM-driven end to end** — it's a Python CLI (`run.py`)
  pulling from Akshare/Tushare/Baostock/Sina/Tencent/yfinance, scoring
  deterministically, then outputting a self-contained HTML report (~600KB) +
  metadata JSON + PNG social cards (1080×1920 / 1920×1080).
- **Depth modes take 1-2 min (Lite) / 5-8 min (Medium, default) / 15-20 min
  (Deep)** — Medium and Deep blow past any Vercel serverless duration limit,
  Hobby or Pro. Decided: **async job queue**, not sync-only Lite mode.
- **Output stays HTML/JSON/PNG** — decided: extend schema for multi-format
  rather than lossy-converting to markdown.

Concrete plan:

9. **Schema** — add `analysis_jobs` table (`id, ticker, skill, mode, status
   [pending|running|succeeded|failed], created_at, started_at, finished_at,
   error, report_id, telegram_chat_id`). Add `reports.output_format` (
   `markdown | html`, default `markdown` for existing rows). Add
   `report_assets` table (`report_id, kind [html|json|card_portrait|
   card_landscape], url`) rather than cramming asset URLs onto `reports`.
10. **Vendor UZI-Skill** — MIT, safe to vendor. Lives outside `lib/skills/`
    (that dir is TS-only, loaded into the Node/Vercel runtime) — put it under
    a new `worker/` directory since it needs to run somewhere that can host
    Python + long-running processes, which Vercel functions are not. Copy
    `skills/deep-analysis/` + `LICENSE` + `requirements.txt`.
11. **Stand up a small always-on worker** (Railway/Render/Fly — pick whichever
    at implementation time, no strong reason to prefer one yet) that polls
    `analysis_jobs` for `pending` rows with `skill = 'uzi'`, shells out to
    `python run.py --ticker <t> --mode <lite|medium|deep>`, uploads the HTML/
    JSON/PNGs (Vercel Blob or equivalent), writes a `reports` row with
    `output_format = 'html'` + matching `report_assets` rows, marks the job
    `succeeded`/`failed`. This is genuinely new infrastructure and a new
    monthly cost, not a Vercel-only addition — flag that plainly when this
    gets set up, don't just quietly add a bill.
12. **`POST /api/analyze` branches on skill** — `berkshire`/`panel` stay
    exactly as-is (synchronous, fits in one request). `uzi` inserts an
    `analysis_jobs` row and returns `202 { jobId, status: 'pending' }`
    immediately instead of running inline.
13. **New `GET /api/jobs/[id]`** — poll endpoint returning job status, and
    `report_id` once `succeeded` (frontend/bot then fetches the report/assets
    normally).
14. **Frontend** — add "UZI" as a third segmented-control option + a depth-mode
    selector (Lite/Medium/Deep) shown only when UZI is selected. On submit,
    poll `/api/jobs/[id]` instead of awaiting the response; once done, render
    the HTML report (sandboxed `<iframe>` or a dedicated `/reports/[id]/html`
    route serving it directly) instead of piping through `ReactMarkdown` —
    `ReactMarkdown` cannot render this skill's output at all.
15. **Telegram webhook** — for `uzi`, enqueue instead of awaiting inline (the
    existing `after()` + inline-await pattern doesn't work for a 20-minute
    job in a webhook handler regardless of `maxDuration`). Store
    `telegram_chat_id` on the job row; have the **worker** send the Telegram
    follow-up (document + social card image) directly once it finishes, since
    it already has the bot token and is the process actually watching for
    completion.

## Before doing anything else in the new session

- `npm install && npx tsc --noEmit` — first real compile check this code has had.
- `npm run dev`, open `localhost:3000`, confirm the redesign actually renders
  (fonts loading, layout, segmented control, report typography) — screenshot
  or describe what's broken if anything.
- `chmod 755 .` — the project root somehow ended up `drwxrwxrwx` (777,
  world-writable) during earlier troubleshooting; that's worth tightening
  back down.

## Open items / things to double check, not just trust

- `investor-panel-skill` has no license — current plan is runtime-fetch +
  attribution, not vendoring. If this becomes a public product rather than a
  personal tool, revisit (contact the author, or drop the skill).
- ai-berkshire skill is scoped to a subset of its 19 skills (the deep-research
  flow) — not the full `/investment-team` multi-agent fan-out. Expand later
  if useful, not required for v1.
- DeepSeek is running skills authored/tuned for Claude — fidelity to the
  original skill's intent is unverified; worth eyeballing a couple of real
  reports against what the ai-berkshire README describes as output shape.
- UZI-Skill's data fetchers hit Chinese sources (Akshare, Tushare, Baostock,
  Sina, Tencent) with no API key — reliability/rate-limiting from whatever
  region the worker ends up hosted in is unverified; may need a China-adjacent
  region or a fallback path if those sources block the worker's IP.
- UZI-Skill adds a second deploy target (the worker) and its own secrets
  (whatever Tushare/etc. need) beyond Vercel's — bring this up explicitly
  before deploying, it changes the ops story, not just the codebase.
