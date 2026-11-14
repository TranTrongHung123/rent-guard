const net = require('node:net');

function validateBuildEnvironment(env) {
  for (const name of Object.keys(env)) {
    if (/^EXPO_PUBLIC_.*(?:OPENAI|API_KEY|SECRET|SIGNING)/i.test(name) && env[name]) throw new Error(`Private credentials must not be exposed in ${name}.`);
  }
  if (env.EXPO_PUBLIC_REQUIRE_HTTPS !== 'true') return;
  let url;
  try { url = new URL(env.EXPO_PUBLIC_API_URL || ''); } catch { throw new Error('Set EXPO_PUBLIC_API_URL to the deployed HTTPS backend before building.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      net.isIP(url.hostname.replace(/^\[|\]$/g, '')) || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
      /(^|\.)(example|example\.(com|org|net)|invalid|test|local)$/.test(url.hostname) || /^(your-|replace-|placeholder)/i.test(url.hostname)) {
    throw new Error('Cloud builds require a real public HTTPS backend origin; local IPs and placeholder URLs are not accepted.');
  }
}

module.exports = { validateBuildEnvironment };
if (require.main === module) {
  try { validateBuildEnvironment(process.env); console.log('RentGuard build environment validated.'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
