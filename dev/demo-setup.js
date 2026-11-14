// Demo mode for showing the app in a web browser. It stands in for the iPhone:
// "Scan a receipt" uses sample receipts, Face ID always succeeds, and data is
// kept in this browser. Real receipt reading only happens in the iPhone app.

const SAMPLES = [
  {
    store: 'NORTHGATE ELECTRONICS',
    rows: [
      ['Store 114, 20 Harbour Way', 0.2, 0.09, 0.6],
      ['@DATE  13:05', 0.3, 0.14, 0.4],
      ['4418 NOISE-CANCELLING HEADPHONES', 0.08, 0.24, 0.6],
      ['329.99', 0.78, 0.2405, 0.14],
      ['7720 USB-C CABLE 2M', 0.08, 0.29, 0.4],
      ['14.99', 0.8, 0.2903, 0.12],
      ['SUBTOTAL', 0.08, 0.38, 0.3],
      ['344.98', 0.78, 0.38, 0.14],
      ['TAX', 0.08, 0.42, 0.2],
      ['44.85', 0.8, 0.42, 0.12],
      ['TOTAL', 0.08, 0.47, 0.2],
      ['389.83', 0.78, 0.47, 0.14],
      ['CARD ************4821', 0.08, 0.55, 0.5],
      ['Thank you for shopping with us', 0.15, 0.7, 0.7],
    ],
    daysAgo: 3,
  },
  {
    store: 'MAPLE HARDWARE',
    rows: [
      ['88 Station Rd', 0.25, 0.09, 0.5],
      ['@DATE  10:41', 0.3, 0.14, 0.4],
      ['55102 20V CORDLESS DRILL KIT', 0.08, 0.24, 0.6],
      ['189.00', 0.78, 0.2402, 0.14],
      ['40021 DRILL BIT SET 30PC', 0.08, 0.29, 0.5],
      ['24.99', 0.8, 0.2901, 0.12],
      ['3 YEAR LIMITED WARRANTY ON TOOLS', 0.08, 0.34, 0.7],
      ['SUBTOTAL', 0.08, 0.42, 0.3],
      ['213.99', 0.78, 0.42, 0.14],
      ['TAX', 0.08, 0.46, 0.2],
      ['27.82', 0.8, 0.46, 0.12],
      ['TOTAL', 0.08, 0.51, 0.2],
      ['241.81', 0.78, 0.51, 0.14],
      ['Keep this receipt for returns', 0.15, 0.7, 0.7],
    ],
    daysAgo: 1,
  },
  {
    store: 'HARBOUR HOME',
    rows: [
      ['1200 Lakeshore Blvd', 0.22, 0.09, 0.56],
      ['@DATE  16:20', 0.3, 0.14, 0.4],
      ['30087 ESPRESSO MACHINE', 0.08, 0.24, 0.5],
      ['349.00', 0.78, 0.2404, 0.14],
      ['SUBTOTAL', 0.08, 0.34, 0.3],
      ['349.00', 0.78, 0.34, 0.14],
      ['TAX', 0.08, 0.38, 0.2],
      ['45.37', 0.8, 0.38, 0.12],
      ['TOTAL', 0.08, 0.43, 0.2],
      ['394.37', 0.78, 0.43, 0.14],
      ['Thank you', 0.38, 0.62, 0.24],
    ],
    daysAgo: 6,
  },
];

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const monthsAgo = (months, days = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(d.getDate() - days);
  return iso(d);
};

function drawReceipt(rows, w = 600, h = 900) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#fdfdfb';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#2a2e38';
  rows.forEach(([text, x, y], i) => {
    g.font = `${i === 0 ? 'bold 30' : '24'}px "SF Mono", Menlo, "DejaVu Sans Mono", monospace`;
    g.fillText(text, x * w, y * h + 20);
  });
  return c.toDataURL('image/jpeg', 0.8).split(',')[1];
}

let nextSample = 0;
function sampleScan() {
  const sample = SAMPLES[nextSample % SAMPLES.length];
  nextSample += 1;
  const d = daysAgo(sample.daysAgo);
  const printed = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  const rows = [[sample.store, 0.2, 0.05, 0.6], ...sample.rows].map(([t, x, y, w]) => [t.replace('@DATE', printed), x, y, w]);
  return {
    cancelled: false,
    pages: [{ image: drawReceipt(rows), lines: rows.map(([text, x, y, w]) => ({ text, x, y, w, h: 0.022 })) }],
  };
}

