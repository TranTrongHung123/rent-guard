const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Load the actual client module without React Native or an extra test runner.
// HTTP fixture tests exercise real Node fetch; the fixture never calls OpenAI.
function compile(relativePath, imports = {}, globals = {}) {
  const filename = path.join(path.dirname(require.resolve('../package.json')), relativePath);
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInNewContext(result.outputText, {
    exports: module.exports, module, URL, Error, TypeError, AbortController,
    fetch, setTimeout, clearTimeout,
    require: (specifier) => {
      if (!(specifier in imports)) throw new Error(`Unexpected test import: ${specifier}`);
      return imports[specifier];
    },
    ...globals,
  }, { filename });
  return module.exports;
}

const core = compile('src/domain/core.ts');
function client(fetchImplementation = fetch) {
  return compile('src/services/api.ts', { '@/domain/core': core }, { fetch: fetchImplementation });
}

async function fixtureServer(t, handler) {
  const server = http.createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch((error) => {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: String(error) } }));
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

function json(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function bodyOf(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

test('health reaches the HTTP fixture with GET and reports missing AI configuration honestly', async (t) => {
  const requests = [];
  const baseUrl = await fixtureServer(t, (request, response) => {
    requests.push({ path: request.url, method: request.method, headers: request.headers });
    json(response, 200, {
      status: 'ok', aiConfigured: false, model: 'gpt-4.1-mini',
      limits: { maxPages: 20, maxImageBytes: 5242880, maxQuestionLength: 2000 },
    });
  });
  const result = await client().health(`${baseUrl}/`);
  assert.equal(result.status, 'ok');
  assert.equal(result.aiConfigured, false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, '/api/health');
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].headers.accept, 'application/json');
  assert.equal(requests[0].headers.authorization, undefined, 'the mobile client must never send an OpenAI key');
});

test('multi-page analysis sends every page in order as JSON and returns the signed report envelope', async (t) => {
  let received;
  const baseUrl = await fixtureServer(t, async (request, response) => {
    received = { path: request.url, method: request.method, type: request.headers['content-type'], body: await bodyOf(request) };
    json(response, 200, { report: { id: 'analysis-1', source: 'openai' }, analysisToken: 'signature-from-backend' });
  });
  const pages = [
    { id: 'page-first', dataUrl: 'data:image/jpeg;base64,Zmlyc3Q=' },
    { id: 'page-second', dataUrl: 'data:image/jpeg;base64,c2Vjb25k' },
  ];
  const result = await client().analyzePages(baseUrl, pages, new AbortController().signal);
  assert.equal(received.path, '/api/analyses');
  assert.equal(received.method, 'POST');
  assert.equal(received.type, 'application/json');
  assert.deepEqual(received.body, { pages });
  assert.equal(result.analysisToken, 'signature-from-backend');
  assert.equal(result.report.source, 'openai');
});

test('chat keeps previous turns and the current question separate without dropping report evidence context', async (t) => {
  let received;
  const baseUrl = await fixtureServer(t, async (request, response) => {
    received = { path: request.url, body: await bodyOf(request) };
    json(response, 200, { message: { id: 'reply-2', role: 'assistant', content: 'Chưa có thời hạn hoàn cọc trong hợp đồng.', evidence: [], source: 'openai' } });
  });
  const payload = {
    report: { id: 'analysis-1', source: 'openai', pages: [{ id: 'page-first', text: 'Tiền cọc là 5 triệu đồng.' }] },
    analysisToken: 'signed-report-context',
    messages: [{ role: 'user', content: 'Tiền cọc là bao nhiêu?' }, { role: 'assistant', content: 'Tiền cọc là 5 triệu đồng.' }],
    question: 'Khi nào tôi được nhận lại số tiền đó?',
  };
  const result = await client().askContract(baseUrl, payload);
  assert.equal(received.path, '/api/chat');
  assert.deepEqual(received.body, payload);
  assert.equal(result.message.source, 'openai');
  assert.equal(result.message.content, 'Chưa có thời hạn hoàn cọc trong hợp đồng.');
});

