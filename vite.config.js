import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The shipped app is not allowed to talk to any server at all. This policy is
// enforced by the web view itself: scripts, styles and images may only come
// from inside the app bundle, and every outgoing connection is refused.
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

function lockedDownHtml() {
  return {
    name: 'locked-down-html',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), lockedDownHtml()],
  build: { target: 'safari15', sourcemap: false },
});
