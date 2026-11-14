// Dates are kept as local calendar strings ("2026-02-08"), never as timestamps,
// so a warranty never shifts by a day when the phone changes time zone.

export const CATEGORIES = [
  { id: 'electronics', label: 'Electronics', months: 12 },
  { id: 'appliance', label: 'Appliances', months: 12 },
  { id: 'tools', label: 'Tools', months: 12 },
  { id: 'automotive', label: 'Automotive', months: 12 },
  { id: 'furniture', label: 'Furniture', months: 12 },
  { id: 'home', label: 'Home and garden', months: 12 },
  { id: 'sports', label: 'Sports and outdoors', months: 12 },
  { id: 'jewellery', label: 'Jewellery and watches', months: 12 },
  { id: 'clothing', label: 'Clothing and shoes', months: 3 },
  { id: 'toys', label: 'Toys and baby', months: 3 },
  { id: 'other', label: 'Other', months: 12 },
];

export const WARRANTY_CHOICES = [
  { months: 0, label: 'None' },
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 24, label: '2 years' },
  { months: 36, label: '3 years' },
  { months: 60, label: '5 years' },
];

export const SOON_DAYS = 30;

export function categoryLabel(id) {
  return (CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1]).label;
}

export function defaultMonths(categoryId) {
  return (CATEGORIES.find((c) => c.id === categoryId) || { months: 12 }).months;
}

const pad = (n) => String(n).padStart(2, '0');

export function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(now = new Date()) {
  return toISO(now);
}

export function isValidISO(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

// Jan 31 + 1 month is Feb 28/29, not Mar 3.
export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return toISO(target);
}

export function addDays(iso, days) {
  const date = fromISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((fromISO(toIso) - fromISO(fromIso)) / 86400000);
}

export function expiryFor(purchaseDate, warrantyMonths) {
  const months = Number(warrantyMonths);
  if (!isValidISO(purchaseDate) || !Number.isFinite(months) || months <= 0) return null;
  return addMonths(purchaseDate, Math.round(months));
}

// state: 'active' | 'soon' | 'expired' | 'none'
export function coverage(item, today = todayISO()) {
  const expiry = item.expiryDate;
  if (!expiry || !isValidISO(expiry)) return { state: 'none', daysLeft: null, elapsed: 0 };
  const daysLeft = daysBetween(today, expiry);
  let elapsed = 1;
  if (isValidISO(item.purchaseDate)) {
    const total = Math.max(1, daysBetween(item.purchaseDate, expiry));
    elapsed = Math.min(1, Math.max(0, daysBetween(item.purchaseDate, today) / total));
  }
  if (daysLeft < 0) return { state: 'expired', daysLeft, elapsed: 1 };
  return { state: daysLeft <= SOON_DAYS ? 'soon' : 'active', daysLeft, elapsed };
}

export function countdownText(cov) {
  if (cov.state === 'none') return 'No warranty';
  if (cov.state === 'expired') {
    const n = -cov.daysLeft;
    return n === 1 ? 'Ended yesterday' : `Ended ${humanSpan(n)} ago`;
  }
  if (cov.daysLeft === 0) return 'Ends today';
  if (cov.daysLeft === 1) return 'Ends tomorrow';
  return `${humanSpan(cov.daysLeft)} left`;
}

export function humanSpan(days) {
  if (days < 60) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 730) {
    const months = Math.round(days / 30.44);
    return `${months} months`;
  }
  const years = days / 365.25;
  const rounded = Math.round(years * 2) / 2;
  return `${rounded} years`;
}

export function monthsLabel(months) {
  const m = Number(months);
  if (!m) return 'None';
  if (m % 12 === 0) return `${m / 12} year${m === 12 ? '' : 's'}`;
  return `${m} month${m === 1 ? '' : 's'}`;
}

export function formatDate(iso, locale) {
  if (!isValidISO(iso)) return '';
  return fromISO(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatMoney(value, currency = 'USD', locale) {
  const n = Number(value);
  if (value === null || value === '' || value === undefined || !Number.isFinite(n)) return '';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

// Vault order: soonest to expire first, then healthy, then no-warranty, expired last.
export function sortForVault(items, today = todayISO()) {
  const rank = { soon: 0, active: 1, none: 2, expired: 3 };
  return [...items].sort((a, b) => {
    const ca = coverage(a, today);
    const cb = coverage(b, today);
    if (rank[ca.state] !== rank[cb.state]) return rank[ca.state] - rank[cb.state];
    if (ca.state === 'expired') return cb.daysLeft - ca.daysLeft;
    if (ca.daysLeft !== null && cb.daysLeft !== null && ca.daysLeft !== cb.daysLeft) {
      return ca.daysLeft - cb.daysLeft;
    }
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}
