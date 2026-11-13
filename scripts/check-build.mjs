// Fails the build if the finished app is missing its no-network policy or
// contains code that could reach a server. Runs automatically after "vite build".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const problems = [];

const policy = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] || '';
for (const rule of ["default-src 'none'", "script-src 'self'", "connect-src 'self'", "object-src 'none'"]) {
  if (!policy.includes(rule)) problems.push(`index.html is missing the security rule: ${rule}`);
}
if (/<script(?![^>]*\bsrc=)[^>]*>\s*\S/.test(html)) problems.push('index.html contains an inline script');
if (/(src|href)="https?:\/\//.test(html)) problems.push('index.html loads something from another site');

const assets = path.join(dist, 'assets');
for (const file of fs.existsSync(assets) ? fs.readdirSync(assets) : []) {
  if (!file.endsWith('.js')) continue;
  const code = fs.readFileSync(path.join(assets, file), 'utf8');
  for (const word of ['supabase', 'api.anthropic.com', 'googleapis.com', 'sk-ant-']) {
    if (code.includes(word)) problems.push(`${file} still mentions "${word}"`);
  }
}

if (problems.length) {
  console.error('\nBuild check failed:\n' + problems.map((p) => `  - ${p}`).join('\n') + '\n');
  process.exit(1);
}
console.log('Build check passed: no-network policy is in place.');
