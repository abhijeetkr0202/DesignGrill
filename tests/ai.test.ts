import { describe, expect, it, vi } from 'vitest';
import { AIError, classifyHttpError, fromBackendError, redact } from '@/ai/errors';
import { extractJson } from '@/ai/json';
import { normalizeEndpoint } from '@/ai/endpoint';
import { createProvider } from '@/ai/provider-registry';
import { AnthropicProvider } from '@/ai/providers/anthropic';
import { OpenAIProvider } from '@/ai/providers/openai';
import { withRetry } from '@/ai/retry';
import { ReviewResponseSchema } from '@/ai/schemas/responses';
import { completeStructured } from '@/ai/structured';
import { FakeProvider, FakeTransport } from './helpers';

describe('extractJson', () => {
  it('parses plain, fenced and prose-wrapped JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":{"b":"}"}}\n```')).toEqual({ a: { b: '}' } });
    expect(extractJson('Sure! Here you go: {"a":1} hope it helps')).toEqual({ a: 1 });
  });

  it('rejects text without a complete object', () => {
    expect(() => extractJson('no json')).toThrow(AIError);
    expect(() => extractJson('{"a": 1')).toThrow(AIError);
  });
});

describe('error handling', () => {
  it('redacts credentials from messages', () => {
    const msg = redact(
      'Incorrect API key provided: sk-abc123def456ghi. Authorization: Bearer abcdefghijkl',
    );
    expect(msg).not.toContain('sk-abc123');
    expect(msg).not.toContain('abcdefghijkl');
    const err = new AIError('unknown', 'key sk-ant-secret1234567 leaked');
    expect(err.message).not.toContain('secret1234567');
  });

  it('classifies HTTP failures into actionable kinds', () => {
    expect(classifyHttpError(401, '{"error":{"message":"bad key"}}').kind).toBe(
      'invalid-credentials',
    );
    expect(classifyHttpError(429, '', 7)).toMatchObject({
      kind: 'rate-limit',
      retryable: true,
      retryAfterMs: 7000,
    });
    expect(classifyHttpError(503, 'gateway').kind).toBe('provider-outage');
    expect(classifyHttpError(404, '{"error":{"message":"The model does not exist"}}').kind).toBe(
      'unsupported-model',
    );
    expect(classifyHttpError(400, '{"error":{"message":"Invalid model"}}').kind).toBe(
      'unsupported-model',
    );
    expect(classifyHttpError(418, 'teapot').kind).toBe('unknown');
  });

  it('maps native errors and never retries non-transient ones', () => {
    expect(fromBackendError({ kind: 'missing-key', message: 'x' }).kind).toBe('missing-key');
    expect(fromBackendError({ kind: 'timeout', message: 'x' }).retryable).toBe(false);
    expect(fromBackendError({ kind: 'network', message: 'x' }).retryable).toBe(true);
    expect(fromBackendError('weird').kind).toBe('unknown');
  });
});

describe('withRetry', () => {
  const sleep = vi.fn(async () => undefined);

  it('retries transient errors a bounded number of times', async () => {
    const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new AIError('rate-limit'));
    await expect(withRetry(fn, { maxAttempts: 3, sleep })).rejects.toMatchObject({
      kind: 'rate-limit',
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('recovers when a later attempt succeeds', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new AIError('provider-outage'))
      .mockResolvedValue('ok');
    await expect(withRetry(fn, { sleep })).resolves.toBe('ok');
  });

  it('does not retry invalid credentials, timeouts or unknown errors', async () => {
    for (const kind of ['invalid-credentials', 'timeout', 'unknown'] as const) {
      const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new AIError(kind));
      await expect(withRetry(fn, { sleep })).rejects.toBeInstanceOf(AIError);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });
});

describe('providers', () => {
  it('OpenAI sends chat completions and reads the message', async () => {
    const transport = new FakeTransport([
      {
        status: 200,
        body: JSON.stringify({
          model: 'm1',
          choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        }),
      },
    ]);
    const res = await new OpenAIProvider(transport).complete({
      model: 'm1',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      maxOutputTokens: 100,
      json: true,
    });
    expect(res).toEqual({ text: '{"ok":true}', model: 'm1', truncated: false });
    const sent = transport.sent[0]!;
    expect(sent).toMatchObject({
      provider: 'openai',
      method: 'POST',
      path: '/v1/chat/completions',
    });
    expect(sent.body).toMatchObject({
      model: 'm1',
      max_completion_tokens: 100,
      response_format: { type: 'json_object' },
    });
    expect(JSON.stringify(sent)).not.toMatch(/authorization|api[-_]?key/i);
  });

  it('OpenAI flags truncated output and malformed bodies', async () => {
    const truncated = new FakeTransport([
      {
        status: 200,
        body: JSON.stringify({
          choices: [{ message: { content: '{"a"' }, finish_reason: 'length' }],
        }),
      },
    ]);
    const res = await new OpenAIProvider(truncated).complete({
      model: 'm',
      system: '',
      messages: [],
      maxOutputTokens: 1,
    });
    expect(res.truncated).toBe(true);
    const bad = new FakeTransport([{ status: 200, body: '<html>' }]);
    await expect(
      new OpenAIProvider(bad).complete({
        model: 'm',
        system: '',
        messages: [],
        maxOutputTokens: 1,
      }),
    ).rejects.toMatchObject({ kind: 'malformed-response' });
  });

  it('Anthropic uses the messages API and joins text blocks', async () => {
    const transport = new FakeTransport([
      {
        status: 200,
        body: JSON.stringify({
          model: 'c1',
          stop_reason: 'end_turn',
          content: [
            { type: 'text', text: '{"a":' },
            { type: 'text', text: '1}' },
          ],
        }),
      },
    ]);
    const res = await new AnthropicProvider(transport).complete({
      model: 'c1',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      maxOutputTokens: 50,
    });
    expect(res.text).toBe('{"a":1}');
    expect(transport.sent[0]).toMatchObject({ provider: 'anthropic', path: '/v1/messages' });
    expect(transport.sent[0]?.body).toMatchObject({ system: 'sys', max_tokens: 50 });
  });

  it('classifies provider errors and lists models', async () => {
    const transport = new FakeTransport([
      { status: 401, body: '{"error":{"message":"invalid x-api-key"}}' },
      { status: 200, body: JSON.stringify({ data: [{ id: 'b' }, { id: 'a' }, { id: 'a' }] }) },
    ]);
    const provider = new AnthropicProvider(transport);
    await expect(provider.testConnection()).rejects.toMatchObject({ kind: 'invalid-credentials' });
    await expect(provider.listModels()).resolves.toEqual(['a', 'b']);
  });

  it('custom provider targets the configured endpoint with compatible parameters', async () => {
    const transport = new FakeTransport([
      {
        status: 200,
        body: JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        }),
      },
    ]);
    const provider = createProvider('custom', transport, {
      baseUrl: 'https://llm.example.com/api',
    });
    expect(provider.id).toBe('custom');
    await provider.complete({
      model: 'any-model',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      maxOutputTokens: 77,
      json: true,
    });
    const sent = transport.sent[0]!;
    expect(sent).toMatchObject({
      provider: 'custom',
      baseUrl: 'https://llm.example.com/api',
      path: '/v1/chat/completions',
    });
    expect(sent.body).toMatchObject({ model: 'any-model', max_tokens: 77 });
    expect(sent.body).not.toHaveProperty('response_format');
    expect(sent.body).not.toHaveProperty('max_completion_tokens');
  });

  it('custom provider refuses to send anything without an endpoint', async () => {
    const transport = new FakeTransport([]);
    const provider = createProvider('custom', transport);
    await expect(provider.testConnection()).rejects.toMatchObject({ kind: 'invalid-endpoint' });
    expect(transport.sent).toHaveLength(0);
  });
});

