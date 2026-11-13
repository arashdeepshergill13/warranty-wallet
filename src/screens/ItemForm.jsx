import { useMemo, useState } from 'react';
import { TopBar } from '../components/ui.jsx';
import { CATEGORIES, WARRANTY_CHOICES, categoryLabel, defaultMonths, expiryFor, formatDate, formatMoney, isValidISO, monthsLabel, todayISO } from '../lib/warranty.js';
import { guessCategory } from '../lib/parser.js';

export function emptyDraft() {
  return {
    isNew: true,
    images: null,
    foundItems: [],
    check: [],
    fields: { productName: '', storeName: '', category: 'other', purchaseDate: todayISO(), price: '', warrantyMonths: 12, warrantyEstimated: true, serialNumber: '', notes: '' },
  };
}

export function draftFromScan(parsed, images) {
  return {
    isNew: true,
    images,
    foundItems: parsed.items || [],
    check: parsed.check || [],
    readNothing: !parsed.foundText,
    fields: {
      productName: parsed.productName || '',
      storeName: parsed.storeName || '',
      category: parsed.category || 'other',
      purchaseDate: parsed.purchaseDate || '',
      price: parsed.price === null || parsed.price === undefined ? '' : String(parsed.price.toFixed(2)),
      warrantyMonths: parsed.warrantyMonths ?? 12,
      warrantyEstimated: parsed.warrantyEstimated !== false,
      serialNumber: parsed.serialNumber || '',
      notes: '',
    },
  };
}

export function draftFromItem(item) {
  return {
    isNew: false,
    images: null,
    foundItems: [],
    check: [],
    fields: { ...item, price: item.price === null ? '' : String(item.price.toFixed(2)) },
  };
}

