// The load and concern the interviewer holds the candidate's design to at each step of a
// progressive interview. Figures are illustrative multipliers, not requirements of any one problem.
export interface GrowthStage {
  id: string;
  label: string;
  // What changes at this stage; sent to the interviewer and shown to the candidate.
  description: string;
}

export const GROWTH_STAGES: readonly GrowthStage[] = [
  {
    id: 'baseline',
    label: 'Baseline',
    description:
      'A handful of users and low traffic. Aim for the simplest design that meets the functional requirements, with no premature scaling.',
  },
  {
    id: 'growth',
    label: 'Growth',
    description:
      'Roughly 100 times the baseline load. Find the first bottleneck and fix it with the smallest sensible change.',
  },
  {
    id: 'scale',
    label: 'Scale',
    description:
      'Roughly 10,000 times the baseline, with many concurrent users. Data volume, hot spots, caching, partitioning, and asynchronous work start to matter.',
  },
  {
    id: 'resilience',
    label: 'Resilience and reach',
    description:
      'Multiple regions, dependency outages, and operational concerns such as deploys, monitoring, and cost.',
  },
];

export function stageAt(index: number): GrowthStage {
  const clamped = Math.max(0, Math.min(GROWTH_STAGES.length - 1, Math.trunc(index)));
  return GROWTH_STAGES[clamped]!;
}
