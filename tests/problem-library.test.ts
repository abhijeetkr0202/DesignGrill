import { describe, expect, it } from 'vitest';
import { listProblems, loadProblemPack } from '@/features/problem-library/loader';

describe('problem library', () => {
  it('lists the three bundled problems and every pack validates', async () => {
    const listing = await listProblems();
    expect(listing.map((p) => p.id)).toEqual([
      'notification-system',
      'shopping-cart',
      'url-shortener',
    ]);
    for (const entry of listing) expect(entry.error, entry.id).toBeUndefined();
  });

  it.each(['url-shortener', 'notification-system', 'shopping-cart'])(
    '%s has complete knowledge-pack content',
    async (id) => {
      const pack = await loadProblemPack(id);
      const p = pack.problem;
      expect(p.requirementQuestions.length).toBeGreaterThanOrEqual(5);
      expect(p.workloadAssumptions.illustrativeNote.toLowerCase()).toContain('illustrative');
      expect(p.keyDecisions.length).toBeGreaterThanOrEqual(5);
      expect(p.tradeoffs.length).toBeGreaterThan(0);
      expect(p.commonMistakes.length).toBeGreaterThan(0);
      expect(p.followUps.length).toBeGreaterThan(0);
      expect(pack.referenceArchitectures.length).toBeGreaterThanOrEqual(2);
      expect(pack.scenarios.length).toBeGreaterThanOrEqual(3);
      expect(pack.knowledge).toMatch(/not a single mandatory solution/i);
    },
  );

  it('reports a missing pack instead of throwing an opaque error', async () => {
    await expect(loadProblemPack('nope')).rejects.toThrow(/missing/);
  });
});
