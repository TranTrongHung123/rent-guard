import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

/** Opt-in real provider test. Prints only IDs/counts, never image text or credentials. */
const config = loadConfig();
if (!config.apiKey) { console.error('Chưa có OPENAI_API_KEY trong backend/.env. Không chạy live test.'); process.exit(1); }
const paths = process.argv.slice(2);
if (!paths.length) { console.error('Cách dùng: npm run test:live -- "C:\\path\\trang-1.jpg" "C:\\path\\trang-2.jpg"'); process.exit(1); }
const pages = await Promise.all(paths.map(async (filePath, index) => {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ['.jpg', '.jpeg'].includes(ext) ? 'image/jpeg' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : null;
  if (!mime) throw new Error('Chỉ nhận JPEG, PNG hoặc WebP.');
  return { id: `page-${index + 1}`, dataUrl: `data:${mime};base64,${(await readFile(filePath)).toString('base64')}` };
}));
const server = createApp(config).listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Không mở được local test server.');
const baseUrl = `http://127.0.0.1:${address.port}`;
try {
  const response = await fetch(`${baseUrl}/api/analyses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pages }), signal: AbortSignal.timeout(600_000) });
  const result = await response.json();
  if (!response.ok) throw new Error(`${result.error?.code}: ${result.error?.message}`);
  const chatResponse = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...result, messages: [], question: 'Hợp đồng quy định tiền cọc như thế nào?' }), signal: AbortSignal.timeout(240_000) });
  const chat = await chatResponse.json();
  if (!chatResponse.ok) throw new Error(`${chat.error?.code}: ${chat.error?.message}`);
  const followupResponse = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...result, messages: [{ role: 'user', content: 'Hợp đồng quy định tiền cọc như thế nào?' }, { role: 'assistant', content: chat.message.content }], question: 'Tôi nên hỏi chủ nhà điều gì để làm rõ khoản đó?' }), signal: AbortSignal.timeout(240_000) });
  if (!followupResponse.ok) throw new Error(`Follow-up failed: HTTP ${followupResponse.status}`);
  console.log(JSON.stringify({ liveOpenAI: true, reportId: result.report.id, source: result.report.source, model: result.report.model, pages: result.report.pages.length, findings: result.report.findings.length, firstChatEvidence: chat.message.evidence.length, multiTurn: true }, null, 2));
} finally { server.close(); }
