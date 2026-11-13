import { useEffect } from 'react';
import { coverage, countdownText } from '../lib/warranty.js';

const PATHS = {
  back: 'M15 5l-7 7 7 7',
  gear: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 13.5l1.6 1.2-1.9 3.3-1.9-.7a7.6 7.6 0 01-1.7 1l-.3 2H11.4l-.3-2a7.6 7.6 0 01-1.7-1l-1.9.7-1.9-3.3 1.6-1.2a7.4 7.4 0 010-2L5.6 10.3l1.9-3.3 1.9.7a7.6 7.6 0 011.7-1l.3-2h3.8l.3 2a7.6 7.6 0 011.7 1l1.9-.7 1.9 3.3-1.6 1.2a7.4 7.4 0 010 2z',
  plus: 'M12 5v14M5 12h14',
  scan: 'M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16M8 9h8M8 12h8M8 15h5',
  photo: 'M4 6.5A1.5 1.5 0 015.5 5h13A1.5 1.5 0 0120 6.5v11a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5v-11zM4 15l4.5-4.5 4 4 2.5-2.5L20 17M15 9.5a.5.5 0 100-1 .5.5 0 000 1z',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  bell: 'M6 10a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM10 19a2 2 0 004 0',
  lock: 'M7 11V8a5 5 0 0110 0v3M6 11h12a1 1 0 011 1v7a1 1 0 01-1 1H6a1 1 0 01-1-1v-7a1 1 0 011-1z',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5',
  share: 'M12 15V4M8 8l4-4 4 4M5 13v5.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V13',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 5l7 7-7 7',
  phone: 'M8 3.5h8A1.5 1.5 0 0117.5 5v14a1.5 1.5 0 01-1.5 1.5H8A1.5 1.5 0 016.5 19V5A1.5 1.5 0 018 3.5zM10.5 17.5h3',
  receipt: 'M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5v-17zM9 8h6M9 11.5h6M9 15h3',
};

export function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function TopBar({ title, onBack, backLabel = 'Back', action }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="iconbtn" onClick={onBack} aria-label={backLabel}>
          <Icon name="back" />
        </button>
      ) : (
        <span className="iconbtn-space" />
      )}
      <h1 className="topbar-title">{title}</h1>
      {action || <span className="iconbtn-space" />}
    </header>
  );
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-backdrop" onClick={onClose} aria-label="Close" />
      <div className="sheet">
        <div className="sheet-grip" />
        {title && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

// The one piece of decoration in the app: time left on a warranty reads like a
// line someone ran a highlighter over when it is about to run out.
export function Countdown({ item, today, big }) {
  const cov = coverage(item, today);
  return <span className={`countdown is-${cov.state}${big ? ' is-big' : ''}`}>{countdownText(cov)}</span>;
}

export function CoverageBar({ item, today }) {
  const cov = coverage(item, today);
  if (cov.state === 'none') return null;
  const left = Math.round((1 - cov.elapsed) * 100);
  return (
    <div className={`bar is-${cov.state}`} role="img" aria-label={`${left}% of the warranty period left`}>
      <div className="bar-left" style={{ width: `${Math.max(cov.state === 'expired' ? 0 : 3, left)}%` }} />
    </div>
  );
}

export function Thumb({ item, size = 52 }) {
  if (item.thumb) return <img className="thumb" src={item.thumb} alt="" width={size} height={size} />;
  return (
    <span className="thumb thumb-empty" style={{ width: size, height: size }}>
      <Icon name="receipt" size={size * 0.5} />
    </span>
  );
}
