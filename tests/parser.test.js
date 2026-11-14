import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceipt, findDate, buildRows, guessCategory } from '../src/lib/parser.js';
import { addMonths, coverage, expiryFor, sortForVault, countdownText } from '../src/lib/warranty.js';

const TODAY = '2026-11-12';

// Real text read from a Costco receipt (one fragment per line, no positions).
const COSTCO = `COSTCO
WHOLESALE
Seattle #01
4401 4th Ave South
Seattle, WA 98134
7M Member 121993614208
24311 VAR. MUFFIN
9.99
87745 ROTISSERIE
4.99
11545 STREET TACOS
15.76
1239521 KS ULTRA LIQ
17.99
88744 KS MEATBALLS
19.99
1221092 ARTISAN ROLL
5.99
***********Bottom of Basket***********
512599 KS TOWEL
19.89
6262016 KS BATH
19.99
SUBTOTAL
211.27
TAX
5.79
217.06
H
**** TOTAL
XXXXXXXXXXXX1234
AID: A0000000047043
Seq# 316594 App#: 094970
Visa Resp: APPROVED
APPROVED - Purchase
AMOUNT: $217.06
10/31/2025 12:46 2258 315 211 057
Visa
CHANGE
217.06
0.00
TOTAL NUMBER OF ITEMS SOLD =
16
OP#: 204 Name: JAMES
Thank You!`.split('\n');

// A Canadian Tire receipt as the on-device scanner reports it: fragments with
// positions, name on the left and price on the right of the same printed line.
const line = (text, x, y, w = 0.3) => ({ text, x, y, w, h: 0.012 });
const CANADIAN_TIRE = [
  line('CANADIAN TIRE #411', 0.25, 0.02, 0.5),
  line('TRINITY COMMON-BRAMPTON', 0.25, 0.04, 0.5),
  line('905-793-4800', 0.3, 0.06),
  line('HST #837247311', 0.3, 0.08),
  line('REG #:7 02/08/2026 16:42:17 TRANS #:11', 0.1, 0.1, 0.8),
  line('OPERATOR #: 2035 Float: 001', 0.1, 0.12, 0.6),
  line('$ 39.99', 0.72, 0.1602, 0.2),
  line('028-9225-8', 0.1, 0.16, 0.2),
  line('EDGE A3/B4 5W40', 0.34, 0.1598, 0.35),
  line('(SAVED $ 15.00)', 0.1, 0.18),
  line('SUBTOTAL', 0.4, 0.22, 0.2),
  line('$ 39.99', 0.72, 0.2203, 0.2),
  line('13% HST', 0.4, 0.24, 0.2),
  line('$ 5.20', 0.72, 0.2401, 0.2),
  line('T O T A L', 0.4, 0.26, 0.2),
  line('$ 45.19', 0.72, 0.26, 0.2),
  line('AMEX TEND', 0.4, 0.28, 0.2),
  line('$ 45.19', 0.72, 0.28, 0.2),
  line('AMEX #: ***********0409', 0.1, 0.32, 0.5),
  line('2026/02/08 16:42:29', 0.1, 0.36, 0.4),
  line('AUTHORIZATION: 861518', 0.1, 0.4, 0.5),
  line('TODAY YOU SAVED: $ 15.00', 0.2, 0.6, 0.6),
  line('to win a $1000 Canadian Tire gift card.', 0.1, 0.7, 0.8),
  line('2201-1040-11800-10358', 0.3, 0.75, 0.4),
  line("IS DEFECTIVE, THE MANUFACTURER'S", 0.1, 0.9, 0.8),
  line('WARRANTY APPLIES.', 0.3, 0.92, 0.4),
  line('Proudly Canadian since 1922.', 0.2, 0.96, 0.6),
];

test('Costco: store, date, total and items from unpositioned text', () => {
  const r = parseReceipt(COSTCO, { today: TODAY, order: 'MDY' });
  assert.equal(r.storeName, 'Costco');
  assert.equal(r.purchaseDate, '2025-10-31');
  assert.equal(r.total, 217.06);
  assert.equal(r.items.length, 8);
  assert.deepEqual(r.items[0], { name: 'Var. Muffin', price: 9.99 });
  assert.equal(r.productName, 'KS Meatballs'); // first of the most expensive items
  assert.ok(r.check.includes('productName'), 'several items, so ask the person to pick');
});

test('Canadian Tire: rows are rebuilt from positions', () => {
  const rows = buildRows(CANADIAN_TIRE);
  assert.ok(rows.includes('028-9225-8  EDGE A3/B4 5W40  $ 39.99'));
  assert.ok(rows.includes('TOTAL  $ 45.19'));
  const r = parseReceipt(CANADIAN_TIRE, { today: TODAY, order: 'DMY' });
  assert.equal(r.storeName, 'Canadian Tire');
  // 02/08/2026 is ambiguous; the 2026/02/08 further down settles it.
  assert.equal(r.purchaseDate, '2026-02-08');
  assert.equal(r.productName, 'Edge A3/B4 5W40');
  assert.equal(r.price, 39.99);
  assert.equal(r.total, 45.19);
  assert.equal(r.items.length, 1);
  assert.equal(r.category, 'automotive');
  assert.ok(!r.check.includes('purchaseDate'));
  assert.ok(!r.check.includes('productName'));
});

