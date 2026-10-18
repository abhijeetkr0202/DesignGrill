// The four phases of the interview. The interviewer works out the earliest unfinished one from
// the session, and the candidate can choose to move on before the interviewer thinks they are ready.
export const INTERVIEW_PHASES = [
  'requirements',
  'high-level-design',
  'deep-dive',
  'failure-and-scale',
] as const;

export type InterviewPhase = (typeof INTERVIEW_PHASES)[number];

export const PHASE_LABELS: Record<InterviewPhase, string> = {
  requirements: 'Requirements',
  'high-level-design': 'High-level design',
  'deep-dive': 'Architecture interrogation',
  'failure-and-scale': 'Failure and trade-offs',
};

export function phaseIndex(phase: InterviewPhase): number {
  return INTERVIEW_PHASES.indexOf(phase);
}
