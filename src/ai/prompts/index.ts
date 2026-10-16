import system from './interviewer-system.md?raw';
import discovery from './requirements-discovery.md?raw';
import interview from './architecture-interview.md?raw';
import review from './architecture-review.md?raw';
import scenario from './failure-scenario.md?raw';
import evaluation from './answer-evaluation.md?raw';
import summary from './session-summary.md?raw';
import rubric from './scoring-rubric.md?raw';
import type { InterviewMode } from '@/types/session';

export type TaskKind = InterviewMode | 'answer-evaluation';

export const PROMPT_VERSION = 1;

const TASKS: Record<TaskKind, string> = {
  'requirements-discovery': discovery,
  'architecture-interview': interview,
  'architecture-review': review,
  'failure-scenario': scenario,
  'answer-evaluation': evaluation,
  'session-summary': `${summary}\n\n${rubric}`,
};

export function buildSystemPrompt(task: TaskKind): string {
  return `${system.trim()}\n\n${TASKS[task].trim()}`;
}
