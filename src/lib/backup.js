// Backups are files the person keeps wherever they like (Files, iCloud Drive,
// AirDrop to a Mac). Nothing is uploaded by the app.

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './native.js';
import { getState, readImageBase64, mergeItems } from './storage.js';
import { categoryLabel, monthsLabel, todayISO } from './warranty.js';
import { APP_NAME } from './config.js';

const MAX_BACKUP_BYTES = 150 * 1024 * 1024;

async function handOver(filename, body, mime) {
  if (isNative) {
    const written = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data: body, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: filename, files: [written.uri] });
    } catch (err) {
      if (!/cancel/i.test(String(err?.message || err))) throw err;
    } finally {
      Filesystem.deleteFile({ path: filename, directory: Directory.Cache }).catch(() => {});
    }
    return;
  }
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Spreadsheet programs run cells that start with = + - @ as formulas.
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function itemsToCSV(items) {
  const header = ['Product', 'Store', 'Category', 'Purchase date', 'Price', 'Warranty', 'Covered until', 'Serial number', 'Notes'];
  const rows = items.map((i) => [
    i.productName,
    i.storeName,
    categoryLabel(i.category),
    i.purchaseDate,
    i.price === null ? '' : i.price.toFixed(2),
    monthsLabel(i.warrantyMonths),
    i.expiryDate || '',
    i.serialNumber,
    i.notes,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export async function exportSpreadsheet() {
  await handOver(`${APP_NAME}-items-${todayISO()}.csv`, itemsToCSV(getState().items), 'text/csv');
}

export async function exportBackup() {
  const entries = [];
  for (const item of getState().items) {
    const photos = [];
    for (const name of item.images) {
      try {
        photos.push(await readImageBase64(name));
      } catch {
        // a missing photo should not stop the backup
      }
    }
    entries.push({ item, photos });
  }
  const body = JSON.stringify({ app: APP_NAME, format: 1, exportedAt: new Date().toISOString(), entries });
  await handOver(`${APP_NAME}-backup-${todayISO()}.json`, body, 'application/json');
}

export async function restoreBackup(file) {
  if (!file) throw new Error('Choose a backup file.');
  if (file.size > MAX_BACKUP_BYTES) throw new Error('That file is too large to be a backup from this app.');
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not a backup from this app.');
  }
  if (!data || data.format !== 1 || !Array.isArray(data.entries)) {
    throw new Error('That file is not a backup from this app.');
  }
  return mergeItems(data.entries.filter((e) => e && typeof e === 'object'));
}