describe('normalizeEndpoint', () => {
  it('accepts https and loopback http, trimming slashes and a trailing /v1', () => {
    expect(normalizeEndpoint(' https://openrouter.ai/api/v1/ ')).toEqual({
      ok: true,
      url: 'https://openrouter.ai/api',
    });
    expect(normalizeEndpoint('https://api.example.com')).toEqual({
      ok: true,
      url: 'https://api.example.com',
    });
    expect(normalizeEndpoint('http://localhost:11434/v1')).toEqual({
      ok: true,
      url: 'http://localhost:11434',
    });
  });

  it('rejects unsafe or malformed endpoints', () => {
    for (const bad of [
      '',
      'not a url',
      'ftp://example.com',
      'http://api.example.com',
      'http://localhost.evil.example',
      'https://user:pw@example.com',
      'https://example.com/api?x=1',
      'https://example.com/a%20b',
      `https://example.com/${'a'.repeat(200)}`,
    ]) {
      expect(normalizeEndpoint(bad).ok, bad).toBe(false);
    }
  });
});

describe('completeStructured', () => {
  const validReview = JSON.stringify({
    overview: 'ok',
    findings: [
      {
        kind: 'Conditional',
        severity: 'HIGH',
        title: 'Hot key',
        reasoning: 'r',
        confidence: 'Medium',
      },
    ],
  });

  it('validates and normalises model output', async () => {
    const provider = new FakeProvider([`\`\`\`json\n${validReview}\n\`\`\``]);
    const parsed = await completeStructured(
      provider,
      { model: 'm', system: 's', messages: [], maxOutputTokens: 10 },
      ReviewResponseSchema,
    );
    expect(parsed.findings[0]).toMatchObject({
      kind: 'conditional',
      severity: 'high',
      confidence: 'medium',
    });
    expect(parsed.findings[0]?.mitigations).toEqual([]);
  });

  it('asks once more after malformed output, with the problem described', async () => {
    const provider = new FakeProvider(['not json at all', validReview]);
    await completeStructured(
      provider,
      { model: 'm', system: 's', messages: [{ role: 'user', content: 'u' }], maxOutputTokens: 10 },
      ReviewResponseSchema,
    );
    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[1]?.messages.at(-1)?.content).toMatch(/could not be used/);
  });

  it('fails with malformed-response after the repair attempt', async () => {
    const provider = new FakeProvider(['nope', '{"overview": 5}']);
    await expect(
      completeStructured(
        provider,
        { model: 'm', system: 's', messages: [], maxOutputTokens: 10 },
        ReviewResponseSchema,
      ),
    ).rejects.toMatchObject({ kind: 'malformed-response' });
  });

  it('rejects out-of-range enum values rather than accepting arbitrary strings', async () => {
    const bad = JSON.stringify({
      overview: 'x',
      findings: [
        {
          kind: 'structural',
          severity: 'apocalyptic',
          title: 't',
          reasoning: 'r',
          confidence: 'high',
        },
      ],
    });
    const provider = new FakeProvider([bad, bad]);
    await expect(
      completeStructured(
        provider,
        { model: 'm', system: 's', messages: [], maxOutputTokens: 10 },
        ReviewResponseSchema,
      ),
    ).rejects.toMatchObject({ kind: 'malformed-response' });
  });
});
