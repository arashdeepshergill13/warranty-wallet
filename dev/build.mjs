// Bundles the app for a plain browser with the native layer mocked, so the
// whole interface can be exercised without Xcode. Not used for the real build.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const tools = process.env.TOOLS || '/opt/npm-tools/node_modules';
const esbuild = createRequire(import.meta.url)(path.join(tools, 'esbuild'));
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mock = (f) => path.join(root, 'dev/mocks', f);
await esbuild.build({
  entryPoints: [path.join(root, 'src/main.jsx')],
  bundle: true, outdir: path.join(root, 'dev/out'), jsx: 'automatic', target: 'safari15',
  nodePaths: [tools], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'info',
  alias: {
    '@capacitor/core': mock('core.js'), '@capacitor/filesystem': mock('filesystem.js'),
    '@capacitor/local-notifications': mock('local-notifications.js'), '@capacitor/share': mock('share.js'),
  },
});
fs.writeFileSync(path.join(root, 'dev/out/index.html'),
  '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="main.css"><title>Backed</title></head><body><div id="root"></div><script src="main.js"></script></body></html>');
