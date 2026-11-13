// Turns the text read from a receipt photo into warranty details.
// Everything here runs on the phone. No network, no AI service.
//
// Note: no regex lookbehind anywhere in this file. Safari before 16.4 fails to
// parse it, which would break the whole app on older iPhones.

import { isValidISO, todayISO, defaultMonths } from './warranty.js';

const AMOUNT = '(\\d{1,3}(?:[ ,]\\d{3})+|\\d+)[.,](\\d{2})';
const AMOUNT_RE = new RegExp(`(^|[^\\d.,/:-])-?\\$?\\s?${AMOUNT}(?![.,/-]?\\d)`, 'g');
const PRICE_ONLY_RE = new RegExp(`^[^A-Za-z\\d]*${AMOUNT}\\s*[A-Z]{0,2}\\W*$`);
const ENDS_WITH_PRICE_RE = new RegExp(`^(.*?[A-Za-z].*?)[\\s$]+-?${AMOUNT}\\s*-?\\s*[A-Z]{0,3}\\W*$`);

const TOTAL_RE = /\b(grand\s*total|total\s*due|amount\s*due|balance\s*due|total|amount)\b/i;
const NOT_TOTAL_RE = /(sub\s*-?\s*total|total\s*(tax|sav|item|number|disc|point|qty)|items?\s*sold|you\s*sav|tax\s*total|saved)/i;
const SKIP_ITEM_RE = /\b(sub\s*-?\s*total|subtotal|total|tax|hst|gst|pst|qst|tvq|tps|vat|tend|tender|change|cash|visa|master\s*card|mastercard|amex|american\s*express|debit|interac|balance|saved|savings|you\s*save|discount|coupon|points|approved|auth|authorization|amount|tip|gratuity|deposit|rounding|payment|refund|purchase)\b/i;
const NOT_AN_ITEM_RE = /(\d{3}[\s.-]\d{3}[\s.-]\d{4}|www\.|\.com|@|#\s*:?\s*\d)/i;
const NOT_A_NAME_RE = /(\d{3}[\s.-]\d{3}[\s.-]\d{4}|\b\d{5}(-\d{4})?\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b|www\.|\.com|\.ca\b|@|\b(st|ave|avenue|street|blvd|road|rd|drive|dr|hwy|suite|unit)\b\.?)/i;

const RETAILERS = [
  [/best\s*buy/i, 'Best Buy', 'electronics'],
  [/apple\s*(store|inc)/i, 'Apple', 'electronics'],
  [/micro\s*center/i, 'Micro Center', 'electronics'],
  [/canada\s*computers/i, 'Canada Computers', 'electronics'],
  [/the\s*source/i, 'The Source', 'electronics'],
  [/b\s*&\s*h\s*photo/i, 'B&H Photo', 'electronics'],
  [/staples/i, 'Staples', 'electronics'],
  [/canadian\s*tire/i, 'Canadian Tire', null],
  [/home\s*depot/i, 'The Home Depot', 'tools'],
  [/lowe'?s/i, "Lowe's", 'tools'],
  [/\brona\b/i, 'RONA', 'tools'],
  [/home\s*hardware/i, 'Home Hardware', 'tools'],
  [/harbor\s*freight/i, 'Harbor Freight', 'tools'],
  [/princess\s*auto/i, 'Princess Auto', 'tools'],
  [/costco/i, 'Costco', null],
  [/wal\s*-?\s*mart/i, 'Walmart', null],
  [/\btarget\b/i, 'Target', null],
  [/amazon/i, 'Amazon', null],
  [/sam'?s\s*club/i, "Sam's Club", null],
  [/\bikea\b/i, 'IKEA', 'furniture'],
  [/wayfair/i, 'Wayfair', 'furniture'],
  [/the\s*brick/i, 'The Brick', 'furniture'],
  [/leon'?s/i, "Leon's", 'furniture'],
  [/autozone/i, 'AutoZone', 'automotive'],
  [/napa\s*auto/i, 'NAPA Auto Parts', 'automotive'],
  [/sport\s*chek/i, 'Sport Chek', 'sports'],
  [/decathlon/i, 'Decathlon', 'sports'],
  [/\brei\b/i, 'REI', 'sports'],
  [/dick'?s\s*sporting/i, "Dick's Sporting Goods", 'sports'],
  [/\bargos\b/i, 'Argos', null],
  [/currys/i, 'Currys', 'electronics'],
  [/john\s*lewis/i, 'John Lewis', null],
  [/media\s*markt/i, 'MediaMarkt', 'electronics'],
  [/jb\s*hi-?fi/i, 'JB Hi-Fi', 'electronics'],
  [/harvey\s*norman/i, 'Harvey Norman', 'electronics'],
];

const CATEGORY_WORDS = [
  ['electronics', /\b(tv|oled|qled|laptop|macbook|ipad|iphone|phone|tablet|monitor|headphone|earbud|airpods|speaker|soundbar|camera|lens|console|playstation|xbox|nintendo|router|ssd|hdd|printer|keyboard|mouse|charger|watch\s*series|gpu|graphics|drone|kindle|projector)(?:e?s)?\b/i],
  ['appliance', /\b(washer|dryer|dishwasher|fridge|refrigerator|freezer|microwave|oven|range|stove|vacuum|dyson|blender|mixer|kettle|toaster|air\s*fryer|coffee|espresso|instant\s*pot|humidifier|dehumidifier|air\s*conditioner|heater|purifier|fan)(?:e?s)?\b/i],
  ['tools', /\b(drill|driver|saw|sander|grinder|wrench|socket|ratchet|compressor|nailer|dewalt|milwaukee|makita|ryobi|bosch|mower|trimmer|blower|chainsaw|pressure\s*washer|generator|ladder|tool)(?:e?s)?\b/i],
  ['automotive', /\b(tire|tyre|battery|wiper|brake|rotor|alternator|motor\s*oil|5w\d0|0w\d0|10w\d0|dash\s*cam|car\s*seat|floor\s*mat|booster)(?:e?s)?\b/i],
  ['furniture', /\b(sofa|couch|mattress|bed\s*frame|desk|chair|table|dresser|shelf|bookcase|cabinet|recliner)(?:e?s)?\b/i],
  ['sports', /\b(bike|bicycle|helmet|treadmill|dumbbell|kayak|tent|ski|snowboard|skate|racket|golf|backpack)(?:e?s)?\b/i],
  ['jewellery', /\b(ring|necklace|bracelet|earring|watch)(?:e?s)?\b/i],
  ['clothing', /\b(jacket|coat|jeans|shirt|shoe|sneaker|boot|dress|sweater|hoodie|pants)(?:e?s)?\b/i],
  ['toys', /\b(lego|toy|stroller|crib|doll|puzzle)(?:e?s)?\b/i],
  ['home', /\b(lamp|rug|grill|bbq|barbecue|faucet|shower|toilet|thermostat|smoke\s*alarm|door\s*lock|light\s*fixture|cookware|pan|knife)(?:e?s)?\b/i],
];

const ACRONYMS = new Set(['USB', 'LED', 'OLED', 'QLED', 'UHD', 'HDMI', 'GPS', 'SUV', 'BBQ', 'AAA', 'RAM', 'CPU', 'GPU', 'IKEA', 'RONA', 'NAPA', 'REI']);
const SMALL_WORDS = new Set(['CO', 'OF', 'TO', 'IN', 'ON', 'AT', 'BY', 'OR', 'NO', 'MY', 'WE', 'UP']);
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const pad = (n) => String(n).padStart(2, '0');
const letterCount = (s) => (s.match(/[A-Za-z]/g) || []).length;

function amountValue(whole, cents) {
  return Number(`${whole.replace(/[ ,]/g, '')}.${cents}`);
}

function amountsIn(text) {
  const out = [];
  AMOUNT_RE.lastIndex = 0;
  let m;
  while ((m = AMOUNT_RE.exec(text))) out.push(amountValue(m[2], m[3]));
  return out;
}

// "T O T A L" -> "TOTAL"
function unspace(text) {
  return text.replace(/\b(?:[A-Za-z] ){2,}[A-Za-z]\b/g, (m) => m.replace(/ /g, ''));
}

// lines: [{ text, x, y, w, h }] with coordinates from 0 to 1, origin top-left.
// Text recognition returns the item name and its price as separate fragments;
// this puts fragments that sit on the same printed line back together.
export function buildRows(lines) {
  const clean = (lines || [])
    .map((l) => (typeof l === 'string' ? { text: l } : l))
    .filter((l) => l && typeof l.text === 'string' && l.text.trim());
  if (!clean.length) return [];
  const hasGeometry = clean.every((l) => Number.isFinite(l.y) && Number.isFinite(l.h) && Number.isFinite(l.x));
  if (!hasGeometry) return clean.map((l) => unspace(l.text.trim()));

  const heights = clean.map((l) => l.h).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] || 0.01;
  const sorted = [...clean].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows = [];
  for (const line of sorted) {
    const cy = line.y + line.h / 2;
    const row = rows[rows.length - 1];
    if (row && Math.abs(cy - row.cy) < median * 0.6) {
      row.parts.push(line);
      row.cy = (row.cy * (row.parts.length - 1) + cy) / row.parts.length;
    } else {
      rows.push({ cy, parts: [line] });
    }
  }
  return rows.map((row) =>
    unspace(
      row.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.text.trim())
        .join('  ')
    )
  );
}

function caseWord(word) {
  if (/\d/.test(word)) return word; // model numbers stay as printed
  if (word !== word.toUpperCase()) return word; // already mixed case
  const letters = word.replace(/[^A-Za-z]/g, '');
  if ((letters.length <= 2 && !SMALL_WORDS.has(letters)) || ACRONYMS.has(letters) || !/[AEIOUY]/.test(letters)) return word; // LG, TV, USB, SSD
  return word.charAt(0) + word.slice(1).toLowerCase();
}

function titleCase(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (/\d/.test(word) ? word : word.split('-').map(caseWord).join('-')))
    .join(' ');
}

function cleanItemName(raw) {
  let name = raw
    .replace(/^[\s*#]+/, '')
    .replace(/^(?:\d[\d-]{3,}|[A-Z]{0,2}\d{5,})\s+/, '') // leading SKU
    .replace(/\s+\d{6,}$/, '') // trailing SKU
    .replace(/[\s$]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  name = name.replace(/^\d+\s*[xX@]\s*/, '');
  return titleCase(name);
}

function findStore(rows) {
  const top = rows.slice(0, 10);
  // A known name counts when it is near the top, or is printed anywhere on a
  // line of its own (some receipts put the logo under the address block).
  for (const [re, name, category] of RETAILERS) {
    if (top.some((row) => re.test(row))) return { name, category, known: true };
  }
  for (const row of top) {
    if (letterCount(row) < 3) continue;
    if (NOT_A_NAME_RE.test(row)) continue;
    if (amountsIn(row).length) continue;
    if (/\b(receipt|invoice|welcome|thank|customer|copy|duplicate)\b/i.test(row)) continue;
    const name = titleCase(row.replace(/\s*#\s*\d+.*$/, '').replace(/\s{2,}/g, ' ').trim());
    if (name.length >= 3) return { name: name.slice(0, 60), category: null, known: false };
  }
  return { name: '', category: null, known: false };
}

function makeISO(y, m, d) {
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return isValidISO(iso) ? iso : null;
}

// Returns every plausible reading of every date in the text, with a weight.
function dateCandidates(text, order) {
  const found = [];
  const add = (index, iso, weight) => {
    if (iso) found.push({ index, iso, weight });
  };
  let m;

  const ymd = /(^|\D)(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/g;
  while ((m = ymd.exec(text))) add(m.index, makeISO(+m[2], +m[3], +m[4]), 2);

  const xy = /(^|\D)(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})(?![\d/.-])/g;
  while ((m = xy.exec(text))) {
    const a = +m[2];
    const b = +m[3];
    const year = m[4].length === 2 ? 2000 + +m[4] : +m[4];
    if (m[4].length === 2 && m[0].includes('.')) continue; // "1.2.26" is more likely a version than a date
    const mdy = makeISO(year, a, b);
    const dmy = makeISO(year, b, a);
    if (mdy && dmy && mdy !== dmy) {
      add(m.index, mdy, order === 'MDY' ? 1 : 0.5);
      add(m.index, dmy, order === 'DMY' ? 1 : 0.5);
    } else {
      add(m.index, mdy || dmy, 2);
    }
  }

  const names = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
  const dMonY = new RegExp(`(^|\\D)(\\d{1,2})(?:st|nd|rd|th)?[\\s.-]*(${names})[a-z]*[\\s.,-]*(20\\d{2}|\\d{2})(?!\\d)`, 'gi');
  while ((m = dMonY.exec(text))) {
    const year = m[4].length === 2 ? 2000 + +m[4] : +m[4];
    add(m.index, makeISO(year, MONTHS[m[3].toLowerCase()], +m[2]), 2);
  }
  const monDY = new RegExp(`\\b(${names})[a-z]*[\\s.]*(\\d{1,2})(?:st|nd|rd|th)?[\\s,]+(20\\d{2})(?!\\d)`, 'gi');
  while ((m = monDY.exec(text))) add(m.index, makeISO(+m[3], MONTHS[m[1].toLowerCase()], +m[2]), 2);

  return found;
}

export function findDate(text, { order = 'MDY', today = todayISO() } = {}) {
  let cands = dateCandidates(text, order).filter((c) => c.iso >= '2000-01-01');
  if (!cands.length) return { date: '', sure: false };
  const notFuture = cands.filter((c) => c.iso <= today);
  const allFuture = notFuture.length === 0;
  if (!allFuture) cands = notFuture;

  const score = new Map();
  for (const c of cands) {
    const s = score.get(c.iso) || { weight: 0, index: c.index };
    s.weight += c.weight;
    s.index = Math.min(s.index, c.index);
    score.set(c.iso, s);
  }
  const ranked = [...score.entries()].sort((a, b) => b[1].weight - a[1].weight || a[1].index - b[1].index);
  const [date, best] = ranked[0];
  return { date, sure: best.weight >= 2 && !allFuture };
}

function findItems(rows) {
  const endAt = rows.findIndex((row) => /sub\s*-?\s*total|\btotal\b/i.test(row));
  const region = endAt === -1 ? rows : rows.slice(0, endAt);
  const items = [];
  for (let i = 0; i < region.length; i++) {
    const row = region[i];
    if (SKIP_ITEM_RE.test(row)) continue;
    let name = null;
    let price = null;
    const same = ENDS_WITH_PRICE_RE.exec(row);
    if (same && letterCount(same[1]) >= 3) {
      name = same[1];
      price = amountValue(same[2], same[3]);
    } else if (letterCount(row) >= 3 && !amountsIn(row).length && !NOT_AN_ITEM_RE.test(row)) {
      const next = PRICE_ONLY_RE.exec(region[i + 1] || '');
      if (next) {
        name = row;
        price = amountValue(next[1], next[2]);
        i += 1;
      }
    }
    if (name === null) continue;
    const cleaned = cleanItemName(name);
    if (letterCount(cleaned) < 3 || price <= 0) continue;
    items.push({ name: cleaned.slice(0, 80), price });
  }
  return items;
}

function findTotal(rows) {
  const priceOnly = (row) => {
    const m = PRICE_ONLY_RE.exec(row || '');
    return m ? amountValue(m[1], m[2]) : null;
  };
  let nearby = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!TOTAL_RE.test(row) || NOT_TOTAL_RE.test(row)) continue;
    const here = amountsIn(row);
    if (here.length) return here[here.length - 1];
    if (nearby === null) {
      nearby = priceOnly(rows[i + 1]) ?? priceOnly(rows[i - 1]) ?? priceOnly(rows[i + 2]) ?? priceOnly(rows[i - 2]);
    }
  }
  if (nearby !== null) return nearby;
  const all = rows.flatMap(amountsIn);
  return all.length ? Math.max(...all) : null;
}

export function guessCategory(productName, storeCategory) {
  for (const [id, re] of CATEGORY_WORDS) if (re.test(productName || '')) return id;
  return storeCategory || 'other';
}

function findSerial(text) {
  const m = /\b(?:s\/n|serial(?:\s*(?:no|number|#))?)[\s.:#]*([A-Z0-9][A-Z0-9-]{5,24})\b/i.exec(text);
  return m && /\d/.test(m[1]) ? m[1].toUpperCase() : '';
}

// Only trust a warranty length the receipt states outright.
function findStatedWarranty(text) {
  const m = /\b(\d{1,2})\s*-?\s*(year|yr|month|mo)s?\b[^.\n]{0,24}\bwarranty/i.exec(text);
  if (!m) return null;
  const n = +m[1];
  const months = /^y/i.test(m[2]) ? n * 12 : n;
  return months > 0 && months <= 300 ? months : null;
}

export function parseReceipt(lines, options = {}) {
  const rows = buildRows(lines);
  const text = rows.join('\n');
  const store = findStore(rows);
  const { date, sure: dateSure } = findDate(text, options);
  const items = findItems(rows);
  const total = findTotal(rows);
  const main = items.length ? items.reduce((a, b) => (b.price > a.price ? b : a)) : null;
  const productName = main ? main.name : '';
  const category = guessCategory(productName, store.category);
  const stated = findStatedWarranty(text);

  const check = [];
  if (!store.name || !store.known) check.push('storeName');
  if (!date || !dateSure) check.push('purchaseDate');
  if (!main || items.length > 1) check.push('productName');
  check.push('warrantyMonths'); // always worth a look unless the receipt states it
  if (stated) check.pop();

  return {
    storeName: store.name,
    purchaseDate: date,
    productName,
    price: main ? main.price : total,
    total,
    items,
    category,
    warrantyMonths: stated ?? defaultMonths(category),
    warrantyEstimated: !stated,
    serialNumber: findSerial(text),
    check,
    foundText: rows.length > 0,
  };
}
