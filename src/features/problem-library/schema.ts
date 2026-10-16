import { z } from 'zod';

const text = (max = 4000) => z.string().min(1).max(max);
const list = (max = 1000) => z.array(text(max));

export const ProblemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive(),
  title: text(200),
  category: text(60).default('General'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  summary: text(600),
  statement: text(4000),
  tags: list(60).default([]),
  initialGuidance: list(),
  coreFunctionalRequirements: list(),
  requirementQuestions: z.array(
    z.object({ id: text(80), area: text(80), question: text(), whyItMatters: text() }),
  ),
  workloadAssumptions: z.object({
    illustrativeNote: text(),
    items: z.array(z.object({ name: text(120), value: text(200), rationale: text() })),
  }),
  estimationPrompts: list(),
  keyDecisions: z.array(
    z.object({ id: text(80), topic: text(120), question: text(), considerations: list() }),
  ),
  tradeoffs: z.array(z.object({ topic: text(120), tension: text() })),
  commonMistakes: list(),
  followUps: list(),
  topics: list(120),
});
export type Problem = z.infer<typeof ProblemSchema>;

export const ReferenceArchitecturesSchema = z.object({
  architectures: z.array(
    z.object({
      id: text(80),
      name: text(200),
      summary: text(),
      components: list(200),
      bestWhen: text(),
      drawbacks: list(),
    }),
  ),
});
export type ReferenceArchitecture = z.infer<
  typeof ReferenceArchitecturesSchema
>['architectures'][number];

export const ScenariosSchema = z.object({
  scenarios: z.array(
    z.object({
      id: text(80),
      title: text(200),
      description: text(),
      triggers: list(),
      probes: list(),
      relatedTopics: list(120),
    }),
  ),
});
export type Scenario = z.infer<typeof ScenariosSchema>['scenarios'][number];

export interface ProblemPack {
  problem: Problem;
  knowledge: string;
  referenceArchitectures: ReferenceArchitecture[];
  scenarios: Scenario[];
}
