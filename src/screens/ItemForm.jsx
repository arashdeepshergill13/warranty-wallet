import { useMemo, useState } from 'react';
import { Icon, Group } from '../components/ui.jsx';
import { Screen, NavButton } from '../components/nav.jsx';
import { CATEGORIES, WARRANTY_CHOICES, categoryLabel, defaultMonths, expiryFor, formatDate, formatMoney, isValidISO, monthsLabel, todayISO } from '../lib/warranty.js';
import { guessCategory } from '../lib/parser.js';
import { select } from '../lib/haptics.js';

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

// A form row in the iPhone style: label on the left, the value you edit on the right.
function Field({ label, flag, children }) {
  return (
    <label className={`row field${flag ? ' is-flagged' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {flag && <span className="flag">Check</span>}
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
  const shownErrors = [tried && errors.productName, tried && errors.price, errors.purchaseDate].filter(Boolean);
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
    select();
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
    select();
    setF((prev) => ({ ...prev, warrantyMonths: months, warrantyEstimated: false }));
    setTouched((prev) => ({ ...prev, warrantyMonths: true }));
  };

  const submit = async (e) => {
    e?.preventDefault();
    setTried(true);
    if (hasErrors || saving) return;
    setSaving(true);
    try {
      await onSave({ ...f, productName: f.productName.trim(), price, warrantyMonths: Number(f.warrantyMonths) || 0 });
    } finally {
      setSaving(false);
    }
  };

  const toCheck = ['productName', 'storeName', 'purchaseDate'].filter(flagged).length + (flagged('warrantyMonths') && f.warrantyEstimated ? 1 : 0);
  const months = Number(f.warrantyMonths) || 0;

  return (
    <Screen
      title={draft.isNew ? 'New item' : 'Edit item'}
      className="form"
      left={<NavButton onClick={onCancel}>Cancel</NavButton>}
      right={
        <NavButton strong onClick={submit} disabled={saving}>
          Save
        </NavButton>
      }
    >
      <form onSubmit={submit} noValidate>
        {preview && (
          <button type="button" className="scan-result" onClick={onViewPhoto} aria-label="View the receipt photo">
            <img src={preview} alt="" />
            <span>
              {draft.readNothing ? (
                <>
                  <b>Couldn’t read this receipt</b>
                  The photo is saved. Fill in the details yourself.
                </>
              ) : draft.isNew && draft.images ? (
                <>
                  <b>Read from your receipt</b>
                  {toCheck > 0 ? `Check the ${toCheck === 1 ? 'marked detail' : `${toCheck} marked details`}, then save.` : 'Looks complete. Save when you’re ready.'}
                </>
              ) : (
                <>
                  <b>Receipt photo</b>
                  Tap to view it full size.
                </>
              )}
            </span>
            <Icon name="chevron" size={15} weight={2.4} />
          </button>
        )}

        {draft.foundItems.length > 1 && (
          <Group header="Which item is the warranty for?">
            {draft.foundItems.slice(0, 12).map((item, i) => {
              const on = f.productName === item.name;
              return (
                <button type="button" key={i} className="row is-tappable pick" aria-pressed={on} onClick={() => pickFound(item)}>
                  <span className="row-title">{item.name}</span>
                  <span className="row-value">{formatMoney(item.price, settings.currency)}</span>
                  <span className={`pick-mark${on ? ' is-on' : ''}`}>
                    <Icon name="check" size={17} weight={2.8} />
                  </span>
                </button>
              );
            })}
          </Group>
        )}

        <Group footer={shownErrors.length ? <span className="error-text">{shownErrors.join(' ')}</span> : null}>
          <Field label="Name" flag={flagged('productName')}>
            <input value={f.productName} onChange={(e) => set('productName', e.target.value)} placeholder="Dyson V15 vacuum" maxLength={120} autoCapitalize="words" enterKeyHint="next" />
          </Field>
          <Field label="Store" flag={flagged('storeName')}>
            <input value={f.storeName} onChange={(e) => set('storeName', e.target.value)} placeholder="Best Buy" maxLength={80} autoCapitalize="words" enterKeyHint="next" />
          </Field>
          <Field label="Price">
            <input value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="0.00" inputMode="decimal" maxLength={12} />
          </Field>
          <Field label="Bought" flag={flagged('purchaseDate')}>
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
        </Group>

        <Group
          header={
            <>
              Warranty length
              {flagged('warrantyMonths') && f.warrantyEstimated && <span className="flag">Check</span>}
            </>
          }
          footer={
            f.warrantyEstimated && months > 0
              ? `${monthsLabel(months)} is typical for ${categoryLabel(f.category).toLowerCase()}, not a fact about this product. The box or manual has the real length.`
              : null
          }
        >
          <div className="row pills-row">
            <div className="pills">
              {WARRANTY_CHOICES.map((c) => {
                const on = !customLength && months === c.months;
                return (
                  <button
                    type="button"
                    key={c.months}
                    className={`pill${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      setCustomLength(false);
                      setLength(c.months);
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
              <button type="button" className={`pill${customLength ? ' is-on' : ''}`} aria-pressed={customLength} onClick={() => setCustomLength(true)}>
                Other
              </button>
            </div>
          </div>
          {customLength && (
            <Field label="Months">
              <input type="number" inputMode="numeric" min="1" max="600" value={f.warrantyMonths || ''} onChange={(e) => setLength(Math.min(600, Math.max(0, Math.round(Number(e.target.value) || 0))))} aria-label="Warranty length in months" />
            </Field>
          )}
          <div className="row">
            <span className="row-title">{months > 0 ? 'Covered until' : 'No warranty'}</span>
            <span className="row-value">{expiry ? formatDate(expiry) : months > 0 ? 'Add the purchase date' : 'Receipt is still kept'}</span>
          </div>
        </Group>

        <Group header="Optional">
          <Field label="Serial no.">
            <input value={f.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} placeholder="For claims" maxLength={60} autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
          </Field>
          <label className="row field is-notes">
            <span className="field-label">Notes</span>
            <textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={3} maxLength={2000} placeholder="Extended cover, who to call, where the box is" />
          </label>
        </Group>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Screen>
  );
}
