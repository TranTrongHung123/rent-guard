import assert from 'node:assert/strict';
import test from 'node:test';

import { managedFileName, persistPageUris, restorePageUris } from '../src/domain/paths.ts';

const page = uri => ({ id: 'page-1', uri, width: 1200, height: 1700, mimeType: 'image/jpeg' });

test('recognizes only safe filenames in managed relative and legacy absolute paths', () => {
  assert.equal(managedFileName('rentguard-pages/page-12_abc.jpg'), 'page-12_abc.jpg');
  assert.equal(managedFileName('file:///var/mobile/Containers/Data/Application/OLD/Documents/rentguard-pages/page-12_abc.jpg'), 'page-12_abc.jpg');
  assert.equal(managedFileName('file:///data/user/0/vn.rentguard.app/files/rentguard-pages/p1.jpg'), 'p1.jpg');
  assert.equal(managedFileName('file:///my%20app/Documents/rentguard-pages/p1.jpg'), 'p1.jpg');
});

test('rejects path traversal, siblings, query strings, encoded separators and unsafe basenames', () => {
  for (const uri of [
    '../rentguard-pages/p1.jpg', '/rentguard-pages/p1.jpg', 'rentguard-pages/../p1.jpg',
    'rentguard-pages/a/b.jpg', 'rentguard-pages-sibling/p1.jpg', 'rentguard-pages/p1.png',
    'rentguard-pages/p1.JPG', 'rentguard-pages/.jpg', 'rentguard-pages/p1.jpg?secret=1',
    'rentguard-pages/p1.jpg#fragment', 'rentguard-pages/a b.jpg', 'rentguard-pages/a%20b.jpg',
    'file:///Documents/rentguard-pages/../rentguard-pages/p1.jpg',
    'file:///Documents/%2e%2e/rentguard-pages/p1.jpg',
    'file:///Documents/%2Fsecret/rentguard-pages/p1.jpg',
    'file:///Documents/%5Csecret/rentguard-pages/p1.jpg',
    'file:///Documents/rentguard-pages/p1.jpg?x=1',
    'file:///Documents/rentguard-pages/p1.jpg#x',
    'file://remote-host/Documents/rentguard-pages/p1.jpg',
    'file:///Documents/rentguard-pages-sibling/p1.jpg',
    'file:///Documents/rentguard-pages/p1.jpg/other',
    'file:///Documents/rentguard-pages/p1\\evil.jpg',
    'file:///Documents/%zz/rentguard-pages/p1.jpg',
    'https://example.com/rentguard-pages/p1.jpg', 'data:image/jpeg;base64,aGVsbG8=', '',
  ]) assert.equal(managedFileName(uri), null, uri);
});

test('persistPageUris replaces managed URIs without changing report, other assets or original data', () => {
  const original = {
    id: 'report-1', report: { id: 'report-1' }, messages: [], analysisToken: 'signature', isSaved: true,
    localPages: [page('file:///OLD/Documents/rentguard-pages/page-1.jpg'), page('rentguard-pages/page-2.jpg'), page('https://assets.example.com/sample.png')],
  };
  const persisted = persistPageUris(original);
  assert.deepEqual(persisted.localPages.map(item => item.uri), ['rentguard-pages/page-1.jpg', 'rentguard-pages/page-2.jpg', 'https://assets.example.com/sample.png']);
  assert.equal(original.localPages[0].uri, 'file:///OLD/Documents/rentguard-pages/page-1.jpg');
  assert.strictEqual(persisted.report, original.report);
  assert.strictEqual(persisted.messages, original.messages);
  assert.equal(persisted.analysisToken, original.analysisToken);
});

test('rebases new and legacy managed paths before cleanup after an iOS container move', () => {
  const pages = [page('file:///OLD/Documents/rentguard-pages/page-1.jpg'), page('rentguard-pages/page-2.jpg')];
  const restored = restorePageUris(pages, 'file:///NEW/Documents///');
  assert.deepEqual(restored.map(item => item.uri), ['file:///NEW/Documents/rentguard-pages/page-1.jpg', 'file:///NEW/Documents/rentguard-pages/page-2.jpg']);
  assert.equal(pages[0].uri, 'file:///OLD/Documents/rentguard-pages/page-1.jpg');
  assert.deepEqual(restorePageUris(restored, 'file:///NEW/Documents/'), restored);
});

test('accepts SDK 58 Expo Go scoped roots on Android and iOS without decoding the scope', () => {
  // Android ScopedContext URL-encodes its scope into a filesystem folder, then
  // FileSystemModule serializes that folder with Uri.fromFile (double escaping).
  // https://github.com/expo/expo/blob/sdk-58/apps/expo-go/android/expoview/src/main/java/host/exp/exponent/utils/ScopedContext.kt#L137-L144
  // iOS scopedDocumentDirectory appends the raw scope as path components, then
  // VersionManager creates URL(fileURLWithPath:) for the FileSystem app context.
  // https://github.com/expo/expo/blob/sdk-58/apps/expo-go/ios/Exponent/Kernel/ReactAppManager/EXReactAppManager.mm#L632-L637
  const roots = [
    'file:///data/user/0/host.exp.exponent/files/ExperienceData/%2540owner%252Frentguard/',
    'file:///var/mobile/Containers/Data/Application/NEW/Documents/ExponentExperienceData/@owner/rentguard/',
  ];
  for (const root of roots) {
    const absolute = `${root}rentguard-pages/page-1.jpg`;
    assert.equal(managedFileName(absolute), 'page-1.jpg');
    const restored = restorePageUris([page('rentguard-pages/page-1.jpg')], root);
    assert.equal(restored[0].uri, absolute);
    assert.equal(persistPageUris({ localPages: restored }).localPages[0].uri, 'rentguard-pages/page-1.jpg');
  }
});

test('restoring leaves external, sample cache and unsafe paths untouched', () => {
  const pages = [
    page('file:///OLD/Library/Caches/ExponentAsset-demo.png'),
    page('https://example.com/sample.png'), page('blob:https://example.com/123'),
    page('data:image/jpeg;base64,aGVsbG8='), page('rentguard-pages/../secret.jpg'),
  ];
  const restored = restorePageUris(pages, 'file:///NEW/Documents');
  assert.deepEqual(restored, pages);
});

test('rejects an invalid current document root instead of rewriting saved paths unsafely', () => {
  for (const root of ['', '/Documents', 'https://example.com/Documents/', 'file:///OLD/../Documents/', 'file:///Documents?x=1', 'file://remote-host/Documents/']) {
    assert.throws(() => restorePageUris([page('rentguard-pages/page-1.jpg')], root), Error, root);
  }
});
