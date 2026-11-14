import { useMemo, useState } from 'react';
import { Icon, CategoryTile, Ring, shortLeft } from '../components/ui.jsx';
import { Screen, NavButton } from '../components/nav.jsx';
import { categoryLabel, coverage, formatMoney, sortForVault, todayISO } from '../lib/warranty.js';
import { APP_NAME } from '../lib/config.js';

const SECTIONS = [
  { state: 'soon', title: 'Ending soon' },
  { state: 'active', title: 'Covered' },
  { state: 'none', title: 'No warranty' },
  { state: 'expired', title: 'Ended' },
];

function summaryLine(items, today, currency) {
  const covered = items.filter((i) => ['active', 'soon'].includes(coverage(i, today).state));
  if (!covered.length) return 'Nothing is under warranty right now';
  const worth = covered.reduce((sum, i) => sum + (i.price || 0), 0);
  const count = covered.length === 1 ? '1 item covered' : `${covered.length} items covered`;
  return worth > 0 ? `${count}, worth ${formatMoney(Math.round(worth), currency).replace(/[.,]00$/, '')}` : count;
}

export default function Vault({ items, settings, onOpen, onAdd, onSettings }) {
  const [query, setQuery] = useState('');
  const today = todayISO();

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = sortForVault(items, today).filter(
      (item) => !q || [item.productName, item.storeName, item.serialNumber, item.notes].some((v) => (v || '').toLowerCase().includes(q))
    );
    return SECTIONS.map((s) => ({ ...s, items: matches.filter((i) => coverage(i, today).state === s.state) })).filter((s) => s.items.length);
  }, [items, query, today]);

  return (
    <Screen
      title={APP_NAME}
      largeTitle
      subtitle={items.length ? summaryLine(items, today, settings.currency) : null}
      className="vault"
      right={
        <NavButton onClick={onSettings} label="Settings">
          <Icon name="gear" size={23} />
        </NavButton>
      }
      dock={
        <button className="fab" onClick={onAdd}>
          <Icon name="plus" size={20} weight={2.6} />
          Add receipt
        </button>
      }
    >
      {items.length === 0 ? (
        <section className="empty">
          <div className="empty-art" aria-hidden="true">
            <span className="empty-card is-back" />
            <span className="empty-card is-mid" />
            <span className="empty-card is-front">
              <i />
              <i />
              <i className="short" />
              <b>
                <Icon name="check" size={18} weight={3} />
              </b>
            </span>
          </div>
          <h2>Add your first receipt</h2>
          <p>Scan it once. Get a reminder before the warranty runs out.</p>
        </section>
      ) : (
        <>
          {items.length > 3 && (
            <label className="search">
              <Icon name="search" size={17} weight={2.2} />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search items and stores" autoCorrect="off" enterKeyHint="search" />
            </label>
          )}
          {sections.map((section) => (
            <section key={section.state} className="group-wrap">
              <h2 className="section-title">{section.title}</h2>
              <ul className="group">
                {section.items.map((item) => {
                  const cov = coverage(item, today);
                  return (
                    <li key={item.id}>
                      <button className="row is-tappable card" onClick={() => onOpen(item.id)}>
                        <CategoryTile category={item.category} />
                        <span className="card-main">
                          <span className="card-name">{item.productName}</span>
                          <span className="card-sub">{item.storeName || categoryLabel(item.category)}</span>
                        </span>
                        <span className={`card-left is-${cov.state}`}>{shortLeft(cov)}</span>
                        <Ring item={item} today={today} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {sections.length === 0 && <p className="none-found">No results for “{query.trim()}”</p>}
        </>
      )}
    </Screen>
  );
}
