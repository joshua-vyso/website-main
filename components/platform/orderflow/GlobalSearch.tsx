'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

/**
 * A single searchable OrderFlow record. The dashboard builds these from
 * customers / quotes / orders / invoices and passes them in — GlobalSearch is
 * a pure client filter + navigator over that index (no fetching of its own).
 */
export interface SearchIndexItem {
  type: 'customer' | 'quote' | 'order' | 'invoice';
  id: string;
  title: string;
  sub: string;
  href: string;
}

const TYPE_LABEL: Record<SearchIndexItem['type'], string> = {
  customer: 'Customers',
  quote: 'Quotes',
  order: 'Orders',
  invoice: 'Invoices',
};

const TYPE_ORDER: SearchIndexItem['type'][] = ['customer', 'quote', 'order', 'invoice'];

/**
 * Global search bar for the OrderFlow dashboard. Renders an input; while typing
 * a portal dropdown shows results grouped by type. Keyboard: ↑/↓ move the active
 * row (across groups), Enter navigates to it, Escape closes. Selecting any row
 * clears the query and routes there.
 */
export function GlobalSearch({ items, placeholder }: { items: SearchIndexItem[]; placeholder?: string }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Flat, ranked result list (title matches before sub matches), capped.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as SearchIndexItem[];
    const scored = items
      .map((it) => {
        const title = it.title.toLowerCase();
        const sub = it.sub.toLowerCase();
        let score = -1;
        if (title.startsWith(q)) score = 0;
        else if (title.includes(q)) score = 1;
        else if (sub.includes(q)) score = 2;
        return { it, score };
      })
      .filter((r) => r.score >= 0);
    scored.sort((a, b) => a.score - b.score || TYPE_ORDER.indexOf(a.it.type) - TYPE_ORDER.indexOf(b.it.type));
    return scored.slice(0, 24).map((r) => r.it);
  }, [items, query]);

  // Grouped for display, but the active index runs over the flat `results`.
  const groups = useMemo(() => {
    const map = new Map<SearchIndexItem['type'], { item: SearchIndexItem; index: number }[]>();
    results.forEach((item, index) => {
      const arr = map.get(item.type) ?? [];
      arr.push({ item, index });
      map.set(item.type, arr);
    });
    return TYPE_ORDER.filter((t) => map.has(t)).map((t) => ({ type: t, rows: map.get(t)! }));
  }, [results]);

  useEffect(() => setActive(0), [query]);

  // ⌘K / Ctrl-K focuses the bar — the shortcut the hint badge advertises.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function reposition() {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left, width: r.width });
  }

  useEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, results.length]);

  function go(item: SearchIndexItem | undefined) {
    if (!item) return;
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    }
  }

  const showDropdown = mounted && open && query.trim().length > 0;

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#AEB4BC]" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <span
        className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 rounded-md border border-[#E6E6DE] px-1.5 py-0.5 text-[12px] text-[#B0B4AC]"
        aria-hidden
      >
        ⌘K
      </span>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? 'Search customers, quotes, orders, invoices…'}
        className="h-[54px] w-full rounded-[14px] border border-[#E4E9F0] bg-white pl-[52px] pr-16 text-[15px] text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.03)] outline-none transition-colors placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
        aria-label="Search OrderFlow"
        autoComplete="off"
      />

      {showDropdown
        ? createPortal(
            <div
              style={
                {
                  position: 'fixed',
                  top: pos.top,
                  left: pos.left,
                  width: pos.width,
                  zIndex: 96,
                  fontFamily: 'var(--font-instrument)',
                  ['--radius' as string]: '0.625rem',
                } as React.CSSProperties
              }
              className="max-h-[420px] overflow-y-auto rounded-xl border border-[#EAEDF2] bg-white py-1 shadow-[0_16px_50px_-12px_rgba(26,28,30,0.28)]"
            >
              {results.length === 0 ? (
                <div className="px-3.5 py-4 text-[13px] text-[#8A8E86]">
                  No matches for &ldquo;{query.trim()}&rdquo;.
                </div>
              ) : (
                groups.map((g) => (
                  <div key={g.type} className="py-0.5">
                    <div className="px-3.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[#8A8E86]">
                      {TYPE_LABEL[g.type]}
                    </div>
                    {g.rows.map(({ item, index }) => (
                      <button
                        key={item.type + item.id}
                        type="button"
                        // onMouseDown (not onClick) so it fires before the input's blur closes us.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          go(item);
                        }}
                        onMouseEnter={() => setActive(index)}
                        className={`block w-full px-3.5 py-2 text-left transition-colors ${
                          index === active ? 'bg-[#F0F5F3]' : 'hover:bg-[#F5F9FE]'
                        }`}
                      >
                        <div className="truncate text-[13px] font-medium text-[#171A17]">{item.title}</div>
                        {item.sub ? <div className="truncate text-[12px] text-[#6B6F68]">{item.sub}</div> : null}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
