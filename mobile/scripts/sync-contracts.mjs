import { readFile, writeFile } from 'node:fs/promises';
const source = new URL('../../shared/contracts.ts', import.meta.url);
const target = new URL('../src/types/contracts.ts', import.meta.url);
const content = '// Generated from shared/contracts.ts. Run npm run sync:contracts from mobile.\n' + await readFile(source, 'utf8');
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== content) throw new Error('Mobile contracts differ from shared/contracts.ts; run npm run sync:contracts.');
} else await writeFile(target, content, 'utf8');
