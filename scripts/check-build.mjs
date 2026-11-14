// Fails the build if the finished app is missing its no-network policy or
// contains code that could reach a server. Runs automatically after "vite build".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const problems = [];

// Find the policy tag whatever order its attributes are in, and undo the
// HTML escaping that build tools apply to quote marks inside attributes.
const decode = (text) =>
  text.replace(/&#39;|&#x27;|&apos;/gi, "'").replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&amp;/g, '&');
const tag = /<meta\b[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/i.exec(html)?.[0] || '';
const policy = decode(/\bcontent="([^"]*)"/i.exec(tag)?.[1] || /\bcontent='([^']*)'/i.exec(tag)?.[1] || '');
if (!tag) problems.push('index.html has no Content-Security-Policy tag');
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
  if (tag) console.error(`Policy tag found: ${tag}`);
  console.error('\nBuild check failed:\n' + problems.map((p) => `  - ${p}`).join('\n') + '\n');
  process.exit(1);
}
console.log('Build check passed: no-network policy is in place.');
