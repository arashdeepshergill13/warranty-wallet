import { useEffect, useState } from 'react';
import { Share } from '@capacitor/share';
import { Icon, Ring, Sheet, Group, Row, ringParts } from '../components/ui.jsx';
import { Screen, BackButton, NavButton } from '../components/nav.jsx';
import { categoryLabel, coverage, formatDate, formatMoney, monthsLabel, todayISO } from '../lib/warranty.js';
import { readImage, imageUri } from '../lib/storage.js';
import { isNative } from '../lib/native.js';
import { APP_NAME } from '../lib/config.js';

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
  const parts = ringParts(cov);

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
    ['Bought', formatDate(item.purchaseDate)],
    ['Price', item.price !== null ? formatMoney(item.price, settings.currency) : ''],
    ['Warranty', item.warrantyMonths ? `${monthsLabel(item.warrantyMonths)}${item.warrantyEstimated ? ' (estimate)' : ''}` : 'None'],
    ['Category', categoryLabel(item.category)],
    ['Serial number', item.serialNumber],
  ].filter(([, value]) => value);

  const statusLine =
    cov.state === 'none'
      ? item.warrantyMonths
        ? 'Add the purchase date to track this warranty.'
        : 'Kept for your records.'
      : cov.state === 'expired'
        ? `Cover ended on ${formatDate(item.expiryDate)}.`
        : `Covered until ${formatDate(item.expiryDate)}.`;

  return (
    <Screen
      title={item.productName}
      className="detail"
      left={<BackButton onClick={onBack} label={APP_NAME} />}
      right={
        <NavButton onClick={onEdit} label="Edit">
          Edit
        </NavButton>
      }
    >
      <section className={`hero is-${cov.state}`}>
        <Ring item={item} today={today} size={176} stroke={13}>
          <b className={parts.big.length > 3 ? 'is-word' : ''}>{parts.big}</b>
          <small>{parts.small}</small>
        </Ring>
        <h1>{item.productName}</h1>
        <p className="hero-status">{statusLine}</p>
      </section>

      <button className="btn btn-primary btn-wide" onClick={share}>
        <Icon name="share" size={19} weight={2.2} />
        Share proof of purchase
      </button>

      <Group footer={item.warrantyEstimated && cov.state !== 'none' ? 'The warranty length is an estimate for this kind of product. Check the box or manual, then tap Edit.' : null}>
        {facts.map(([label, value]) => (
          <Row key={label} title={label} value={value} />
        ))}
      </Group>

      {item.notes && (
        <Group header="Notes">
          <p className="notes">{item.notes}</p>
        </Group>
      )}

      {photos.length > 0 && (
        <section className="group-wrap">
          <h2 className="group-header">Receipt</h2>
          <div className="receipts">
            {photos.map((src, i) => (
              <button key={i} className="receipt-paper" onClick={() => onViewPhoto(src)} aria-label="View the receipt full size">
                <img src={src} alt={`Receipt photo ${i + 1}`} />
              </button>
            ))}
          </div>
        </section>
      )}

      <Group>
        <Row title="Delete item" danger onClick={() => setConfirming(true)} />
      </Group>

      {confirming && (
        <Sheet title={`Delete ${item.productName}?`} message="The receipt photo and its reminders are removed from this phone. This can’t be undone." onClose={() => setConfirming(false)}>
          <button className="btn btn-danger btn-wide" onClick={onDelete}>
            Delete item
          </button>
          <button className="btn btn-plain btn-wide" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </Sheet>
      )}
    </Screen>
  );
}
