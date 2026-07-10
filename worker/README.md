# worker/

Out-of-band worker code for the **uzi** skill. This is **not** part of the
Vercel/Next.js app — it needs a Python runtime and long-running processes
(Medium/Deep modes run 5-20 min), which Vercel functions can't host. It's
excluded from Vercel deploys via `.vercelignore`.

## `deep-analysis/`

Vendored from [`wbh604/UZI-Skill`](https://github.com/wbh604/UZI-Skill)
(`skills/deep-analysis`), **MIT** — see `deep-analysis/LICENSE`. A deterministic
Python scoring pipeline (66 personas / 9 schools / 22 data dimensions) that pulls
A-share/HK/US data from free sources (Akshare, yfinance, Baostock, Sina, Tencent)
and emits a self-contained HTML report + metadata JSON + PNG social cards.

Entry point: `python run.py <TICKER> [--no-browser] [--port N]`.

## Status: foundation only — no host yet

The always-on worker host (Railway/Render/Fly) is **not chosen or provisioned**.
This directory is vendored code awaiting that decision (it adds a new monthly
cost + Chinese data-source secrets — flag before provisioning).

When the worker is stood up, it should:
1. Poll `analysis_jobs` for `pending` rows where `skill = 'uzi'` (oldest first).
2. Shell out to `run.py` for the job's ticker/mode, upload the HTML/JSON/PNG
   assets (Vercel Blob or equivalent), insert a `reports` row
   (`output_format = 'html'`) + `report_assets` rows, mark the job
   `succeeded`/`failed`.
3. For jobs with a `telegram_chat_id`, send the Telegram follow-up itself.

### Notes to verify before wiring the worker
- `run.py` takes a **positional ticker**, not the `--mode lite|medium|deep` flag
  the plan assumed. Confirm how depth mode is actually selected (flag, env, or a
  different script) before mapping `analysis_jobs.mode`.
- Data fetchers hit Chinese sources with no key; reliability depends on the
  worker's hosting region — may need a China-adjacent region or a fallback.
- Report rendering in the web app (HTML iframe) is still TODO (frontend
  `loadReport` currently renders markdown only).