test('dates: two-digit years, both orders, month names, no future dates', () => {
  const d = (text, order = 'MDY') => findDate(text, { today: TODAY, order }).date;
  assert.equal(d('DATE 2/25/26 14:02'), '2026-02-25'); // the bug from the first version
  assert.equal(d('25/02/2026'), '2026-02-25');
  assert.equal(d('03/04/2026', 'MDY'), '2026-03-04');
  assert.equal(d('03/04/2026', 'DMY'), '2026-04-03');
  assert.equal(d('Purchased 8 Feb 2026'), '2026-02-08');
  assert.equal(d('February 8, 2026 at 4pm'), '2026-02-08');
  assert.equal(d('2026-02-08T16:42'), '2026-02-08');
  // 12/11/2026 as Dec 11 would be in the future, so it must be 12 Nov.
  assert.equal(d('12/11/2026', 'MDY'), '2026-11-12');
  assert.equal(d('Tel 905-793-4800 since 1922 item 028-9225-8'), '');
  assert.equal(findDate('03/04/2026', { today: TODAY }).sure, false);
});

test('electronics receipt with serial number and stated warranty', () => {
  const r = parseReceipt(
    [
      'BEST BUY #954',
      '123 Main St',
      '11/02/2026 13:05',
      '6418599 SONY WH-1000XM5 HEADPHONES   399.99',
      'S/N: 4021557A8',
      '2 YEAR LIMITED WARRANTY',
      'SUBTOTAL 399.99',
      'TAX 52.00',
      'TOTAL 451.99',
      'VISA 451.99',
    ],
    { today: TODAY, order: 'MDY' }
  );
  assert.equal(r.storeName, 'Best Buy');
  assert.equal(r.purchaseDate, '2026-11-02');
  assert.equal(r.productName, 'Sony WH-1000XM5 Headphones');
  assert.equal(r.price, 399.99);
  assert.equal(r.total, 451.99);
  assert.equal(r.category, 'electronics');
  assert.equal(r.serialNumber, '4021557A8');
  assert.equal(r.warrantyMonths, 24);
  assert.equal(r.warrantyEstimated, false);
});

test('unknown store and thousands separators', () => {
  const r = parseReceipt(
    ['NORTHSIDE APPLIANCE CO.', '55 King Rd', '2026-09-30', 'LG WASHER WM4000   $1,299.00', 'Total: $1,467.87'],
    { today: TODAY }
  );
  assert.equal(r.storeName, 'Northside Appliance Co.');
  assert.equal(r.price, 1299);
  assert.equal(r.total, 1467.87);
  assert.equal(r.category, 'appliance');
  assert.ok(r.check.includes('storeName'));
});

test('category guesses cope with plurals', () => {
  assert.equal(guessCategory('Noise-Cancelling Headphones'), 'electronics');
  assert.equal(guessCategory('Winter Tires 225/45'), 'automotive');
  assert.equal(guessCategory('Mystery thing', 'tools'), 'tools');
  assert.equal(guessCategory('Mystery thing'), 'other');
});

test('empty or unreadable input never throws', () => {
  for (const input of [[], null, undefined, [''], ['???'], [{ text: 'x' }]]) {
    const r = parseReceipt(input, { today: TODAY });
    assert.equal(r.productName, '');
    assert.equal(r.purchaseDate, '');
  }
});

test('warranty maths', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-02-29', 12), '2025-02-28');
  assert.equal(expiryFor('2026-02-08', 12), '2027-02-08');
  assert.equal(expiryFor('2026-02-08', 0), null);
  assert.equal(expiryFor('nonsense', 12), null);
  const item = { purchaseDate: '2026-02-08', expiryDate: '2027-02-08' };
  assert.equal(coverage(item, TODAY).state, 'active');
  assert.equal(coverage(item, '2027-01-20').state, 'soon');
  assert.equal(coverage(item, '2027-02-08').daysLeft, 0);
  assert.equal(coverage(item, '2027-02-09').state, 'expired');
  assert.equal(countdownText(coverage(item, '2027-02-07')), 'Ends tomorrow');
  assert.equal(coverage({}, TODAY).state, 'none');
  const order = sortForVault(
    [
      { id: 'expired', expiryDate: '2026-01-01' },
      { id: 'healthy', expiryDate: '2028-01-01' },
      { id: 'soon', expiryDate: '2026-11-20' },
      { id: 'none' },
    ],
    TODAY
  ).map((i) => i.id);
  assert.deepEqual(order, ['soon', 'healthy', 'none', 'expired']);
});
