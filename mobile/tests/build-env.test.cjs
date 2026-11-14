const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBuildEnvironment } = require('../scripts/check-build-env.cjs');

test('release builds reject missing, local, placeholder and credential-bearing backend URLs', () => {
  for (const url of ['', 'http://rentguard-api.onrender.com', 'https://localhost', 'https://127.0.0.1', 'https://192.168.1.10', 'https://[::1]', 'https://api.example.com', 'https://rentguard.example', 'https://rentguard.test', 'https://your-api.onrender.com', 'https://user:pass@rentguard-api.onrender.com', 'https://rentguard-api.onrender.com/api/health']) {
    assert.throws(() => validateBuildEnvironment({ EXPO_PUBLIC_REQUIRE_HTTPS: 'true', EXPO_PUBLIC_API_URL: url }));
  }
  assert.doesNotThrow(() => validateBuildEnvironment({ EXPO_PUBLIC_REQUIRE_HTTPS: 'true', EXPO_PUBLIC_API_URL: 'https://rentguard-api.onrender.com' }));
  assert.doesNotThrow(() => validateBuildEnvironment({ EXPO_PUBLIC_REQUIRE_HTTPS: 'false', EXPO_PUBLIC_API_URL: 'http://localhost:4000' }));
});
test('private keys cannot be exposed via public mobile variables, even for local builds', () => {
  for (const name of ['EXPO_PUBLIC_OPENAI_API_KEY', 'EXPO_PUBLIC_REPORT_SIGNING_SECRET', 'EXPO_PUBLIC_API_KEY']) assert.throws(() => validateBuildEnvironment({ [name]: 'test-placeholder-not-a-real-key' }), /Private credentials/);
});
