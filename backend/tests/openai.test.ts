import test from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { OpenAIService } from '../src/ai.js';
import { AppError } from '../src/errors.js';
import { config, page, png } from './helpers.js';

function sdkWithResponse(output: unknown, options: { status?: string; refusal?: boolean; httpStatus?: number; rejectTemperature?: boolean; errorParam?: string; errorCode?: string } = {}) {
  const requests: Record<string, unknown>[] = [];
  const client = new OpenAI({ apiKey: 'test-placeholder-no-external-request', maxRetries: 0, fetch: async (_url, init) => {
    requests.push(JSON.parse(init?.body as string));
    if (options.httpStatus || (options.rejectTemperature && 'temperature' in requests.at(-1)!)) return new Response(JSON.stringify({ error: { message: 'Test provider error', type: 'test_error', param: options.errorParam ?? 'temperature', code: options.errorCode ?? 'unsupported_parameter' } }), { status: options.httpStatus ?? 400, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({
      id: 'resp_test', object: 'response', created_at: 1, status: options.status || 'completed', model: config.model,
      output: [{ id: 'msg_test', type: 'message', role: 'assistant', status: 'completed', content: [options.refusal ? { type: 'refusal', refusal: 'Test refusal' } : { type: 'output_text', text: JSON.stringify(output), annotations: [] }] }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } });
  return { ai: new OpenAIService(config, client), requests };
}
test('real SDK transport uses Responses Vision, high detail, strict schema and store false', async () => {
  const { ai, requests } = sdkWithResponse({ status: 'readable', text: page.text, warning: null });
  const result = await ai.extract({ id: 'page-1', dataUrl: png }, 1);
  assert.equal(result.text, page.text);
  assert.equal(requests.length, 1);
  const body = requests[0]!;
  assert.equal(body.model, config.model);
  assert.equal(body.store, false);
  assert.equal(body.temperature, 0);
  const format = (body.text as { format: { type: string; strict: boolean; schema: { additionalProperties: boolean } } }).format;
  assert.equal(format.type, 'json_schema');
  assert.equal(format.strict, true);
  assert.equal(format.schema.additionalProperties, false);
  const input = body.input as { content: { type: string; detail?: string; image_url?: string }[] }[];
  assert.equal(input[0]!.content[1]!.type, 'input_image');
  assert.equal(input[0]!.content[1]!.image_url, png);
  assert.equal(input[0]!.content[1]!.detail, 'high');
});
test('only explicit unsupported temperature errors fall back, then the model capability is remembered', async () => {
  for (const errorCode of ['unsupported_parameter', 'unsupported_value']) {
    const { ai, requests } = sdkWithResponse({ status: 'readable', text: page.text, warning: null }, { rejectTemperature: true, errorCode });
    await ai.extract({ id: 'page-1', dataUrl: png }, 1);
    await ai.extract({ id: 'page-2', dataUrl: png }, 2);
    assert.equal(requests.length, 3);
    assert.equal(requests[0]!.temperature, 0);
    assert.equal('temperature' in requests[1]!, false);
    assert.equal('temperature' in requests[2]!, false);
    assert.equal(requests[1]!.store, false);
  }
  for (const options of [{ httpStatus: 400, errorParam: 'input', errorCode: 'unsupported_value' }, { httpStatus: 400, errorParam: 'temperature', errorCode: 'other_error' }, { httpStatus: 401 }, { httpStatus: 429 }]) {
    const { ai, requests } = sdkWithResponse({}, options);
    await assert.rejects(ai.extract({ id: 'page-1', dataUrl: png }, 1), AppError);
    assert.equal(requests.length, 1);
  }
});
test('SDK refusal, incomplete output and authentication/quota errors are explicit', async () => {
  const cases = [
    { settings: { refusal: true }, code: 'AI_REFUSED', status: 422 },
    { settings: { status: 'incomplete' }, code: 'AI_INCOMPLETE', status: 502 },
    { settings: { httpStatus: 401 }, code: 'AI_AUTH_ERROR', status: 503 },
    { settings: { httpStatus: 429 }, code: 'AI_RATE_LIMIT', status: 429 },
  ];
  for (const item of cases) {
    const { ai } = sdkWithResponse({ status: 'readable', text: page.text, warning: null }, item.settings);
    await assert.rejects(() => ai.extract({ id: 'page-1', dataUrl: png }, 1), (error: unknown) => error instanceof AppError && error.code === item.code && error.status === item.status);
  }
});
test('schema-invalid provider content never becomes a report', async () => {
  const { ai } = sdkWithResponse({ status: 'readable', text: 123, warning: null });
  await assert.rejects(() => ai.extract({ id: 'page-1', dataUrl: png }, 1), (error: unknown) => error instanceof AppError && error.code === 'AI_INVALID_RESPONSE');
});
