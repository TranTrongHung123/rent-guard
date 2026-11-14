import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const server = createApp(config).listen(config.port, config.host, () => {
  console.log(`RentGuard backend: http://${config.host}:${config.port}`);
  console.log(`OpenAI: ${config.apiKey ? 'configured' : 'not configured'}; model: ${config.model}`);
});
server.timeout = 660_000;
server.requestTimeout = 120_000;
for (const event of ['SIGINT', 'SIGTERM'] as const) process.on(event, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10_000).unref(); });
