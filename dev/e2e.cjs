// End-to-end check of the interface in Chromium with the native layer mocked.
// Usage: node dev/build.mjs && node dev/e2e.cjs [scale]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
const http = require('http');

const OUT = path.join(__dirname, 'out');
const SHOTS = path.join(OUT, 'shots');
let URL_ = '';
const SCALE = Number(process.argv[2] || 1);
fs.mkdirSync(SHOTS, { recursive: true });

// Runs inside the page: fake native plugin + a drawn receipt for the scanner to "see".
function nativeSetup() {
  window.__NATIVE__ = true;
  const receiptLines = [
    ['NORTHGATE ELECTRONICS', 0.2, 0.05, 0.6], ['Store 114, 20 Harbour Way', 0.2, 0.09, 0.6], ['11/02/2026 13:05', 0.3, 0.14, 0.4],
    ['4418 NOISE-CANCELLING HEADPHONES', 0.08, 0.24, 0.6], ['329.99', 0.78, 0.2405, 0.14],
    ['7720 USB-C CABLE 2M', 0.08, 0.29, 0.4], ['14.99', 0.8, 0.2903, 0.12],
    ['SUBTOTAL', 0.08, 0.38, 0.3], ['344.98', 0.78, 0.38, 0.14], ['TAX', 0.08, 0.42, 0.2], ['44.85', 0.8, 0.42, 0.12],
    ['TOTAL', 0.08, 0.47, 0.2], ['389.83', 0.78, 0.47, 0.14], ['CARD ************4821', 0.08, 0.55, 0.5], ['Thank you for shopping with us', 0.15, 0.7, 0.7],
  ];
  window.__drawReceipt = (rows, w = 600, h = 900) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fdfdfb'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2e38';
    rows.forEach(([text, x, y], i) => { g.font = `${i === 0 ? 'bold 30' : '24'}px "DejaVu Sans Mono", monospace`; g.fillText(text, x * w, y * h + 20); });
    return c.toDataURL('image/jpeg', 0.8).split(',')[1];
  };
  const lines = receiptLines.map(([text, x, y, w]) => ({ text, x, y, w, h: 0.022 }));
  window.__plugins = { WalletNative: {
    isScannerAvailable: () => ({ available: true }),
    scanDocument: () => ({ cancelled: false, pages: [{ image: window.__drawReceipt(receiptLines), lines }] }),
    recognizeText: () => ({ lines }),
    lockStatus: () => ({ available: true, kind: 'faceID' }),
    authenticate: () => ({ available: true, success: !window.__failUnlock }),
    setPrivacyScreen: (o) => { window.__privacyScreen = o.enabled; },
    openSettings: () => {},
  } };
}

// Runs inside the page: a believable vault for screenshots. Dates are relative to today.
function seedVault() {
  if (localStorage.getItem('__fs')) return;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ago = (months, days = 0) => { const d = new Date(); d.setMonth(d.getMonth() - months); d.setDate(d.getDate() - days); return iso(d); };
  const demo = [
    ['Cordless vacuum', 'Harbour Home', 'appliance', ago(11, 18), 499.99, 12, false, 'HH-V15-0098213'],
    ['Running shoes', 'Trailhead Sports', 'clothing', ago(2, 5), 164.0, 3, true, ''],
    ['Noise-cancelling headphones', 'Northgate Electronics', 'electronics', ago(8), 329.99, 12, false, '4021557A8'],
    ['Espresso machine', 'Harbour Home', 'appliance', ago(2), 349.0, 24, false, ''],
    ['55-inch television', 'Northgate Electronics', 'electronics', ago(4), 899.0, 24, false, 'TV55-7H2K-11904'],
    ['Cordless drill kit', 'Maple Hardware', 'tools', ago(14), 189.0, 36, false, ''],
    ['Dishwasher', 'Harbour Home', 'appliance', ago(30), 1049.0, 24, false, ''],
  ];
  const files = new Map();
  const items = demo.map(([productName, storeName, category, purchaseDate, price, warrantyMonths, warrantyEstimated, serialNumber], n) => {
    const id = `de300000-${String(n).padStart(4, "0")}`;
    const rows = [[storeName.toUpperCase(), 0.12, 0.05], ['Receipt', 0.12, 0.1], [purchaseDate, 0.12, 0.15], [productName.toUpperCase().slice(0, 22), 0.08, 0.26], [price.toFixed(2), 0.72, 0.31], ['TOTAL', 0.08, 0.42], [(price * 1.13).toFixed(2), 0.72, 0.42], ['Thank you', 0.3, 0.6]];
    const full = window.__drawReceipt(rows);
    files.set(`LIBRARY/vault/receipts/${id}-0.jpg`, full);
    const c = document.createElement('canvas'); c.width = c.height = 132; const img = new Image(); img.src = 'data:image/jpeg;base64,' + full;
    return new Promise((res) => { img.onload = () => { c.getContext('2d').drawImage(img, 0, 0, 600, 600, 0, 0, 132, 132);
      res({ id, productName, storeName, category, purchaseDate, price, warrantyMonths, warrantyEstimated, serialNumber, notes: n === 0 ? 'Box is in the hall cupboard.' : '', images: [`${id}-0.jpg`], thumb: c.toDataURL('image/jpeg', 0.6), createdAt: new Date(2026, 0, n + 1).toISOString(), updatedAt: new Date(2026, 0, n + 1).toISOString() }); }; });
  });
  return Promise.all(items).then((list) => {
    const body = JSON.stringify({ version: 1, items: list, settings: { onboarded: true, remindersOn: true, reminderDays: [30, 7, 1], appLock: false, currency: 'USD', dateOrder: 'MDY' } });
    files.set('LIBRARY/vault/data.json', body); files.set('LIBRARY/vault/data.backup.json', body);
    localStorage.setItem('__fs', JSON.stringify([...files]));
  });
}

