// Builds a single-file browser demo of the app (dev/out/demo/backed-demo.html).
// The native layer is replaced by dev/demo-setup.js. Not used for the real app.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const tools = process.env.TOOLS || '/opt/npm-tools/node_modules';
const esbuild = createRequire(import.meta.url)(path.join(tools, 'esbuild'));
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'dev/out/demo');
const mock = (f) => path.join(root, 'dev/mocks', f);

const result = await esbuild.build({
  entryPoints: [path.join(root, 'dev/demo-entry.js')],
  bundle: true, write: false, outdir: out, minify: true, jsx: 'automatic', target: 'safari15', format: 'iife',
  nodePaths: [tools], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
  alias: {
    '@capacitor/core': mock('core.js'), '@capacitor/filesystem': mock('filesystem.js'),
    '@capacitor/local-notifications': mock('local-notifications.js'), '@capacitor/share': mock('share.js'),
  },
});
const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
let css = result.outputFiles.find((f) => f.path.endsWith('.css')).text;

// Follow the viewer's light/dark choice as well as the system setting.
const darkVars = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/.exec(css);
if (!darkVars) throw new Error('dark palette not found in CSS');
css = css.replace(darkVars[0], `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${darkVars[1]};color-scheme:dark}}:root[data-theme="dark"]{${darkVars[1]};color-scheme:dark}:root[data-theme="light"]{color-scheme:light}`);
css += `
.demo-bar{display:flex;align-items:center;gap:12px;padding:10px 20px;background:var(--blue-wash);color:var(--ink);font-size:14px;line-height:1.35}
.demo-bar p{flex:1;min-width:0;margin:0}
.demo-bar button{flex:none;min-height:36px;padding:0 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--card);font-size:14px;font-weight:600;color:var(--ink)}
.demo-note{position:fixed;z-index:50;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 16px);max-width:calc(100% - 32px);padding:12px 16px;border-radius:14px;background:var(--ink);color:var(--paper);font-size:15px;font-weight:500;text-align:center}
`;

fs.mkdirSync(out, { recursive: true });
const html = `<title>Backed Demo</title>
<meta name="description" content="Browser demo of the Backed receipt and warranty app.">
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
const file = path.join(out, 'backed-demo.html');
fs.writeFileSync(file, html);
console.log(file, Math.round(html.length / 1024) + 'KB');
