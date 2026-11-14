const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const ts = require('typescript');

function compile(relativePath, imports) {
  const filename = path.join(__dirname, '..', relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  vm.runInNewContext(output.outputText, { module, exports: module.exports, require: id => { if (!(id in imports)) throw new Error(`Unexpected fixture import: ${id}`); return imports[id]; }, process: { env: {} }, AbortController, structuredClone, URL, Error, console }, { filename });
  return module.exports;
}

// Exercise actual provider commands and refs without pretending to render a
// native screen. Expo, hooks and storage are explicit test-only fixtures.
function provider() {
  const core = compile('src/domain/core.ts', {});
  const analysis = compile('src/domain/analysis.ts', {});
  const calls = []; const writes = []; const deletions = [];
  let selected = []; let gate;
  const image = id => ({ id, uri: `file:///rentguard-pages/${id}.jpg`, width: 1200, height: 1600, mimeType: 'image/jpeg' });
  const api = { analyzePages: async (_url, pages, _signal, options) => {
    calls.push({ pages, options }); const index = calls.length;
    if (gate) await gate;
    return { report: { id: `report-${index}`, title: 'Hợp đồng thuê nhà', createdAt: '2026-11-14T00:00:00.000Z', source: 'openai', model: 'fixture', summary: 'Chưa có điểm đủ bằng chứng.', findings: [], missingInformation: [], warnings: [], pages: pages.map((page, number) => ({ id: page.id, pageNumber: number + 1, status: 'readable', text: 'Nội dung hợp đồng fixture.', warning: null })), analysis: { version: 'rentguard-v2.0.0', policyId: 'a'.repeat(64), inputFingerprint: createHash('sha256').update(analysis.fingerprintInput(pages)).digest('hex'), analyzedAt: '2026-11-14T00:00:00.000Z', reuse: 'none' } }, analysisToken: 'signed-fixture' };
  } };
  const jsx = (type, props) => ({ type, props });
  const module = compile('src/state/rentguard.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { createContext: () => ({ Provider: 'FixtureProvider' }), useContext: () => null, useRef: current => ({ current }), useState: initial => [initial, () => {}], useEffect: () => {} },
    'expo-asset': { Asset: {} }, 'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_algorithm, input) => createHash('sha256').update(input).digest('hex') },
    '@/domain/analysis': analysis, '@/domain/core': core, '@/domain/demo': {}, '@/domain/paths': {}, '@/services/api': api,
    '@/services/images': { selectImages: async () => selected, pageDataUrl: async page => `data:image/jpeg;base64,${Buffer.from(page.uri).toString('base64')}`, deletePageFiles: async pages => { deletions.push(...pages); } },
    '@/services/storage': { writeRecord: async record => { writes.push(structuredClone(record)); }, removeRecord: async () => {} },
  });
  const state = module.RentGuardProvider({ children: null }).props.value;
  return { state, calls, writes, deletions, pick: async id => { selected = [image(id)]; await state.pickImages('library'); }, hold: () => { let release; gate = new Promise(resolve => { release = resolve; }); return release; } };
}

test('reading a report again preserves its snapshot and draft images, creates a separate unsaved record', async () => {
  const fixture = provider();
  await fixture.pick('original'); const oldId = await fixture.state.analyze();
  await fixture.state.saveRecord(oldId);
  const original = structuredClone(fixture.state.getRecord(oldId));
  await fixture.pick('next-contract-draft');
  const newId = await fixture.state.reanalyzeRecord(oldId);
  assert.notEqual(oldId, newId);
  assert.deepEqual(structuredClone(fixture.state.getRecord(oldId)), original);
  assert.equal(fixture.state.getRecord(newId).isSaved, false);
  assert.equal(fixture.calls[1].options.forceRefresh, true);
  assert.equal(fixture.calls[1].pages[0].id, 'original');
  assert.equal(fixture.writes.length, 1, 'fresh results require explicit Save');
  await fixture.state.analyze();
  assert.equal(fixture.calls[2].pages[0].id, 'next-contract-draft');
  assert.equal(fixture.deletions.length, 0);
});

test('cancelled reading preserves the original report and prevents deletion while its images are in use', async () => {
  const fixture = provider(); await fixture.pick('original');
  const oldId = await fixture.state.analyze(); const original = structuredClone(fixture.state.getRecord(oldId));
  const release = fixture.hold(); const pending = fixture.state.reanalyzeRecord(oldId);
  await assert.rejects(fixture.state.deleteRecord(oldId), /đọc lại ảnh/);
  fixture.state.cancelAnalysis(); release();
  assert.equal(await pending, null);
  assert.deepEqual(structuredClone(fixture.state.getRecord(oldId)), original);
  assert.equal(fixture.state.getRecord('report-2'), undefined);
  assert.equal(fixture.deletions.length, 0);
});
