import { describe, expect, it } from 'vitest';
import { listProblems, loadProblemPack } from '@/features/problem-library/loader';

describe('problem library', () => {
  let ids: string[] = [];

  it('lists at least 50 problems, every pack validates, and ids are unique', async () => {
    const listing = await listProblems();
    ids = listing.map((p) => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(50);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of listing) expect(entry.error, entry.id).toBeUndefined();
    const difficulties = new Set(listing.map((p) => p.problem?.difficulty));
    expect(difficulties).toEqual(new Set(['easy', 'medium', 'hard']));
    for (const entry of listing) {
      expect(entry.problem?.category, entry.id).not.toBe('General');
    }
  });

  it('every pack has complete knowledge-pack content', async () => {
    const all = await listProblems();
    for (const { id } of all) {
      const pack = await loadProblemPack(id);
      const p = pack.problem;
      expect(p.requirementQuestions.length, id).toBeGreaterThanOrEqual(5);
      expect(p.workloadAssumptions.illustrativeNote.toLowerCase(), id).toContain('illustrative');
      expect(p.keyDecisions.length, id).toBeGreaterThanOrEqual(5);
      expect(p.tradeoffs.length, id).toBeGreaterThan(0);
      expect(p.commonMistakes.length, id).toBeGreaterThan(0);
      expect(p.followUps.length, id).toBeGreaterThan(0);
      expect(pack.referenceArchitectures.length, id).toBeGreaterThanOrEqual(2);
      expect(pack.scenarios.length, id).toBeGreaterThanOrEqual(3);
      expect(pack.knowledge, id).toMatch(/not a single mandatory solution/i);
    }
  });

  it('reports a missing pack instead of throwing an opaque error', async () => {
    await expect(loadProblemPack('nope')).rejects.toThrow(/missing/);
  });
});
