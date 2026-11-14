import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';

// One screen in the stack. Screens slide in from the right ("push") or rise
// from the bottom ("modal"), and the one underneath shifts back, the way
// screens move in iPhone apps. A pushed screen can be dragged away from its
// left edge to go back.
export function Layer({ kind, position, coveredBy, immediate, onBack, children }) {
  const [entered, setEntered] = useState(kind === 'root' || immediate);
  const el = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    if (entered) return undefined;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [entered]);

  const canSwipe = kind === 'push' && position === 'top' && onBack;

  const onTouchStart = (e) => {
    if (!canSwipe || e.touches.length !== 1 || e.touches[0].clientX > 28) return;
    drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, active: false };
  };
  const onTouchMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.touches[0].clientX - d.x;
    const dy = e.touches[0].clientY - d.y;
    if (!d.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        drag.current = null;
        return;
      }
      if (dx < 8) return;
      d.active = true;
    }
    d.dx = Math.max(0, dx);
    const node = el.current;
    const under = node?.previousElementSibling;
    node.style.transition = 'none';
    node.style.transform = `translateX(${d.dx}px)`;
    if (under) {
      const progress = Math.min(1, d.dx / node.offsetWidth);
      under.style.transition = 'none';
      under.style.transform = `translateX(${-26 * (1 - progress)}%)`;
    }
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.active) return;
    const node = el.current;
    const under = node?.previousElementSibling;
    for (const n of [node, under]) {
      if (!n) continue;
      n.style.transition = '';
      n.style.transform = '';
    }
    if (d.dx > node.offsetWidth * 0.3) onBack();
  };

  const covered = position === 'under' || position === 'buried';
  const cls = ['layer', `is-${kind}`, `is-${position}`, entered ? '' : 'is-offstage', position === 'under' ? `under-${coveredBy}` : ''].filter(Boolean).join(' ');
  return (
    <div ref={el} className={cls} aria-hidden={covered || position === 'leaving' ? 'true' : undefined} inert={covered || position === 'leaving'} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      {children}
    </div>
  );
}

// The content of a screen: a navigation bar that turns translucent once the
// page scrolls, and an optional large title that collapses into the bar.
export function Screen({ title, largeTitle, subtitle, left, right, className = '', dock, children }) {
  const [scrolled, setScrolled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const onScroll = (e) => {
    const top = e.currentTarget.scrollTop;
    setScrolled(top > 2);
    setCollapsed(top > 38);
  };
  return (
    <div className={`screen ${className}`}>
      <header className={`navbar${scrolled ? ' is-scrolled' : ''}`}>
        <div className="navbar-side">{left}</div>
        <div className={`navbar-title${largeTitle && !collapsed ? ' is-hidden' : ''}`} aria-hidden={largeTitle ? 'true' : undefined}>
          {title}
        </div>
        <div className="navbar-side is-right">{right}</div>
      </header>
      <div className="screen-scroll" onScroll={onScroll}>
        {largeTitle && (
          <div className="large-title">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
      {dock && <div className="dock">{dock}</div>}
    </div>
  );
}

export function BackButton({ onClick, label }) {
  return (
    <button type="button" className="navbtn navbtn-back" onClick={onClick} aria-label="Back">
      <Icon name="back" size={22} weight={2.4} />
      {label && <span aria-hidden="true">{label}</span>}
    </button>
  );
}

export function NavButton({ onClick, children, strong, disabled, type = 'button', label }) {
  return (
    <button type={type} className={`navbtn${strong ? ' is-strong' : ''}`} onClick={onClick} disabled={disabled} aria-label={label}>
      {children}
    </button>
  );
}
