import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

test('invalid reasoning and unsupported Sol none effort fail at startup; legacy models can omit reasoning', () => {
  const names = ['OPENAI_MODEL', 'OPENAI_REASONING_EFFORT', 'OPENAI_ANALYSIS_REASONING_EFFORT', 'REPORT_SIGNING_SECRET'] as const;
  const previous = names.map(name => process.env[name]);
  try {
    process.env.REPORT_SIGNING_SECRET = 'config-test-only-secret-at-least-32-characters';
    process.env.OPENAI_MODEL = 'gpt-6.1-sol';
    process.env.OPENAI_REASONING_EFFORT = 'low';
    process.env.OPENAI_ANALYSIS_REASONING_EFFORT = 'medium';
    const balanced = loadConfig();
    assert.equal(balanced.reasoningEffort, 'low'); assert.equal(balanced.analysisReasoningEffort, 'medium');
    process.env.OPENAI_ANALYSIS_REASONING_EFFORT = 'invented';
    assert.throws(loadConfig, /Invalid OPENAI_ANALYSIS_REASONING_EFFORT/);
    process.env.OPENAI_ANALYSIS_REASONING_EFFORT = 'none';
    assert.throws(loadConfig, /does not support/);
    process.env.OPENAI_MODEL = 'gpt-4.1-mini';
    process.env.OPENAI_REASONING_EFFORT = '';
    process.env.OPENAI_ANALYSIS_REASONING_EFFORT = '';
    assert.equal(loadConfig().reasoningEffort, undefined);
    assert.equal(loadConfig().analysisReasoningEffort, undefined);
  } finally { names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; }); }
});