function Field({ label, flag, hint, error, children }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {flag && <mark className="flag">Check this</mark>}
      </span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export default function ItemForm({ draft, settings, preview, onSave, onCancel, onViewPhoto }) {
  const [f, setF] = useState(draft.fields);
  const [touched, setTouched] = useState({});
  const [customLength, setCustomLength] = useState(!WARRANTY_CHOICES.some((c) => c.months === Number(draft.fields.warrantyMonths)));
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const set = (name, value) => {
    setF((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  };
  const flagged = (name) => draft.check.includes(name) && !touched[name];

  const price = f.price === '' ? null : Number(String(f.price).replace(',', '.'));
  const errors = {
    productName: f.productName.trim() ? null : 'Add a name so you can find this later.',
    price: price === null || (Number.isFinite(price) && price >= 0) ? null : 'Use numbers only, like 399.99.',
    purchaseDate: !f.purchaseDate || (isValidISO(f.purchaseDate) && f.purchaseDate <= todayISO()) ? null : 'The purchase date can’t be in the future.',
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const expiry = useMemo(() => expiryFor(f.purchaseDate, f.warrantyMonths), [f.purchaseDate, f.warrantyMonths]);

  const setCategory = (category) => {
    setF((prev) => ({
      ...prev,
      category,
      warrantyMonths: prev.warrantyEstimated && !touched.warrantyMonths ? defaultMonths(category) : prev.warrantyMonths,
    }));
    setTouched((prev) => ({ ...prev, category: true }));
  };

  const pickFound = (item) => {
    const category = touched.category ? f.category : guessCategory(item.name, f.category);
    setF((prev) => ({
      ...prev,
      productName: item.name,
      price: item.price.toFixed(2),
      category,
      warrantyMonths: prev.warrantyEstimated && !touched.warrantyMonths ? defaultMonths(category) : prev.warrantyMonths,
    }));
    setTouched((prev) => ({ ...prev, productName: true, price: true }));
  };

  const setLength = (months) => {
    setF((prev) => ({ ...prev, warrantyMonths: months, warrantyEstimated: false }));
    setTouched((prev) => ({ ...prev, warrantyMonths: true }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setTried(true);
    if (hasErrors || saving) return;
    setSaving(true);
    try {
      await onSave({ ...f, productName: f.productName.trim(), price, warrantyMonths: Number(f.warrantyMonths) || 0 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="screen form" onSubmit={submit} noValidate>
      <TopBar title={draft.isNew ? 'New item' : 'Edit item'} onBack={onCancel} backLabel="Cancel" />

      {preview && (
        <button type="button" className="form-photo" onClick={onViewPhoto} aria-label="View the receipt photo">
          <img src={preview} alt="" />
          <span>
            {draft.readNothing ? (
              <>
                <b>We couldn’t read this one</b>
                The photo is saved. Fill in the details below.
              </>
            ) : draft.isNew && draft.images ? (
              <>
                <b>Read from your receipt</b>
                Check the details, then save. Nothing left your phone.
              </>
            ) : (
              <>
                <b>Receipt photo</b>
                Tap to view it full size.
              </>
            )}
          </span>
        </button>
      )}

      {draft.foundItems.length > 1 && (
        <fieldset className="found">
          <legend>Which item is the warranty for?</legend>
          <div className="found-list">
            {draft.foundItems.slice(0, 12).map((item, i) => (
              <button type="button" key={i} className={`found-item${f.productName === item.name ? ' is-on' : ''}`} onClick={() => pickFound(item)}>
                <span>{item.name}</span>
                <span>{formatMoney(item.price, settings.currency)}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <Field label="What is it?" flag={flagged('productName')} error={tried && errors.productName}>
        <input value={f.productName} onChange={(e) => set('productName', e.target.value)} placeholder="Dyson V15 vacuum" maxLength={120} autoCapitalize="words" enterKeyHint="next" />
      </Field>

      <div className="field-row">
        <Field label="Store" flag={flagged('storeName')}>
          <input value={f.storeName} onChange={(e) => set('storeName', e.target.value)} placeholder="Best Buy" maxLength={80} autoCapitalize="words" />
        </Field>
        <Field label="Price" error={tried && errors.price}>
          <input value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="0.00" inputMode="decimal" maxLength={12} />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Bought on" flag={flagged('purchaseDate')} error={errors.purchaseDate}>
          <input type="date" value={f.purchaseDate} max={todayISO()} onChange={(e) => set('purchaseDate', e.target.value)} />
        </Field>
        <Field label="Category">
          <select value={f.category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="length">
        <legend>
          How long is the warranty?
          {flagged('warrantyMonths') && f.warrantyEstimated && <mark className="flag">Check this</mark>}
        </legend>
        <div className="chips chips-wrap">
          {WARRANTY_CHOICES.map((c) => (
            <button
              type="button"
              key={c.months}
              className={`chip${!customLength && Number(f.warrantyMonths) === c.months ? ' is-on' : ''}`}
              aria-pressed={!customLength && Number(f.warrantyMonths) === c.months}
              onClick={() => {
                setCustomLength(false);
                setLength(c.months);
              }}
            >
              {c.label}
            </button>
          ))}
          <button type="button" className={`chip${customLength ? ' is-on' : ''}`} aria-pressed={customLength} onClick={() => setCustomLength(true)}>
            Other
          </button>
        </div>
        {customLength && (
          <label className="length-custom">
            <input type="number" inputMode="numeric" min="1" max="600" value={f.warrantyMonths || ''} onChange={(e) => setLength(Math.min(600, Math.max(0, Math.round(Number(e.target.value) || 0))))} aria-label="Warranty length in months" />
            months
          </label>
        )}
        <p className="length-result">
          {expiry ? (
            <>
              Covered until <b>{formatDate(expiry)}</b>
            </>
          ) : Number(f.warrantyMonths) > 0 ? (
            'Add the purchase date to see when cover ends.'
          ) : (
            'No warranty. The receipt is still kept.'
          )}
        </p>
        {f.warrantyEstimated && Number(f.warrantyMonths) > 0 && (
          <p className="length-note">
            {monthsLabel(f.warrantyMonths)} is typical for {categoryLabel(f.category).toLowerCase()}, not a fact about this product. The box or manual has the real length.
          </p>
        )}
      </fieldset>

      <Field label="Serial number" hint="Optional. Handy when you make a claim.">
        <input value={f.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} maxLength={60} autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
      </Field>

      <Field label="Notes" hint="Optional. Extended cover, who to call, where the box is.">
        <textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={3} maxLength={2000} />
      </Field>

      <div className="dock">
        <button type="submit" className="btn btn-primary btn-wide" disabled={saving}>
          {saving ? 'Saving' : draft.isNew ? 'Save item' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
