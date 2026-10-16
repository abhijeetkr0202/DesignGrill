import type { z } from 'zod';
import { AIError, isAIError } from './errors';
import { extractJson } from './json';
import type { AIProvider, CallOptions, CompletionRequest } from './provider-interface';
import { withRetry } from './retry';

export interface StructuredOptions extends CallOptions {
  retry?: Parameters<typeof withRetry>[1];
}

// Model output is untrusted: it must parse and validate before the app uses it. One repair attempt
// is made with the validation error as feedback; transient transport errors are retried separately.
export async function completeStructured<S extends z.ZodType>(
  provider: AIProvider,
  request: CompletionRequest,
  schema: S,
  options: StructuredOptions = {},
): Promise<z.infer<S>> {
  const call = (req: CompletionRequest) =>
    withRetry(() => provider.complete({ ...req, json: true }, options), {
      ...options.retry,
      signal: options.signal,
    });

  let lastProblem = '';
  let previous = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const req: CompletionRequest =
      attempt === 0
        ? request
        : {
            ...request,
            messages: [
              ...request.messages,
              { role: 'assistant', content: previous.slice(0, 6000) },
              {
                role: 'user',
                content: `Your previous reply could not be used (${lastProblem}). Reply again with only one valid JSON object that follows the required format.`,
              },
            ],
          };
    const result = await call(req);
    previous = result.text;
    if (result.truncated) {
      lastProblem = 'the reply was cut off by the output limit; be more concise';
      continue;
    }
    try {
      const parsed = schema.safeParse(extractJson(result.text));
      if (parsed.success) return parsed.data;
      const issue = parsed.error.issues[0];
      lastProblem = `invalid field "${issue?.path.join('.') || 'root'}": ${issue?.message ?? 'invalid'}`;
    } catch (e) {
      if (!isAIError(e)) throw e;
      lastProblem = 'it was not valid JSON';
    }
  }
  throw new AIError('malformed-response', lastProblem);
}
