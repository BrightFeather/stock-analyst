import type { SkillId } from './skills/loader';

export type JobMode = 'lite' | 'medium' | 'deep';
export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export const UZI_MODES: JobMode[] = ['lite', 'medium', 'deep'];
export const DEFAULT_UZI_MODE: JobMode = 'medium';

// berkshire/panel run inline via the LLM agent (synchronous, fits one request).
// uzi is dispatched to an out-of-band worker through the analysis_jobs queue.
export const INLINE_SKILLS: SkillId[] = ['berkshire', 'panel'];
export const ALL_SKILLS: SkillId[] = ['berkshire', 'panel', 'uzi'];

export function isUziMode(v: unknown): v is JobMode {
  return typeof v === 'string' && (UZI_MODES as string[]).includes(v);
}
