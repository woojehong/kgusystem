import { useLayoutEffect, useRef } from 'react';

/**
 * Shrinks its text to fit the parent's width (down to `min`), capping at
 * `max`. On wide containers the text stays at `max`; on narrow ones (mobile
 * cards) it scales down so long names are never clipped.
 */
export default function FitText({ children, max = 24, min = 9, className = '', style }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return undefined;

    const fit = () => {
      el.style.fontSize = `${max}px`;
      const available = parent.clientWidth;
      const needed = el.scrollWidth;
      if (available > 0 && needed > available) {
        el.style.fontSize = `${Math.max(min, Math.floor(max * (available / needed)))}px`;
      }
    };

    fit();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(fit);
      ro.observe(parent);
    }
    return () => { if (ro) ro.disconnect(); };
  }, [children, max, min]);

  return (
    <span
      ref={ref}
      className={className}
      style={{ ...style, whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100%' }}
    >
      {children}
    </span>
  );
}