test('a structured missing-key error reaches the user and never becomes demo output', async (t) => {
  let requestCount = 0;
  const baseUrl = await fixtureServer(t, (request, response) => {
    requestCount += 1;
    json(response, 503, { error: { code: 'OPENAI_NOT_CONFIGURED', message: 'Máy chủ chưa cấu hình khóa OpenAI.' } });
  });
  await assert.rejects(client().request(baseUrl, '/api/analyses', { pages: [] }), /Máy chủ chưa cấu hình khóa OpenAI\./);
  assert.equal(requestCount, 1, 'failed analyses must not be retried silently');
});

test('an HTML gateway error produces an understandable status error without leaking the HTML', async (t) => {
  const baseUrl = await fixtureServer(t, (request, response) => {
    response.writeHead(502, { 'content-type': 'text/html' });
    response.end('<html><body>private proxy diagnostics</body></html>');
  });
  await assert.rejects(client().request(baseUrl, '/api/health'), (error) => {
    assert.match(error.message, /Máy chủ trả lỗi 502/);
    assert.doesNotMatch(error.message, /private proxy diagnostics|<html>/);
    return true;
  });
});

test('malformed JSON, null and primitive successful responses are rejected', async (t) => {
  const baseUrl = await fixtureServer(t, (request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(request.url === '/bad-json' ? '{invalid-json' : request.url === '/null' ? 'null' : '"unexpected string"');
  });
  const api = client();
  for (const route of ['/bad-json', '/null', '/primitive']) {
    await assert.rejects(api.request(baseUrl, route), /Phản hồi máy chủ không hợp lệ/);
  }
});

test('a stalled HTTP response times out with a distinct Vietnamese timeout message', async (t) => {
  const baseUrl = await fixtureServer(t, () => { /* Intentionally leave the response open until client cancellation. */ });
  await assert.rejects(client().request(baseUrl, '/slow', undefined, { timeout: 35 }), (error) => {
    assert.match(error.message, /Máy chủ phản hồi quá lâu/);
    assert.doesNotMatch(error.message, /^Đã hủy yêu cầu/);
    return true;
  });
});

test('user cancellation aborts an active HTTP request and remains distinct from timeout', async (t) => {
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const baseUrl = await fixtureServer(t, () => { markStarted(); });
  const controller = new AbortController();
  const pending = client().request(baseUrl, '/slow', undefined, { signal: controller.signal, timeout: 1000 });
  // Install the rejection assertion before aborting, avoiding an unhandled rejection.
  const rejected = assert.rejects(pending, /^Error: Đã hủy yêu cầu\.$/);
  await started;
  controller.abort();
  await rejected;
});

test('an already cancelled operation is not sent to the network', async () => {
  let activeRequests = 0;
  const api = client(async (url, options) => {
    if (options.signal.aborted) throw options.signal.reason;
    activeRequests += 1;
    throw new Error('This request should have been cancelled');
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(api.request('http://127.0.0.1:4000', '/api/health', undefined, { signal: controller.signal }), /Đã hủy yêu cầu/);
  assert.equal(activeRequests, 0);
});

test('a network failure gives connection guidance rather than raw fetch diagnostics', async () => {
  const api = client(async () => { throw new TypeError('fetch failed: ECONNREFUSED'); });
  await assert.rejects(api.health('http://127.0.0.1:4000'), (error) => {
    assert.match(error.message, /Không kết nối được máy chủ/);
    assert.match(error.message, /Wi-Fi/);
    assert.doesNotMatch(error.message, /ECONNREFUSED/);
    return true;
  });
});

test('invalid server URLs fail before any network request', async () => {
  let requests = 0;
  const api = client(async () => { requests += 1; throw new Error('Unexpected network call'); });
  await assert.rejects(api.health('https://user:secret@example.test/api'), /Nhập địa chỉ HTTP\/HTTPS/);
  assert.equal(requests, 0);
});
