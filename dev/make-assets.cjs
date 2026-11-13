// Draws the app icon and launch image. Run with sharp available:
//   NODE_PATH=<global node_modules> node dev/make-assets.cjs
const sharp = require('sharp');
const path = require('path');
const root = path.join(__dirname, '..');

// A receipt slip with a torn bottom edge; one line is highlighted.
function slip(scale = 1) {
  const teeth = Array.from({ length: 8 }, (_, i) => `L ${392 - i * 49 - 24.5} 742 L ${392 - (i + 1) * 49} 700`).join(' ');
  return `<g transform="translate(512 512) rotate(-7) scale(${scale}) translate(-512 -512)">
    <path d="M 316 250 Q 316 226 340 226 L 684 226 Q 708 226 708 250 L 708 700 ${teeth.replace(/(\d+(\.\d+)?) (7\d\d)/g, (m, x, _d, y) => `${Number(x) + 316} ${y}`)} Z" fill="#ffffff"/>
    <rect x="372" y="306" width="280" height="30" rx="15" fill="#cdd3e0"/>
    <rect x="372" y="386" width="200" height="30" rx="15" fill="#cdd3e0"/>
    <path d="M 356 462 L 668 452 L 664 522 L 352 532 Z" fill="#ffe14a"/>
    <rect x="372" y="476" width="150" height="30" rx="15" fill="#131c33"/>
    <rect x="372" y="576" width="240" height="30" rx="15" fill="#cdd3e0"/>
  </g>`;
}

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#2447d6"/>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a5cf0" stop-opacity="0.55"/><stop offset="1" stop-color="#1a37b0" stop-opacity="0.55"/></linearGradient></defs>
  ${slip(1.18)}
</svg>`;

const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#2447d6"/>
  <g transform="translate(854 854)">${slip(0.62)}</g>
</svg>`;

(async () => {
  const flat = (svg) => sharp(Buffer.from(svg)).flatten({ background: '#2447d6' }).removeAlpha();
  await flat(icon).png().toFile(path.join(root, 'resources/icon.png'));
  await flat(icon).resize(192, 192).png().toFile(path.join(root, 'public/icon-192.png'));
  await flat(splash).png({ compressionLevel: 9 }).toFile(path.join(root, 'resources/splash.png'));
  const meta = await sharp(path.join(root, 'resources/icon.png')).metadata();
  console.log('icon', meta.width, meta.height, 'channels', meta.channels, 'alpha', meta.hasAlpha);
})();
