const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real storage module with an in-memory AsyncStorage adapter.
// React Native native bindings cannot run in Node; no native storage is claimed here.
function compile(relativePath, imports = {}) {
  const filename = path.join(path.dirname(require.resolve('../package.json')), relativePath);
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const module = { exports: {} };
  vm.runInNewContext(result.outputText, {
    exports: module.exports,
    module,
    require: (specifier) => {
      if (!(specifier in imports)) throw new Error(`Unexpected test import: ${specifier}`);
      return imports[specifier];
    },
    URL,
  }, { filename });
  return module.exports;
}

function fixture(id = 'contract-1', createdAt = '2026-11-14T03:00:00.000Z') {
  return {
    id,
    report: {
      id, title: 'Hợp đồng căn hộ', createdAt, source: 'openai', model: 'gpt-4.1-mini',
      summary: 'Cần làm rõ thời hạn trả cọc.',
      pages: [{ id: 'page-1', pageNumber: 1, status: 'readable', text: 'Tiền cọc là 5.000.000 đồng.', warning: null }],
      findings: [{
        id: 'finding-1', ruleId: 'deposit', category: 'deposit', severity: 'medium',
        title: 'Cần hỏi thời hạn trả cọc', reason: 'Điều khoản nêu tiền cọc.',
        explanation: 'Hãy xác nhận thời điểm hoàn cọc.', suggestedQuestion: 'Cọc được trả khi nào?',
        evidence: [{ id: 'evidence-1', pageId: 'page-1', pageNumber: 1, quote: 'Tiền cọc là 5.000.000 đồng.', startOffset: 0, endOffset: 'Tiền cọc là 5.000.000 đồng.'.length, boundingBox: null }],
      }],
      missingInformation: ['Thời điểm hoàn cọc'], warnings: [],
    },
    localPages: [{ id: 'page-1', uri: 'file:///documents/rentguard-pages/page-1.jpg', width: 1240, height: 1754, mimeType: 'image/jpeg' }],
    analysisToken: 'signed-analysis-context', messages: [], isSaved: false,
  };
}

function createStorage(seed = []) {
  const data = new Map(seed);
  const calls = [];
  const failures = { read: false, write: false, remove: false };
  const adapter = {
    getAllKeys: async () => { if (failures.read) throw new Error('Storage unavailable'); return [...data.keys()]; },
    multiGet: async (keys) => keys.map((key) => [key, data.get(key) ?? null]),
    setItem: async (key, value) => {
      if (failures.write) throw new Error('Disk full');
      calls.push(['set', key]); data.set(key, value);
    },
    removeItem: async (key) => {
      if (failures.remove) throw new Error('Storage unavailable');
      calls.push(['remove', key]); data.delete(key);
    },
    getItem: async (key) => data.get(key) ?? null,
  };
  const core = compile('src/domain/core.ts');
  const paths = compile('src/domain/paths.ts');
  const storage = compile('src/services/storage.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: adapter },
    '@/domain/core': core,
    '@/domain/paths': paths,
  });
  return { ...storage, data, calls, failures };
}

test('saving and reopening preserves the report and chat while storing portable managed-image references', async () => {
  const storage = createStorage();
  const record = fixture();
  record.messages = [{ id: 'chat-1', role: 'user', content: 'Tôi cần hỏi gì về tiền cọc?', evidence: [], source: 'openai', createdAt: record.report.createdAt }];
  await storage.writeRecord(record);
  const loaded = await storage.loadRecords();
  assert.equal(loaded.corrupted, 0);
  assert.equal(loaded.records.length, 1);
  assert.equal(loaded.records[0].isSaved, true);
  assert.equal(loaded.records[0].localPages[0].uri, 'rentguard-pages/page-1.jpg');
  assert.equal(record.localPages[0].uri, 'file:///documents/rentguard-pages/page-1.jpg', 'persisting must not alter the active image URI');
  assert.equal(loaded.records[0].messages[0].content, record.messages[0].content);
  assert.equal(loaded.records[0].report.findings[0].evidence[0].quote, record.report.findings[0].evidence[0].quote);
  assert.equal(record.isSaved, false, 'storage must not mutate the caller record');
});

test('history ignores unrelated keys and returns newest saved analysis first', async () => {
  const older = fixture('older', '2026-11-13T03:00:00.000Z');
  const newer = fixture('newer', '2026-11-14T03:00:00.000Z');
  const storage = createStorage([
    ['other-app:key', 'private unrelated value'], ['rentguard:v1:api-url', 'http://192.168.1.8:4000'],
    ['rentguard:v1:analysis:older', JSON.stringify(older)], ['rentguard:v1:analysis:newer', JSON.stringify(newer)],
  ]);
  const loaded = await storage.loadRecords();
  assert.equal(loaded.records.map((record) => record.id).join(','), 'newer,older');
  assert.equal(loaded.corrupted, 0);
  assert.equal(storage.calls.length, 0, 'reading must not rewrite data');
});

test('corrupted entries are counted and preserved while valid records remain available', async () => {
  const storage = createStorage([
    ['rentguard:v1:analysis:valid', JSON.stringify(fixture('valid'))],
    ['rentguard:v1:analysis:broken-json', '{broken'],
    ['rentguard:v1:analysis:missing-report', JSON.stringify({ id: 'missing-report' })],
    ['rentguard:v1:analysis:wrong-key', JSON.stringify(fixture('other-id'))],
  ]);
  const loaded = await storage.loadRecords();
  assert.equal(loaded.records.length, 1);
  assert.equal(loaded.records[0].id, 'valid');
  assert.equal(loaded.corrupted, 3);
  assert.equal(storage.data.size, 4, 'corrupt data must be retained for recovery');
  assert.equal(storage.calls.length, 0);
});

test('write failure propagates and retains the previously saved record', async () => {
  const original = JSON.stringify({ ...fixture(), isSaved: true });
  const storage = createStorage([['rentguard:v1:analysis:contract-1', original]]);
  storage.failures.write = true;
  await assert.rejects(storage.writeRecord({ ...fixture(), messages: [{ content: 'new' }] }), /Disk full/);
  assert.equal(storage.data.get('rentguard:v1:analysis:contract-1'), original);
});

test('storage read failures propagate without clearing records', async () => {
  const storage = createStorage([['rentguard:v1:analysis:contract-1', JSON.stringify(fixture())]]);
  storage.failures.read = true;
  await assert.rejects(storage.loadRecords(), /Storage unavailable/);
  assert.equal(storage.data.size, 1);
  assert.equal(storage.calls.length, 0);
});

test('deleting one record leaves other history and connection settings intact', async () => {
  const storage = createStorage();
  await storage.writeRecord(fixture('one'));
  await storage.writeRecord(fixture('two'));
  await storage.writeApiUrl('http://192.168.1.8:4000');
  await storage.removeRecord('one');
  const loaded = await storage.loadRecords();
  assert.equal(loaded.records.length, 1);
  assert.equal(loaded.records[0].id, 'two');
  assert.equal(await storage.readApiUrl(), 'http://192.168.1.8:4000');
});