function note(message) {
  const el = document.createElement('div');
  el.className = 'demo-note';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function persist() {
  try {
    localStorage.setItem('__fs', JSON.stringify([...window.__fs]));
  } catch {
    // storage full or blocked: the demo keeps working for this visit
  }
}

async function seed() {
  const items = [
    ['Cordless vacuum', 'Harbour Home', 'appliance', monthsAgo(11, 18), 499.99, 12, false, 'HH-V15-0098213', 'Box is in the hall cupboard.'],
    ['Running shoes', 'Trailhead Sports', 'clothing', monthsAgo(2, 5), 164.0, 3, true, '', ''],
    ['Noise-cancelling headphones', 'Northgate Electronics', 'electronics', monthsAgo(8), 329.99, 12, false, '4021557A8', ''],
    ['55-inch television', 'Northgate Electronics', 'electronics', monthsAgo(4), 899.0, 24, false, 'TV55-7H2K-11904', ''],
    ['Dishwasher', 'Harbour Home', 'appliance', monthsAgo(30), 1049.0, 24, false, '', ''],
  ];
  const built = await Promise.all(
    items.map(([productName, storeName, category, purchaseDate, price, warrantyMonths, warrantyEstimated, serialNumber, notes], n) => {
      const id = `de300000-${pad(n)}00`;
      const rows = [
        [storeName.toUpperCase(), 0.12, 0.05],
        ['Receipt', 0.12, 0.1],
        [purchaseDate.replace(/-/g, '/'), 0.12, 0.15],
        [productName.toUpperCase().slice(0, 24), 0.08, 0.26],
        [price.toFixed(2), 0.72, 0.31],
        ['TOTAL', 0.08, 0.42],
        [(price * 1.13).toFixed(2), 0.72, 0.42],
        ['Thank you', 0.3, 0.6],
      ];
      const full = drawReceipt(rows);
      window.__fs.set(`LIBRARY/vault/receipts/${id}-0.jpg`, full);
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = c.height = 132;
          c.getContext('2d').drawImage(img, 0, 0, 600, 600, 0, 0, 132, 132);
          const stamp = new Date(Date.now() - (n + 1) * 86400000).toISOString();
          resolve({ id, productName, storeName, category, purchaseDate, price, warrantyMonths, warrantyEstimated, serialNumber, notes, images: [`${id}-0.jpg`], thumb: c.toDataURL('image/jpeg', 0.6), createdAt: stamp, updatedAt: stamp });
        };
        img.onerror = () => resolve(null);
        img.src = `data:image/jpeg;base64,${full}`;
      });
    })
  );
  const body = JSON.stringify({ version: 1, items: built.filter(Boolean), settings: { onboarded: false } });
  window.__fs.set('LIBRARY/vault/data.json', body);
  window.__fs.set('LIBRARY/vault/data.backup.json', body);
  persist();
}

function addDemoBar() {
  const bar = document.createElement('div');
  bar.className = 'demo-bar';
  const text = document.createElement('p');
  text.textContent = 'Demo. Scanning uses sample receipts; the iPhone app reads real ones. What you add stays in this browser.';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset demo';
  reset.addEventListener('click', () => {
    try {
      localStorage.removeItem('__fs');
    } catch {
      // nothing saved
    }
    location.reload();
  });
  bar.append(text, reset);
  document.body.insertBefore(bar, document.getElementById('root'));
}

export async function startDemo() {
  window.__NATIVE__ = true;
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem('__fs') || '[]');
  } catch {
    saved = [];
  }
  window.__fs = new Map(saved);
  window.__notifications = { permission: 'prompt', pending: [], listeners: [] };
  window.__plugins = {
    WalletNative: {
      isScannerAvailable: () => ({ available: true }),
      scanDocument: () => new Promise((resolve) => setTimeout(() => resolve(sampleScan()), 450)),
      recognizeText: () => ({ lines: [] }),
      lockStatus: () => ({ available: true, kind: 'faceID' }),
      authenticate: () => new Promise((resolve) => setTimeout(() => resolve({ available: true, success: true }), 350)),
      setPrivacyScreen: () => {},
      openSettings: () => note('On iPhone this opens Settings for the app.'),
    },
  };
  window.__demoShare = () => note('On iPhone this opens the share sheet.');
  addDemoBar();
  if (!window.__fs.has('LIBRARY/vault/data.json')) await seed();
}
