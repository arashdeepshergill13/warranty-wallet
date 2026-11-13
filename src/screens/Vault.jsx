import { useMemo, useState } from 'react';
import { Icon, Countdown, CoverageBar, Thumb } from '../components/ui.jsx';
import { coverage, formatDate, formatMoney, humanSpan, sortForVault, todayISO } from '../lib/warranty.js';
import { APP_NAME } from '../lib/config.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'soon', label: 'Ending soon' },
  { id: 'active', label: 'Covered' },
  { id: 'expired', label: 'Ended' },
];

function summary(items, today) {
  const states = items.map((i) => ({ item: i, cov: coverage(i, today) }));
  const covered = states.filter((s) => s.cov.state === 'active' || s.cov.state === 'soon');
  const next = covered.sort((a, b) => a.cov.daysLeft - b.cov.daysLeft)[0];
  return { covered: covered.length, total: items.length, next };
}

export default function Vault({ items, settings, onOpen, onAdd, onSettings }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const today = todayISO();
  const info = useMemo(() => summary(items, today), [items, today]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortForVault(items, today).filter((item) => {
      const state = coverage(item, today).state;
      if (filter === 'soon' && state !== 'soon') return false;
      if (filter === 'active' && state !== 'active' && state !== 'soon') return false;
      if (filter === 'expired' && state !== 'expired') return false;
      if (!q) return true;
      return [item.productName, item.storeName, item.serialNumber, item.notes].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [items, query, filter, today]);

  return (
    <div className="screen">
      <header className="vault-head">
        <div className="vault-brand">
          <span className="brand">{APP_NAME}</span>
          <button className="iconbtn" onClick={onSettings} aria-label="Settings">
            <Icon name="gear" />
          </button>
        </div>
        {items.length > 0 && (
          <>
            <p className="vault-lead">
              {info.covered === 0
                ? 'Nothing is under warranty right now.'
                : info.covered === info.total
                  ? info.total === 1
                    ? 'Your 1 item is covered.'
                    : `All ${info.total} of your items are covered.`
                  : `${info.covered} of your ${info.total} items are covered.`}
            </p>
            {info.next && (
              <p className="vault-next">
                Next to end: {info.next.item.productName},{' '}
                {info.next.cov.daysLeft === 0 ? 'today' : info.next.cov.daysLeft === 1 ? 'tomorrow' : `in ${humanSpan(info.next.cov.daysLeft)}`}.
              </p>
            )}
          </>
        )}
      </header>

      {items.length === 0 ? (
        <section className="empty">
          <div className="empty-slip" aria-hidden="true">
            <span />
            <span />
            <span className="short" />
            <b>Covered</b>
          </div>
          <h2>Add your first receipt</h2>
          <p>Scan it once. You get a reminder before the warranty runs out, and the receipt is here when something breaks.</p>
        </section>
      ) : (
        <>
          {items.length > 3 && (
            <div className="finder">
              <label className="search">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search items and stores"
                  aria-label="Search items and stores"
                  autoCorrect="off"
                />
              </label>
              <div className="chips" role="tablist" aria-label="Show">
                {FILTERS.map((f) => (
                  <button key={f.id} role="tab" aria-selected={filter === f.id} className={`chip${filter === f.id ? ' is-on' : ''}`} onClick={() => setFilter(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <ul className="list">
            {shown.map((item) => (
              <li key={item.id}>
                <button className="card" onClick={() => onOpen(item.id)}>
                  <Thumb item={item} />
                  <span className="card-main">
                    <span className="card-name">{item.productName}</span>
                    <span className="card-sub">
                      {[item.storeName, item.price !== null ? formatMoney(item.price, settings.currency) : ''].filter(Boolean).join(', ') || 'No store added'}
                    </span>
                  </span>
                  <span className="card-side">
                    <Countdown item={item} today={today} />
                    {item.expiryDate && <span className="card-date">{formatDate(item.expiryDate)}</span>}
                  </span>
                  <CoverageBar item={item} today={today} />
                </button>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="none-found">Nothing matches. Try a different search or filter.</p>}
        </>
      )}

      <div className="dock">
        <button className="btn btn-primary btn-wide" onClick={onAdd}>
          <Icon name="plus" size={20} />
          Add a receipt
        </button>
      </div>
    </div>
  );
}
