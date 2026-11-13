// Photos are shrunk before they are saved: a receipt stays readable at
// 1800px and takes about a tenth of the space of the original photo.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file is not a photo this app can open.'));
    img.src = src;
  });
}

function draw(img, sx, sy, sw, sh, width, height, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

const strip = (dataUrl) => dataUrl.slice(dataUrl.indexOf(',') + 1);

export async function fileToJpeg(file, maxSide = 1800, quality = 0.72) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('Choose a photo.');
  if (file.size > 40 * 1024 * 1024) throw new Error('That photo is too large.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    return strip(draw(img, 0, 0, img.naturalWidth, img.naturalHeight, width, height, quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A small square from the top of the receipt, where the store name is.
export async function makeThumb(base64Jpeg, size = 132) {
  const img = await loadImage(`data:image/jpeg;base64,${base64Jpeg}`);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  return draw(img, sx, 0, side, side, size, size, 0.6);
}
