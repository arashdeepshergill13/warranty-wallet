// Everything the app knows lives in files inside the app's own folder on the
// phone. There is no server and no account. iOS encrypts these files and
// includes them in the person's own iPhone backup.

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { CATEGORIES, expiryFor, isValidISO } from './warranty.js';

const DIR = Directory.Library;
const ROOT = 'vault';
const MAIN = `${ROOT}/data.json`;
const SPARE = `${ROOT}/data.backup.json`;
const IMAGES = `${ROOT}/receipts`;
const IMAGE_NAME_RE = /^[a-f0-9-]{8,40}-\d{1,2}\.jpg$/;
export const MAX_IMAGES = 3;

export const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD', 'INR', 'MXN', 'BRL', 'JPY', 'CHF', 'SEK', 'ZAR', 'SGD', 'AED'];
const REGION_CURRENCY = { US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', NZ: 'NZD', IN: 'INR', MX: 'MXN', BR: 'BRL', JP: 'JPY', CH: 'CHF', SE: 'SEK', ZA: 'ZAR', SG: 'SGD', AE: 'AED', IE: 'EUR', FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', PT: 'EUR', BE: 'EUR', AT: 'EUR', FI: 'EUR' };

function region() {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  return (lang.split('-')[1] || 'US').toUpperCase();
}

export function defaultSettings() {
  const r = region();
  return {
    onboarded: false,
    remindersOn: true,
    reminderDays: [30, 7, 1],
    appLock: false,
    currency: REGION_CURRENCY[r] || 'USD',
    dateOrder: ['US', 'CA', 'PH'].includes(r) ? 'MDY' : 'DMY',
  };
}

let state = { ready: false, items: [], settings: defaultSettings(), saveError: null };
const listeners = new Set();

export const getState = () => state;
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Applied to everything read from disk or from a backup file, so a damaged or
// hand-edited file can never put unexpected values into the app.
export function sanitizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id, 40);
  if (!/^[a-f0-9-]{8,40}$/.test(id)) return null;
  const price = Number(raw.price);
  const months = Math.round(Number(raw.warrantyMonths));
  const purchaseDate = isValidISO(raw.purchaseDate) ? raw.purchaseDate : '';
  const warrantyMonths = Number.isFinite(months) && months > 0 && months <= 600 ? months : 0;
  const thumb = typeof raw.thumb === 'string' && raw.thumb.startsWith('data:image/jpeg;base64,') && raw.thumb.length < 60000 ? raw.thumb : '';
  return {
    id,
    productName: text(raw.productName, 120) || 'Untitled item',
    storeName: text(raw.storeName, 80),
    category: CATEGORIES.some((c) => c.id === raw.category) ? raw.category : 'other',
    purchaseDate,
    price: raw.price === null || raw.price === '' || !Number.isFinite(price) || price < 0 ? null : Math.round(price * 100) / 100,
    warrantyMonths,
    warrantyEstimated: Boolean(raw.warrantyEstimated),
    expiryDate: expiryFor(purchaseDate, warrantyMonths),
    serialNumber: text(raw.serialNumber, 60),
    notes: text(raw.notes, 2000),
    images: Array.isArray(raw.images) ? raw.images.filter((n) => typeof n === 'string' && IMAGE_NAME_RE.test(n)).slice(0, MAX_IMAGES) : [],
    thumb,
    createdAt: text(raw.createdAt, 30) || new Date().toISOString(),
    updatedAt: text(raw.updatedAt, 30) || new Date().toISOString(),
  };
}

export function sanitizeSettings(raw) {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  const days = Array.isArray(raw.reminderDays)
    ? [...new Set(raw.reminderDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 365))].sort((a, b) => b - a).slice(0, 5)
    : base.reminderDays;
  return {
    onboarded: Boolean(raw.onboarded),
    remindersOn: raw.remindersOn !== false,
    reminderDays: days.length ? days : base.reminderDays,
    appLock: Boolean(raw.appLock),
    currency: CURRENCIES.includes(raw.currency) ? raw.currency : base.currency,
    dateOrder: raw.dateOrder === 'DMY' || raw.dateOrder === 'MDY' ? raw.dateOrder : base.dateOrder,
  };
}

async function readJSON(path) {
  const result = await Filesystem.readFile({ path, directory: DIR, encoding: Encoding.UTF8 });
  const body = typeof result.data === 'string' ? result.data : await result.data.text();
  return JSON.parse(body);
}

async function ensureFolders() {
  try {
    await Filesystem.mkdir({ path: IMAGES, directory: DIR, recursive: true });
  } catch {
    // already there
  }
}

