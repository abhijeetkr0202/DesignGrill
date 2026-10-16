import { AIError } from './errors';

// Models sometimes wrap JSON in prose or code fences. Extract the first balanced top-level object.
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  if (start === -1) throw new AIError('malformed-response', 'no JSON object found');

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try {
        return JSON.parse(candidate.slice(start, i + 1));
      } catch {
        throw new AIError('malformed-response', 'JSON could not be parsed');
      }
    }
  }
  throw new AIError('malformed-response', 'JSON object was not closed');
}
