import type { ProblemPack } from './schema';

export const CUSTOM_PROBLEM_ID = 'custom';

// Custom sessions have no bundled content; the user's own title and statement take its place.
export function buildCustomPack(title: string): ProblemPack {
  return {
    problem: {
      id: CUSTOM_PROBLEM_ID,
      version: 1,
      title,
      category: 'Custom',
      difficulty: 'medium',
      summary: 'A problem you defined yourself.',
      statement: '',
      tags: [],
      initialGuidance: [
        'Describe the problem you want to solve in the statement field.',
        'Write down the requirements and constraints you are designing against; the interviewer judges your design against them.',
        'Sketch the architecture, then ask for a question or a review.',
      ],
      coreFunctionalRequirements: [],
      requirementQuestions: [],
      workloadAssumptions: {
        illustrativeNote: 'No illustrative workload is provided for custom problems.',
        items: [],
      },
      estimationPrompts: [],
      keyDecisions: [],
      tradeoffs: [],
      commonMistakes: [],
      followUps: [],
      topics: [],
    },
    knowledge: '',
    referenceArchitectures: [],
    scenarios: [],
  };
}
