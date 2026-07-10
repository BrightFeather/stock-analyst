import fs from 'node:fs';
import path from 'node:path';

export type SkillId = 'berkshire' | 'panel' | 'uzi';

const BERKSHIRE_DIR = path.join(process.cwd(), 'lib', 'skills', 'berkshire');

const BERKSHIRE_TOOLS_PREAMBLE = `You are running the "ai-berkshire" investment-research skill
(Buffett/Munger/Duan Yongping/Li Lu methodology), adapted to run as an API-driven agent instead
of inside Claude Code. Two changes from the original instructions below:

1. Wherever the skill says to launch a background Task agent to browse the web for data
   (Step 1 / 数据收集), instead call the provided tool functions
   (get_quote, get_profile, get_key_ratios, get_financials, get_news) — they return data
   already sourced from Financial Modeling Prep. Do not attempt to browse the web yourself.
2. Wherever the skill says to shell out to \`tools/financial_rigor.py\` for verified arithmetic
   (market cap check, valuation ratios, cross-source validation, three-scenario valuation),
   instead call the equivalent tool functions
   (verify_market_cap, verify_valuation, cross_validate, three_scenario_valuation) —
   same calculations, same tolerance thresholds, no subprocess involved.

Skip the final "数据抽检 (report_audit.py)" live web spot-check step entirely — it depends on
web browsing this environment doesn't have. Rely on the cross_validate tool against
Financial Modeling Prep data instead. Do not write the report to a local file path; just return
the final markdown report as your answer.

--- Original skill instructions follow ---

`;

const PANEL_REPO_RAW = 'https://raw.githubusercontent.com/caroline-li-studio/investor-panel-skill/main';
const PANEL_FILES = [
  'skills/investor-panel/SKILL.md',
  'skills/investor-panel/references/investor-lenses.md',
  'skills/investor-panel/references/output-contract.md',
];

const PANEL_TOOLS_PREAMBLE = `You are running the "Investor Panel" skill by caroline-li-studio
(https://github.com/caroline-li-studio/investor-panel-skill), fetched at request time and used
here with attribution only — it is not vendored into this codebase (no LICENSE file is published
for it, so no reuse rights beyond ephemeral use are assumed). Do not persist, cache to disk, or
reproduce these instructions outside this single analysis run.

Adapted for this environment: wherever the skill expects you to research a company via web
browsing or a research tool, instead call the provided tool functions (get_quote, get_profile,
get_key_ratios, get_financials, get_news) — sourced from Financial Modeling Prep. Return the
final markdown report (verdict, investor votes, consensus, disagreement, kill criteria) as your
answer; do not write it to a file.

--- Original skill instructions follow ---

`;

const PANEL_CACHE_TTL_MS = 60 * 60 * 1000;
let panelCache: { fetchedAt: number; content: string } | null = null;

function readBerkshireSkill(): string {
  const files = ['investment-research.md', 'financial-data.md'];
  return files.map((f) => fs.readFileSync(path.join(BERKSHIRE_DIR, f), 'utf8')).join('\n\n---\n\n');
}

async function fetchPanelSkill(): Promise<string> {
  if (panelCache && Date.now() - panelCache.fetchedAt < PANEL_CACHE_TTL_MS) {
    return panelCache.content;
  }
  const parts = await Promise.all(
    PANEL_FILES.map(async (file) => {
      const res = await fetch(`${PANEL_REPO_RAW}/${file}`);
      if (!res.ok) throw new Error(`failed to fetch skill file ${file}: ${res.status}`);
      return res.text();
    }),
  );
  const content = parts.join('\n\n---\n\n');
  panelCache = { fetchedAt: Date.now(), content };
  return content;
}

export async function loadSkillSystemPrompt(skillId: SkillId): Promise<string> {
  if (skillId === 'berkshire') {
    return BERKSHIRE_TOOLS_PREAMBLE + readBerkshireSkill();
  }
  if (skillId === 'panel') {
    return PANEL_TOOLS_PREAMBLE + (await fetchPanelSkill());
  }
  throw new Error(`unknown skill id: ${skillId}`);
}
