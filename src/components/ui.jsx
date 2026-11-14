import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { coverage, countdownText, humanSpan } from '../lib/warranty.js';

const PATHS = {
  back: 'M15 4l-8 8 8 8',
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
  shield: 'M12 3l7 3v5.5c0 4.4-2.9 7.9-7 9.5-4.1-1.6-7-5.1-7-9.5V6l7-3zM9 12l2.2 2.2L15.2 10',
  hand: 'M12 3l7 3v5.5c0 4.4-2.9 7.9-7 9.5-4.1-1.6-7-5.1-7-9.5V6l7-3z',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.500 5.600 12 3z',
  calendar: 'M5 6.5h14a1 1 0 011 1V19a1 1 0 01-1 1H5a1 1 0 01-1-1V7.5a1 1 0 011-1zM4 10.500h16M8 4v4M16 4v4',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4V8zM4 8l8 4 8-4M12 12v8',
  arrowUp: 'M12 19V6M6.500 11.500L12 6l5.500 5.500',
  arrowDown: 'M12 5v13M6.500 12.500L12 18l5.500-5.500',
  table: 'M4.500 5h15a.5.5 0 01.5.5v13a.5.5 0 01-.5.5h-15a.5.5 0 01-.5-.5v-13a.5.5 0 01.5-.5zM4 10h16M4 14.500h16M10 5v14',
  help: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.500 9.500a2.500 2.500 0 114 2c-.9.6-1.500 1.200-1.500 2.300M12 17h.01',
  faceid: 'M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2M9 9.500v1.500M15 9.500v1.500M12 9.500V13h-1M9 15.500c1.800 1.400 4.200 1.400 6 0',
  // categories
  electronics: 'M4 5.500h16v10.500H4zM9 20h6M12 16v4',
  appliance: 'M6 3.500h12v17H6zM12 16.500a3.500 3.500 0 100-7 3.500 3.500 0 000 7zM8.500 6.500h.01M11 6.500h.01',
  tools: 'M14.700 6.300a4 4 0 00-5.300 5.300L4 17v3h3l5.400-5.400a4 4 0 005.300-5.300l-2.500 2.500-2.300-.600-.600-2.300 2.400-2.600z',
  automotive: 'M5 17v-4l1.700-4.300A2 2 0 018.600 7.500h6.800a2 2 0 011.900 1.200L19 13v4M3.500 17h17M7 17v2M17 17v2M7.500 13.500h.01M16.500 13.500h.01',
  furniture: 'M5.500 11V8a2 2 0 012-2h9a2 2 0 012 2v3M3.500 12.500a2 2 0 014 0V14h9v-1.500a2 2 0 014 0V18h-17v-5.500zM6 18v2M18 18v2',
  home: 'M4 11l8-7 8 7M6 9.500V20h12V9.500M10 20v-5h4v5',
  sports: 'M3 12h2M19 12h2M5.500 8.500v7M8.500 6.500v11M15.500 6.500v11M18.500 8.500v7M8.500 12h7',
  jewellery: 'M6.500 4.500h11L21 9.500 12 20 3 9.500l3.500-5zM3 9.500h18M9.500 4.500L12 9.500l2.500-5',
  clothing: 'M8.500 4L3.500 7l2 4 2-1v10h9V10l2 1 2-4-5-3a3.500 3.500 0 01-7 0z',
  toys: 'M4 13.500h7v6.500H4zM13 13.500h7v6.500h-7zM8.500 4.500h7V11h-7z',
  other: 'M3.500 12V4.500h7.500L20.500 14 14 20.500 3.500 12zM7.500 8.500h.01',
};

export const CATEGORY_COLORS = {
  electronics: '#0a84ff',
  appliance: '#5e5ce6',
  tools: '#ff9500',
  automotive: '#ff3b30',
  furniture: '#a2845e',
  home: '#34c759',
  sports: '#30b0c7',
  jewellery: '#af52de',
  clothing: '#ff2d55',
  toys: '#00c7be',
  other: '#8e8e93',
};

export function Icon({ name, size = 22, weight = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] || PATHS.other} />
    </svg>
  );
}

// A coloured rounded square with a white glyph, like the icons in iPhone Settings.
export function Tile({ icon, color, size = 30 }) {
  return (
    <span className="tile" style={{ width: size, height: size, background: color, borderRadius: size * 0.24 }}>
      <Icon name={icon} size={size * 0.62} weight={1.9} />
    </span>
  );
}

export function CategoryTile({ category, size = 40 }) {
  return <Tile icon={category in CATEGORY_COLORS ? category : 'other'} color={CATEGORY_COLORS[category] || CATEGORY_COLORS.other} size={size} />;
}

// Time left, as a ring that empties as the warranty runs down.
export function Ring({ item, today, size = 28, stroke = 3.5, children }) {
  const cov = coverage(item, today);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const left = cov.state === 'none' || cov.state === 'expired' ? 0 : Math.max(0.03, 1 - cov.elapsed);
  return (
    <span className={`ring is-${cov.state}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        {left > 0 && (
          <circle
            className="ring-left"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * left} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      {children && <span className="ring-inside">{children}</span>}
    </span>
  );
}

// Short form for list rows: "12 days", "8 months", "Tomorrow", "Ended".
export function shortLeft(cov) {
  if (cov.state === 'none') return '';
  if (cov.state === 'expired') return 'Ended';
  if (cov.daysLeft === 0) return 'Today';
  if (cov.daysLeft === 1) return 'Tomorrow';
  return humanSpan(cov.daysLeft);
}

// Two-line form for the big ring: a number and what it counts.
export function ringParts(cov) {
  if (cov.state === 'none') return { big: 'None', small: 'no warranty' };
  if (cov.state === 'expired') return { big: 'Ended', small: countdownText(cov).replace(/^Ended /, '') };
  const d = cov.daysLeft;
  if (d === 0) return { big: 'Today', small: 'last day' };
  if (d < 60) return { big: String(d), small: d === 1 ? 'day left' : 'days left' };
  if (d < 730) return { big: String(Math.round(d / 30.44)), small: 'months left' };
  return { big: String(Math.round((d / 365.25) * 2) / 2), small: 'years left' };
}

export function Sheet({ title, message, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Drawn at the top of the page so it always covers the whole screen.
  return createPortal(
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-backdrop" onClick={onClose} aria-label="Close" />
      <div className="sheet">
        <div className="sheet-grip" />
        {title && <h2 className="sheet-title">{title}</h2>}
        {message && <p className="sheet-text">{message}</p>}
        {children}
      </div>
    </div>,
    document.body
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`toggle${checked ? ' is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="toggle-knob" />
    </button>
  );
}

// Grouped list, the building block of every iPhone settings-style screen.
export function Group({ header, footer, children }) {
  return (
    <section className="group-wrap">
      {header && <h2 className="group-header">{header}</h2>}
      <div className="group">{children}</div>
      {footer && <p className="group-footer">{footer}</p>}
    </section>
  );
}

export function Row({ icon, color, title, value, onClick, href, danger, children, chevron = true }) {
  const body = (
    <>
      {icon && <Tile icon={icon} color={color} />}
      <span className="row-title">{title}</span>
      {value !== undefined && value !== null && <span className="row-value">{value}</span>}
      {children}
      {(onClick || href) && chevron && !danger && (
        <span className="row-chevron">
          <Icon name="chevron" size={15} weight={2.4} />
        </span>
      )}
    </>
  );
  const cls = `row${danger ? ' is-danger' : ''}`;
  if (href) {
    return (
      <a className={`${cls} is-tappable`} href={href} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={`${cls} is-tappable`} onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
