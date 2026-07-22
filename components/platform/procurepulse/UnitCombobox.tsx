'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Typeable unit dropdown. Click to see the full unit list (built-ins + custom);
 * typing narrows it (typeahead). The dropdown is fixed-positioned so it escapes
 * the table's overflow clipping, and closes on outside click / scroll.
 */
export function UnitCombobox({
  value,
  units,
  onChange,
  className = '',
}: {
  value: string;
  units: string[];
  onChange: (v: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  function openDrop() {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    setOpen(true);
  }

  // Fixed positioning detaches when an ancestor/page scrolls — close then. But
  // scrolling INSIDE the dropdown's own list must NOT dismiss it (that was the
  // bug: the capture-phase listener fired on the menu's own scroll).
  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (dropRef.current && e.target instanceof Node && dropRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const q = value.trim().toLowerCase();
  const isExact = units.some((u) => u.toLowerCase() === q);
  // Show everything when the field holds a complete unit or is empty; otherwise
  // filter by the typed text.
  const list = isExact || q === '' ? units : units.filter((u) => u.toLowerCase().includes(q));

  return (
    <div className="relative">
      <input
        ref={ref}
        value={value}
        placeholder="unit"
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) openDrop();
        }}
        onFocus={openDrop}
        onMouseDown={() => {
          if (!open) openDrop();
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className={`${className} pr-6`}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#9A9DA1]" aria-hidden>
        ▾
      </span>

      {open && list.length > 0 ? (
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: Math.max(pos.width, 120) }}
          className="z-[70] max-h-[220px] overflow-y-auto rounded-xl border border-[#D7D7D2] bg-white p-1 shadow-[0_18px_50px_-8px_rgba(26,28,30,0.4)]"
        >
          {list.map((u) => (
            <button
              key={u}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(u);
                setOpen(false);
              }}
              className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-[#FAFAF8] ${
                u.toLowerCase() === q ? 'bg-[#E7EEF8] font-medium text-[#174C87]' : 'text-[#1A1C1E]'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
