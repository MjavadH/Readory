'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

type Tip = { content: string; label: string; x: number; y: number; placement: 'top' | 'bottom' };

export function ReaderTextContent({
  html,
  dir,
  style,
  className,
}: {
  html: string;
  dir?: 'ltr' | 'rtl';
  style?: React.CSSProperties;
  className?: string;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  // Move native title -> data attribute so the browser tooltip never shows.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>('abbr.reader-footnote').forEach((el) => {
      const title = el.getAttribute('title');
      if (title) {
        el.dataset.footnote = title;
        el.removeAttribute('title');
      }
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
    });
  }, [html]);

  const show = useCallback((el: HTMLElement) => {
    const content = el.dataset.footnote;
    if (!content) return;
    const r = el.getBoundingClientRect();
    const placement = r.top < 140 ? 'bottom' : 'top';
    setTip({
      content,
      label: el.textContent ?? '',
      x: r.left + r.width / 2,
      y: placement === 'top' ? r.top : r.bottom,
      placement,
    });
  }, []);

  const hide = useCallback(() => setTip(null), []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const find = (t: EventTarget | null) =>
      t instanceof Element ? (t.closest('abbr.reader-footnote') as HTMLElement | null) : null;

    const onOver = (e: Event) => {
      const el = find(e.target);
      if (el) show(el);
    };
    const onOut = (e: Event) => {
      if (find(e.target)) hide();
    };
    const onClick = (e: MouseEvent) => {
      const el = find(e.target);
      if (!el) return hide();
      e.preventDefault();
      e.stopPropagation();
      setTip((prev) => (prev && prev.content === el.dataset.footnote ? null : null));
      show(el);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
      const el = find(e.target);
      if (el && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        show(el);
      }
    };

    root.addEventListener('mouseover', onOver);
    root.addEventListener('mouseout', onOut);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    document.addEventListener('pointerdown', (ev) => {
      if (!find(ev.target)) hide();
    });

    return () => {
      root.removeEventListener('mouseover', onOver);
      root.removeEventListener('mouseout', onOut);
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [show, hide, html]);

  return (
    <>
      <article
        ref={rootRef as React.RefObject<HTMLElement>}
        dir={dir}
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-60 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 px-1"
          style={{
            left: tip.x,
            top: tip.y,
            transform:
              tip.placement === 'top'
                ? 'translate(-50%, calc(-100% - 10px))'
                : 'translate(-50%, 10px)',
          }}
        >
          <div className="animate-in fade-in-0 zoom-in-95 rounded-xl border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-md">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {tip.label}
            </div>
            <p className="text-sm leading-relaxed" style={{ fontFamily: 'inherit' }}>
              {tip.content}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