export async function load() {
  await ensureFolders();
  let data = null;
  try {
    data = await readJSON(MAIN);
  } catch {
    try {
      data = await readJSON(SPARE); // main copy missing or damaged: use the spare
    } catch {
      data = null;
    }
  }
  const items = Array.isArray(data?.items) ? data.items.map(sanitizeItem).filter(Boolean) : [];
  setState({ ready: true, items, settings: sanitizeSettings(data?.settings) });
  return state;
}

// Saves run one at a time. Two copies are written in turn, so if the app is
// killed in the middle of a save there is always one complete copy left.
let saving = Promise.resolve();
function persist() {
  const body = JSON.stringify({ version: 1, items: state.items, settings: state.settings });
  saving = saving
    .then(async () => {
      await Filesystem.writeFile({ path: MAIN, directory: DIR, data: body, encoding: Encoding.UTF8, recursive: true });
      await Filesystem.writeFile({ path: SPARE, directory: DIR, data: body, encoding: Encoding.UTF8, recursive: true });
      if (state.saveError) setState({ saveError: null });
    })
    .catch((err) => {
      setState({ saveError: String(err?.message || err) });
    });
  return saving;
}
export const whenSaved = () => saving;

export async function updateSettings(patch) {
  setState({ settings: sanitizeSettings({ ...state.settings, ...patch }) });
  await persist();
}

async function removeImage(name) {
  if (!IMAGE_NAME_RE.test(name)) return;
  try {
    await Filesystem.deleteFile({ path: `${IMAGES}/${name}`, directory: DIR });
  } catch {
    // already gone
  }
}

// fields: item fields. newImages: base64 JPEG strings to replace the photos, or
// null to keep the ones already saved.
export async function saveItem(fields, newImages = null) {
  const existing = state.items.find((i) => i.id === fields.id);
  const id = existing ? existing.id : newId();
  let images = existing ? existing.images : [];
  if (newImages) {
    await ensureFolders();
    const stamp = Date.now() % 100;
    const names = [];
    for (let i = 0; i < Math.min(newImages.length, MAX_IMAGES); i++) {
      // A fresh name each time, so an old photo is never shown from a cache.
      const name = `${id}-${(stamp + i) % 100}.jpg`;
      await Filesystem.writeFile({ path: `${IMAGES}/${name}`, directory: DIR, data: newImages[i], recursive: true });
      names.push(name);
    }
    for (const old of images) if (!names.includes(old)) await removeImage(old);
    images = names;
  }
  const now = new Date().toISOString();
  const item = sanitizeItem({ ...existing, ...fields, id, images, createdAt: existing?.createdAt || now, updatedAt: now });
  setState({ items: existing ? state.items.map((i) => (i.id === id ? item : i)) : [item, ...state.items] });
  await persist();
  return item;
}

export async function deleteItem(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  setState({ items: state.items.filter((i) => i.id !== id) });
  await persist();
  for (const name of item.images) await removeImage(name);
}

async function blobToBase64(blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function readImageBase64(name) {
  if (!IMAGE_NAME_RE.test(name)) throw new Error('Unknown photo');
  const result = await Filesystem.readFile({ path: `${IMAGES}/${name}`, directory: DIR });
  return typeof result.data === 'string' ? result.data : blobToBase64(result.data);
}

export async function readImage(name) {
  return `data:image/jpeg;base64,${await readImageBase64(name)}`;
}

export async function imageUri(name) {
  if (!IMAGE_NAME_RE.test(name)) throw new Error('Unknown photo');
  return (await Filesystem.getUri({ path: `${IMAGES}/${name}`, directory: DIR })).uri;
}

// Used when restoring a backup: adds items that are not already in the vault
// and replaces ones that are older than the backup's copy.
export async function mergeItems(incoming) {
  let added = 0;
  let updated = 0;
  const byId = new Map(state.items.map((i) => [i.id, i]));
  for (const entry of incoming) {
    const item = sanitizeItem(entry.item);
    if (!item) continue;
    const current = byId.get(item.id);
    if (current && current.updatedAt >= item.updatedAt) continue;
    const photos = (entry.photos || []).filter((p) => typeof p === 'string' && /^[A-Za-z0-9+/=]+$/.test(p.slice(0, 2000))).slice(0, MAX_IMAGES);
    const names = [];
    for (let i = 0; i < photos.length; i++) {
      const name = `${item.id}-${i}.jpg`;
      await Filesystem.writeFile({ path: `${IMAGES}/${name}`, directory: DIR, data: photos[i], recursive: true });
      names.push(name);
    }
    if (current) for (const old of current.images) if (!names.includes(old)) await removeImage(old);
    byId.set(item.id, { ...item, images: names });
    current ? (updated += 1) : (added += 1);
  }
  setState({ items: [...byId.values()] });
  await persist();
  return { added, updated };
}

export async function eraseEverything() {
  for (const item of state.items) for (const name of item.images) await removeImage(name);
  setState({ items: [], settings: { ...defaultSettings(), onboarded: true } });
  await persist();
}
