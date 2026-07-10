'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './page.module.css';

type SkillId = 'berkshire' | 'panel' | 'uzi';
type JobMode = 'lite' | 'medium' | 'deep';

interface ReportRow {
  id: number;
  ticker: string;
  skill: SkillId;
  report_date: string;
  created_at: string;
}

interface JobRow {
  id: number;
  ticker: string;
  skill: SkillId;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  report_id: number | null;
  error: string | null;
}

const SKILL_LABELS: Record<SkillId, string> = {
  berkshire: 'Berkshire deep research (Buffett/Munger/Duan/Li Lu)',
  panel: 'Investor Panel (26-lens debate)',
  uzi: 'UZI deep analysis (66 personas, deterministic scoring)',
};

const SKILL_SHORT: Record<SkillId, string> = {
  berkshire: 'Berkshire',
  panel: 'Panel',
  uzi: 'UZI',
};

const MODES: { id: JobMode; label: string; hint: string }[] = [
  { id: 'lite', label: 'Lite', hint: '~1-2 min' },
  { id: 'medium', label: 'Medium', hint: '~5-8 min' },
  { id: 'deep', label: 'Deep', hint: '~15-20 min' },
];

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [skill, setSkill] = useState<SkillId>('berkshire');
  const [mode, setMode] = useState<JobMode>('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [job, setJob] = useState<JobRow | null>(null);
  const [history, setHistory] = useState<ReportRow[]>([]);

  async function loadHistory() {
    const res = await fetch('/api/reports');
    const data = await res.json();
    if (res.ok) setHistory(data.reports ?? []);
  }

  // Archive shows the full report history, independent of the ticker input.
  useEffect(() => {
    loadHistory();
  }, []);

  // Poll an async (uzi) job until it finishes, then load its report.
  async function pollJob(jobId: number) {
    const res = await fetch(`/api/jobs/${jobId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'job lookup failed');
      setLoading(false);
      return;
    }
    const j: JobRow = data.job;
    setJob(j);
    if (j.status === 'succeeded' && j.report_id) {
      await loadReport(j.report_id);
      loadHistory();
      setLoading(false);
    } else if (j.status === 'failed') {
      setError(j.error ?? 'analysis failed');
      setLoading(false);
    } else {
      setTimeout(() => pollJob(jobId), 3000);
    }
  }

  async function analyze() {
    setLoading(true);
    setError(null);
    setMarkdown(null);
    setJob(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, skill, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'analysis failed');

      if (res.status === 202 && data.jobId) {
        // uzi enqueued on the worker — poll for completion.
        setJob({ id: data.jobId, ticker, skill, status: data.status, report_id: null, error: null });
        pollJob(data.jobId);
        return;
      }

      setMarkdown(data.markdown);
      loadHistory();
      setLoading(false);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      setLoading(false);
    }
  }

  async function loadReport(id: number) {
    const res = await fetch(`/api/reports/${id}`);
    const data = await res.json();
    // NOTE: uzi reports are output_format 'html' — iframe rendering lands with
    // the worker phase; inline skills return markdown.
    if (res.ok) setMarkdown(data.report.markdown);
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.masthead}>
          <span className={styles.wordmark}>Stock Analyst</span>
          <span className={styles.tagline}>Ticker research · DeepSeek-driven</span>
        </div>
        <div className={styles.rule} />

        <div className={styles.controls}>
          <input
            className={styles.input}
            placeholder="TICKER"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
          />
          <div className={styles.segmented}>
            {(Object.keys(SKILL_LABELS) as SkillId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`${styles.segItem} ${skill === id ? styles.segItemActive : ''}`}
                onClick={() => setSkill(id)}
                title={SKILL_LABELS[id]}
              >
                {SKILL_SHORT[id]}
              </button>
            ))}
          </div>
          <button className={styles.button} disabled={!ticker || loading} onClick={analyze}>
            Analyze →
          </button>
          {loading && (
            <span className={styles.status}>
              <span className={styles.statusDot} />
              {job
                ? `${job.status} ${ticker.trim().toUpperCase()}…`
                : `analyzing ${ticker.trim().toUpperCase()}…`}
            </span>
          )}
        </div>

        {skill === 'uzi' && (
          <div className={styles.segmented}>
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`${styles.segItem} ${mode === m.id ? styles.segItemActive : ''}`}
                onClick={() => setMode(m.id)}
                title={m.hint}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.layout}>
          <div className={styles.history}>
            {history.length > 0 && (
              <>
                <div className={styles.historyLabel}>Archive</div>
                <ul>
                  {history.map((r) => (
                    <li key={r.id}>
                      <button className={styles.historyItem} onClick={() => loadReport(r.id)}>
                        <div className={styles.historyDate}>{r.report_date.slice(0, 10)}</div>
                        <div className={styles.historyTicker}>{r.ticker}</div>
                        <span className={`${styles.pill} ${r.skill === 'berkshire' ? styles.pillBerkshire : styles.pillPanel}`}>
                          {SKILL_SHORT[r.skill].toUpperCase()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {markdown && (
            <article className={styles.report}>
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </article>
          )}
        </div>
      </main>
    </div>
  );
}
