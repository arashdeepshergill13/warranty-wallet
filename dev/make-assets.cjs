// Draws the app icon and launch image. Run with sharp available:
//   NODE_PATH=<global node_modules> node dev/make-assets.cjs
const sharp = require('sharp');
const path = require('path');
const root = path.join(__dirname, '..');

// A shield with a check mark: "you're backed".
const mark = (size, cx, cy) => {
  const s = size / 24;
  return `<g transform="translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3l7 3v5.500c0 4.400-2.900 7.900-7 9.500-4.100-1.600-7-5.100-7-9.500V6l7-3z"/>
    <path d="M9 12l2.200 2.200L15.200 10"/>
  </g>`;
};
const gradient = `<defs><linearGradient id="g" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#2bc66f"/><stop offset="1" stop-color="#08774b"/></linearGradient></defs>`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${gradient}
  <rect width="1024" height="1024" fill="url(#g)"/>${mark(640, 512, 512)}</svg>`;
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">${gradient}
  <rect width="2732" height="2732" fill="url(#g)"/>${mark(520, 1366, 1366)}</svg>`;

(async () => {
  const flat = (svg) => sharp(Buffer.from(svg)).flatten({ background: '#12995a' }).removeAlpha();
  await flat(icon).png().toFile(path.join(root, 'resources/icon.png'));
  await flat(icon).resize(192, 192).png().toFile(path.join(root, 'public/icon-192.png'));
  await flat(splash).png({ compressionLevel: 9 }).toFile(path.join(root, 'resources/splash.png'));
  const meta = await sharp(path.join(root, 'resources/icon.png')).metadata();
  console.log('icon', meta.width, meta.height, 'channels', meta.channels, 'alpha', meta.hasAlpha);
})();
