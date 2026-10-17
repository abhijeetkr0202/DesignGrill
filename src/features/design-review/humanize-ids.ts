import type { SessionDocument } from '@/types/session';

// Internal ids look like req_1a2b3c4d5e6f7a8b. Readers should see names, never these.
const ID = String.raw`(?:node|edge|req|dec|fnd|rev|drw|msg|q|sum|arch)_[A-Za-z0-9]+`;
const STRICT_ID = /^(?:node|edge|req|dec|fnd|rev|drw|msg|q|sum|arch)_[a-f0-9]{16}$/;
const PARENTHETICAL = new RegExp(String.raw`\s*[(\[]\s*(${ID}(?:\s*[,;]\s*${ID})*)\s*[)\]]`, 'g');
const BARE = new RegExp(String.raw`\b${ID}\b`, 'g');

export function buildIdNames(doc: SessionDocument): Map<string, string> {
  const names = new Map<string, string>();
  const nodeLabel = new Map(doc.architecture.nodes.map((n) => [n.id, n.label]));
  for (const [id, label] of nodeLabel) names.set(id, label);
  for (const e of doc.architecture.edges) {
    const from = nodeLabel.get(e.source) ?? 'a component';
    const to = nodeLabel.get(e.target) ?? 'a component';
    names.set(e.id, e.label ? `${from} → ${to} (${e.label})` : `${from} → ${to}`);
  }
  for (const r of doc.requirements) names.set(r.id, r.title);
  for (const d of doc.decisions) names.set(d.id, d.title);
  for (const f of doc.findings) names.set(f.id, f.title);
  return names;
}

// A parenthetical that only holds ids is dropped, since the sentence already names the thing
// ("the cache requirement (req_1)"). Ids elsewhere in a sentence are replaced by the name.
export function humanizeIds(text: string, names: Map<string, string>): string {
  const known = (id: string) => names.has(id) || STRICT_ID.test(id);
  const withoutParentheticals = text.replace(PARENTHETICAL, (whole, inner: string) => {
    const ids = inner.split(/\s*[,;]\s*/);
    return ids.every(known) ? '' : whole;
  });
  return withoutParentheticals.replace(BARE, (id) => names.get(id) ?? id);
}

// Rewrites every string inside a value, for results made only of text and ids that are not
// listed in `names` (so ids in id fields are left alone).
export function humanizeDeep<T>(value: T, names: Map<string, string>): T {
  if (typeof value === 'string') return humanizeIds(value, names) as T;
  if (Array.isArray(value)) return value.map((v) => humanizeDeep(v, names)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, humanizeDeep(v, names)]),
    ) as T;
  }
  return value;
}
