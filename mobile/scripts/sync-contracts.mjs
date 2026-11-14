import { readFile, writeFile } from 'node:fs/promises';
const source = new URL('../../shared/contracts.ts', import.meta.url);
const target = new URL('../src/types/contracts.ts', import.meta.url);
// Git may check text files out as CRLF on Windows; compare the same wire types.
const normalizeNewlines = text => text.replace(/\r\n/g, '\n');
const content = '// Generated from shared/contracts.ts. Run npm run sync:contracts from mobile.\n' + normalizeNewlines(await readFile(source, 'utf8'));
if (process.argv.includes('--check')) {
  if (normalizeNewlines(await readFile(target, 'utf8')) !== content) throw new Error('Mobile contracts differ from shared/contracts.ts; run npm run sync:contracts.');
} else await writeFile(target, content, 'utf8');
