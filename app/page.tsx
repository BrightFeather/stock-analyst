'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './page.module.css';

type SkillId = 'berkshire' | 'panel';

interface ReportRow {
  id: number;
  ticker: string;
  skill: SkillId;
  report_date: string;
  created_at: string;
}

const SKILL_LABELS: Record<SkillId, string> = {
  berkshire: 'Berkshire deep research (Buffett/Munger/Duan/Li Lu)',
  panel: 'Investor Panel (26-lens debate)',
};

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [skill, setSkill] = useState<SkillId>('berkshire');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [history, setHistory] = useState<ReportRow[]>([]);

  async function loadHistory(forTicker: string) {
    if (!forTicker) return;
    const res = await fetch(`/api/reports?ticker=${encodeURIComponent(forTicker)}`);
    const data = await res.json();
    if (res.ok) setHistory(data.reports ?? []);
  }

  useEffect(() => {
    if (ticker.trim().length >= 1) {
      const t = setTimeout(() => loadHistory(ticker.trim().toUpperCase()), 400);
      return () => clearTimeout(t);
    }
  }, [ticker]);

  async function analyze() {
    setLoading(true);
    setError(null);
    setMarkdown(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, skill }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'analysis failed');
      setMarkdown(data.markdown);
      loadHistory(ticker.trim().toUpperCase());
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function loadReport(id: number) {
    const res = await fetch(`/api/reports/${id}`);
    const data = await res.json();
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
                {id === 'berkshire' ? 'Berkshire' : 'Panel'}
              </button>
            ))}
          </div>
          <button className={styles.button} disabled={!ticker || loading} onClick={analyze}>
            Analyze →
          </button>
          {loading && (
            <span className={styles.status}>
              <span className={styles.statusDot} />
              analyzing {ticker.trim().toUpperCase()}…
            </span>
          )}
        </div>

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
                        <div className={styles.historyDate}>{r.report_date}</div>
                        <div className={styles.historyTicker}>{r.ticker}</div>
                        <span className={`${styles.pill} ${r.skill === 'berkshire' ? styles.pillBerkshire : styles.pillPanel}`}>
                          {r.skill === 'berkshire' ? 'BERKSHIRE' : 'PANEL'}
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
