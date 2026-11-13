import { useEffect, useState } from 'react';
import { Share } from '@capacitor/share';
import { TopBar, Icon, Countdown, CoverageBar, Sheet } from '../components/ui.jsx';
import { categoryLabel, coverage, formatDate, formatMoney, monthsLabel, todayISO } from '../lib/warranty.js';
import { readImage, imageUri } from '../lib/storage.js';
import { isNative } from '../lib/native.js';

function proofText(item, settings) {
  return [
    `Proof of purchase: ${item.productName}`,
    item.storeName && `Store: ${item.storeName}`,
    item.purchaseDate && `Bought: ${formatDate(item.purchaseDate)}`,
    item.price !== null && `Price: ${formatMoney(item.price, settings.currency)}`,
    item.serialNumber && `Serial number: ${item.serialNumber}`,
    item.expiryDate && `Warranty until: ${formatDate(item.expiryDate)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export default function Detail({ item, settings, onBack, onEdit, onDelete, onViewPhoto, notify }) {
  const [photos, setPhotos] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const today = todayISO();
  const cov = coverage(item, today);

  useEffect(() => {
    let live = true;
    Promise.all(item.images.map((name) => readImage(name).catch(() => null))).then((list) => live && setPhotos(list.filter(Boolean)));
    return () => {
      live = false;
    };
  }, [item.images]);

  const share = async () => {
    const text = proofText(item, settings);
    try {
      if (isNative) {
        const files = [];
        for (const name of item.images) files.push(await imageUri(name));
        await Share.share(files.length ? { text, files } : { text });
      } else if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        notify('Details copied');
      }
    } catch (err) {
      if (!/cancel|abort/i.test(String(err?.message || err?.name || err))) notify('Could not share this item');
    }
  };

  const facts = [
    ['Store', item.storeName],
    ['Bought on', formatDate(item.purchaseDate)],
    ['Price', item.price !== null ? formatMoney(item.price, settings.currency) : ''],
    ['Warranty', item.warrantyMonths ? `${monthsLabel(item.warrantyMonths)}${item.warrantyEstimated ? ' (estimate)' : ''}` : 'None'],
    ['Category', categoryLabel(item.category)],
    ['Serial number', item.serialNumber],
  ].filter(([, value]) => value);

  return (
    <div className="screen detail">
      <TopBar
        title=""
        onBack={onBack}
        action={
          <button className="iconbtn" onClick={onEdit} aria-label="Edit">
            <Icon name="pencil" />
          </button>
        }
      />

      <section className={`status is-${cov.state}`}>
        <h1 className="detail-name">{item.productName}</h1>
        <p className="status-count">
          <Countdown item={item} today={today} big />
        </p>
        <CoverageBar item={item} today={today} />
        <p className="status-line">
          {cov.state === 'none'
            ? item.warrantyMonths
              ? 'Add the purchase date to track this warranty.'
              : 'Kept for your records.'
            : cov.state === 'expired'
              ? `Cover ended on ${formatDate(item.expiryDate)}.`
              : `Covered until ${formatDate(item.expiryDate)}.`}
        </p>
        {item.warrantyEstimated && cov.state !== 'none' && (
          <p className="status-note">The warranty length is an estimate for this kind of product. Check the box or manual, then edit it here.</p>
        )}
      </section>

      <dl className="facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {item.notes && <p className="notes">{item.notes}</p>}

      {photos.length > 0 && (
        <section className="receipts">
          <h2>Receipt</h2>
          {photos.map((src, i) => (
            <button key={i} className="receipt-paper" onClick={() => onViewPhoto(src)} aria-label="View the receipt full size">
              <img src={src} alt={`Receipt photo ${i + 1}`} />
            </button>
          ))}
        </section>
      )}

      <div className="actions">
        <button className="btn btn-primary btn-wide" onClick={share}>
          <Icon name="share" size={20} />
          Share proof of purchase
        </button>
        <button className="btn btn-quiet btn-wide is-danger" onClick={() => setConfirming(true)}>
          Delete item
        </button>
      </div>

      {confirming && (
        <Sheet title={`Delete ${item.productName}?`} onClose={() => setConfirming(false)}>
          <p className="sheet-text">The receipt photo and its reminders are removed from this phone. This can’t be undone.</p>
          <button className="btn btn-danger btn-wide" onClick={onDelete}>
            Delete item
          </button>
          <button className="btn btn-quiet btn-wide" onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </Sheet>
      )}
    </div>
  );
}
