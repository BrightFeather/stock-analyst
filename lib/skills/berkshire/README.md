Vendored from [xbtlin/ai-berkshire](https://github.com/xbtlin/ai-berkshire) (MIT License, see `LICENSE`).

`investment-research.md` and `financial-data.md` are copied verbatim for attribution/fidelity.
The original skill assumes a Claude Code environment with a `Task` tool for background web-browsing
agents and a `tools/financial_rigor.py` CLI for verified arithmetic. Neither is available in this
app's request/response context, so `lib/skills/loader.ts` prepends an adaptation preamble that:

- Replaces the web-browsing/Task-agent data collection step with this app's own tool-calling
  functions backed by Financial Modeling Prep (see `lib/data/`).
- Replaces `tools/financial_rigor.py` with `lib/skills/berkshire/financialRigor.ts`, a straight
  TypeScript port of the same verification math (market cap check, valuation ratios,
  cross-source validation, three-scenario target price) — ported to keep this deployable on
  Vercel Node functions without spawning a `python3` subprocess.
- Drops the final `report_audit.py` live web spot-check gate (also web-browsing-dependent) in
  favor of the cross-validation already performed against Financial Modeling Prep data.
