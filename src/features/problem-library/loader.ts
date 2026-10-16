import type { z } from 'zod';
import {
  ProblemSchema,
  ReferenceArchitecturesSchema,
  ScenariosSchema,
  type Problem,
  type ProblemPack,
} from './schema';

type RawLoader = () => Promise<string>;

// Each pack is loaded lazily and independently, so adding a folder under content/problems is enough.
const files = import.meta.glob('/content/problems/*/*', {
  query: '?raw',
  import: 'default',
}) as Record<string, RawLoader>;

export interface ProblemListing {
  id: string;
  problem?: Problem;
  error?: string;
}

function packFile(id: string, name: string): RawLoader | undefined {
  return files[`/content/problems/${id}/${name}`];
}

function packIds(source: Record<string, unknown> = files): string[] {
  const ids = new Set<string>();
  for (const path of Object.keys(source)) {
    const id = path.split('/')[3];
    if (id) ids.add(id);
  }
  return [...ids].sort();
}

async function readJson<S extends z.ZodType>(
  id: string,
  name: string,
  schema: S,
): Promise<z.infer<S>> {
  const loader = packFile(id, name);
  if (!loader) throw new Error(`${name} is missing`);
  let json: unknown;
  try {
    json = JSON.parse(await loader());
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `${name} is invalid at ${issue?.path.join('.') || 'root'}: ${issue?.message ?? ''}`,
    );
  }
  return result.data;
}

export async function loadProblemPack(id: string): Promise<ProblemPack> {
  const problem = await readJson(id, 'problem.json', ProblemSchema);
  if (problem.id !== id)
    throw new Error(`problem.json id "${problem.id}" does not match folder "${id}"`);
  const knowledgeLoader = packFile(id, 'knowledge.md');
  const refs = await readJson(id, 'reference-architectures.json', ReferenceArchitecturesSchema);
  const scenarios = await readJson(id, 'scenarios.json', ScenariosSchema);
  return {
    problem,
    knowledge: knowledgeLoader ? await knowledgeLoader() : '',
    referenceArchitectures: refs.architectures,
    scenarios: scenarios.scenarios,
  };
}

// Incomplete packs are reported rather than hidden so contributors can fix them.
export async function listProblems(): Promise<ProblemListing[]> {
  return Promise.all(
    packIds().map(async (id): Promise<ProblemListing> => {
      try {
        const problem = await readJson(id, 'problem.json', ProblemSchema);
        if (!packFile(id, 'scenarios.json') || !packFile(id, 'reference-architectures.json')) {
          return {
            id,
            error: 'Pack is incomplete: scenarios.json or reference-architectures.json is missing',
          };
        }
        return { id, problem };
      } catch (e) {
        return { id, error: e instanceof Error ? e.message : 'Unknown error' };
      }
    }),
  );
}