(async () => {
  // Served from localhost: browsers do not keep storage reliably for file:// pages.
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  const server = http.createServer((req, res) => {
    const file = path.join(OUT, req.url === '/' ? 'index.html' : path.basename(req.url.split('?')[0]));
    fs.readFile(file, (err, body) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(err ? '' : body);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  URL_ = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const open = async ({ native = false, seed = false, dark = false, locale = 'en-US' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: SCALE, colorScheme: dark ? 'dark' : 'light', locale, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    if (native) await page.addInitScript(nativeSetup);
    if (seed) { await page.goto(URL_); await page.evaluate(nativeSetup); await page.evaluate(seedVault); }
    await page.goto(URL_);
    return { ctx, page, errors };
  };
  const shot = async (page, name) => {
    // Let sliding screens come to rest before the picture is taken.
    await page.waitForFunction(() => !document.querySelector('.is-offstage, .is-leaving'));
    await page.waitForTimeout(520);
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`), animations: 'disabled' });
  };
  const data = (page) => page.evaluate(() => JSON.parse(window.__fs.get('LIBRARY/vault/data.json')));

  // ---- 1. First run in a plain browser: welcome, empty vault, add by hand ----
  {
    const { ctx, page, errors } = await open();
    await page.getByRole('button', { name: 'Get started' }).waitFor();
    await shot(page, '01-welcome');
    await page.getByRole('button', { name: 'Get started' }).click();
    await page.getByText('Add your first receipt').waitFor();
    await shot(page, '02-empty');
    await page.getByRole('button', { name: 'Add receipt' }).click();
    assert.equal(await page.getByText('Scan a receipt').count(), 0, 'no scanner offered in a browser');
    await page.getByText('Type it in').click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText('Add a name so you can find this later.').waitFor();
    await page.getByPlaceholder('Dyson V15 vacuum').fill('Stand mixer');
    await page.getByPlaceholder('Best Buy').fill('Harbour Home');
    await page.getByPlaceholder('0.00').fill('abc');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText('Use numbers only, like 399.99.').waitFor();
    await page.getByPlaceholder('0.00').fill('279.5');
    await page.getByRole('button', { name: '2 years' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText('Share proof of purchase').waitFor();
    const saved = (await data(page)).items[0];
    assert.equal(saved.productName, 'Stand mixer'); assert.equal(saved.price, 279.5); assert.equal(saved.warrantyMonths, 24);
    assert.equal(saved.warrantyEstimated, false); assert.ok(saved.expiryDate > saved.purchaseDate);
    assert.equal(await page.getByText('Want a reminder').count(), 0, 'no reminder prompt outside the iPhone app');
    await page.reload();
    await page.getByText('1 item covered, worth $280').waitFor();
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ---- 2. iPhone app (mocked): scan, review, save, reminders, edit, share, delete ----
  {
    const { ctx, page, errors } = await open({ native: true });
    await page.getByRole('button', { name: 'Get started' }).click();
    await page.getByRole('button', { name: 'Add receipt' }).click();
    await shot(page, '03-add-sheet');
    await page.getByRole('button', { name: 'Scan a receipt' }).click();
    await page.getByText('Which item is the warranty for?').waitFor();
    assert.equal(await page.getByPlaceholder('Dyson V15 vacuum').inputValue(), 'Noise-Cancelling Headphones');
    assert.equal(await page.getByPlaceholder('Best Buy').inputValue(), 'Northgate Electronics');
    assert.equal(await page.getByPlaceholder('0.00').inputValue(), '329.99');
    assert.equal(await page.locator('input[type=date]').inputValue(), '2026-11-02');
    assert.equal(await page.locator('.field select').inputValue(), 'electronics');
    assert.ok((await page.evaluate(() => window.__haptics || [])).includes('SUCCESS'), 'a successful scan gives a haptic tap');
    await shot(page, '04-review');
    await page.getByRole('button', { name: /USB-C Cable/ }).click();
    assert.equal(await page.getByPlaceholder('0.00').inputValue(), '14.99');
    await page.getByRole('button', { name: /Noise-Cancelling/ }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText('Want a reminder before this runs out?').waitFor();
    await shot(page, '05-reminder-prompt');
    await page.getByRole('button', { name: 'Turn on reminders' }).click();
    await page.waitForFunction(() => window.__notifications.pending.length === 3);
    const pending = await page.evaluate(() => window.__notifications.pending.map((n) => ({ id: n.id, title: n.title, at: new Date(n.schedule.at).toString() })));
    assert.ok(pending.every((n) => / 09:00:00 /.test(n.at)), 'reminders fire at 9am local');
    assert.ok(/warranty ends in 30 days/.test(pending[0].title));
    let d = await data(page);
    assert.equal(d.items[0].images.length, 1);
    assert.ok(d.items[0].thumb.startsWith('data:image/jpeg;base64,'));
    await page.locator('.receipt-paper img').waitFor();

    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'None' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText('Kept for your records.').waitFor();
    await page.waitForFunction(() => window.__notifications.pending.length === 0);
    d = await data(page);
    assert.equal(d.items[0].images.length, 1, 'editing keeps the photo');
    assert.equal(d.items[0].expiryDate, null);

    await page.getByRole('button', { name: 'Share proof of purchase' }).click();
    const shared = await page.evaluate(() => window.__shared[0]);
    assert.ok(shared.text.includes('Northgate Electronics') && shared.files.length === 1);

    await page.getByRole('button', { name: 'Delete item' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete item' }).click();
    await page.getByRole('heading', { name: 'Add your first receipt' }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.layer').length === 1);
    const left = await page.evaluate(() => [...window.__fs.keys()].filter((k) => k.includes('receipts/')));
    assert.deepEqual(left, [], 'deleting an item removes its photo file');
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ---- 3. A full vault: screens, search, settings, lock, backup, recovery ----
  {
    const { ctx, page, errors } = await open({ native: true, seed: true });
    await page.getByText('6 items covered, worth $2,431').waitFor();
    await shot(page, '06-vault');
    await page.getByRole('searchbox').fill('maple');
    assert.equal(await page.locator('.card').count(), 1);
    await page.getByRole('searchbox').fill('');
    const sections = await page.locator('.section-title').allTextContents();
    assert.deepEqual(sections, ['Ending soon', 'Covered', 'Ended']);
    assert.equal(await page.locator('.group-wrap', { hasText: 'Ending soon' }).locator('.card').count(), 2);
    await page.locator('.card', { hasText: 'Cordless vacuum' }).click();
    await page.locator('.receipt-paper img').waitFor();
    await shot(page, '07-detail');
    await page.locator('.receipt-paper').click();
    await page.getByRole('dialog', { name: 'Receipt photo' }).waitFor();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await page.locator('.card', { hasText: 'Dishwasher' }).click();
    await page.getByText(/Cover ended on/).waitFor();
    await shot(page, '08-detail-ended');
    await page.getByRole('button', { name: 'Back' }).click();

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByText('Allow notifications').waitFor();
    await shot(page, '09-settings');
    await page.getByRole('button', { name: 'Allow notifications' }).click();
    await page.waitForFunction(() => window.__notifications.pending.length > 0);
    const count = await page.evaluate(() => window.__notifications.pending.length);
    assert.ok(count > 5 && count <= 60, `sensible number of reminders queued (${count})`);
    await page.getByRole('button', { name: '14 days' }).click();
    await page.waitForFunction((n) => window.__notifications.pending.length > n, count).catch(async (e) => { console.log('pending now', await page.evaluate(() => window.__notifications.pending.length), 'was', count, await page.evaluate(() => JSON.parse(window.__fs.get('LIBRARY/vault/data.json')).settings.reminderDays)); throw e; });

    await page.getByRole('switch', { name: 'Lock the app' }).click();
    await page.waitForFunction(() => window.__privacyScreen === true);
    assert.equal((await data(page)).settings.appLock, true);

    await page.getByText('Export a spreadsheet').click();
    await page.waitForFunction(() => window.__shared?.length === 1);
    const csv = await page.evaluate(() => [...window.__fs.entries()].find(([k]) => k.endsWith('.csv')));
    assert.equal(csv, undefined, 'export file is cleaned up after sharing');
    await page.getByText('How your data is handled').click();
    await shot(page, '10-privacy');
    await page.getByRole('button', { name: 'Done' }).click();

    // Locked on next launch; a failed Face ID keeps it locked.
    await page.addInitScript(() => { window.__failUnlock = localStorage.getItem('__fail') === '1'; });
    await page.evaluate(() => localStorage.setItem('__fail', '1'));
    await page.reload();
    await page.getByText('That didn’t work. Try again.').waitFor({ timeout: 5000 }).catch(async (e) => { console.log('BODY:', (await page.evaluate(() => document.body.innerText)).slice(0, 200).replace(/\n/g, ' ~ '), '| fail flag:', await page.evaluate(() => [window.__failUnlock, localStorage.getItem('__fail'), JSON.parse(window.__fs.get('LIBRARY/vault/data.json')).settings.appLock])); throw e; });
    assert.equal(await page.locator('.card').count(), 0, 'nothing shown while locked');
    await shot(page, '11-locked');
    await page.evaluate(() => { window.__failUnlock = false; localStorage.setItem('__fail', '0'); });
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.getByText('6 items covered, worth $2,431').waitFor();

    // Damage the main data file: the spare copy must bring everything back.
    await page.evaluate(() => { const f = new Map(JSON.parse(localStorage.getItem('__fs'))); f.set('LIBRARY/vault/data.json', '{"items":[{"id":'); localStorage.setItem('__fs', JSON.stringify([...f])); });
    await page.reload();
    await page.getByText('6 items covered, worth $2,431').waitFor();

    // A write failure is reported, not swallowed.
    await page.evaluate(() => { window.__failWrites = true; });
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('select[aria-label="Currency"]').selectOption('CAD');
    await page.getByText('Changes are not being saved.').waitFor();
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ---- 4. Dark mode, small phone, hostile data ----
  {
    const { ctx, page, errors } = await open({ native: true, seed: true, dark: true });
    await page.getByText('6 items covered, worth $2,431').waitFor();
    await shot(page, '12-vault-dark');
    await page.locator('.card', { hasText: 'Running shoes' }).click();
    await page.locator('.receipt-paper img').waitFor();
    await shot(page, '13-detail-dark');
    await page.setViewportSize({ width: 320, height: 568 });
    await page.getByRole('button', { name: 'Back' }).click();
    await shot(page, '14-vault-small');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, 'no sideways scrolling on the smallest iPhone');

    // A hand-edited data file with script tags and path tricks stays inert.
    await page.evaluate(() => {
      const f = new Map(JSON.parse(localStorage.getItem('__fs')));
      const evil = { id: 'abcdef12-0000', productName: '<img src=x onerror="window.__pwned=1">', storeName: '=HYPERLINK("http://x")', category: 'nope', purchaseDate: '2026-13-45', price: 'NaN', warrantyMonths: 1e9, images: ['../../data.json', 'abcdef12-0000-1.jpg'], thumb: 'javascript:alert(1)', notes: 5 };
      const body = JSON.stringify({ version: 1, items: [evil, null, 7, { id: '../x' }], settings: { onboarded: true, reminderDays: ['x', -4, 99999], currency: 'ZZZ', dateOrder: 1 } });
      f.set('LIBRARY/vault/data.json', body); f.set('LIBRARY/vault/data.backup.json', body); localStorage.setItem('__fs', JSON.stringify([...f]));
    });
    await page.reload();
    await page.locator('.card').waitFor();
    assert.equal(await page.locator('.card').count(), 1);
    assert.equal(await page.evaluate(() => window.__pwned), undefined);
    await page.locator('.card').click();
    const clean = await page.evaluate(() => JSON.stringify(window.__notifications.pending));
    assert.equal(clean, '[]');
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log('all interface checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
