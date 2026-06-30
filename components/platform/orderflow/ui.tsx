'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ORDER_STATUS_STYLE,
  INVOICE_STATUS_STYLE,
  PAYMENT_STATUS_STYLE,
  CUSTOMER_HEALTH_STYLE,
  type OrderStatus,
  type InvoiceStatus,
  type PaymentStatus,
  type CustomerHealth,
} from '@/lib/platform/orderflow';

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

function Pill({ s }: { s: { bg: string; fg: string; label: string } }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Pill s={ORDER_STATUS_STYLE[status]} />;
}
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Pill s={INVOICE_STATUS_STYLE[status]} />;
}
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Pill s={PAYMENT_STATUS_STYLE[status]} />;
}
export function CustomerHealthBadge({ health }: { health: CustomerHealth }) {
  const s = CUSTOMER_HEALTH_STYLE[health];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.fg }} />
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Compact KPI card
// ---------------------------------------------------------------------------

export function Kpi({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
      <div className="text-[12px] text-[#9A9DA1]">{label}</div>
      <div className="mt-1.5 text-[22px] font-bold leading-none" style={accent ? { color: accent } : { color: '#1A1C1E' }}>
        {value}
      </div>
      {sub != null ? <div className="mt-1.5 text-[11px] text-[#9A9DA1]">{sub}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right-side drawer (portal) — fast operational review from tables
// ---------------------------------------------------------------------------

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  right,
  footer,
  width = 480,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  footer?: ReactNode;
  width?: number;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;
  return createPortal(
    // Portals mount on document.body, outside the platform subtree's --radius
    // override, so re-declare it here or rounded-lg/xl collapse to square corners.
    <div className="fixed inset-0 z-[90]" style={{ ['--radius' as string]: '0.625rem' } as React.CSSProperties}>
      <div className="absolute inset-0 bg-[#1A1C1E]/20 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className="absolute right-0 top-0 flex h-full flex-col bg-white shadow-[0_0_60px_-15px_rgba(26,28,30,0.4)]"
        style={{ width: `min(96vw, ${width}px)` }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#F0F0EC] px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-[16px] font-semibold text-[#1A1C1E]">{title}</div>
            {subtitle ? <div className="mt-0.5 text-[13px] text-[#5F6368]">{subtitle}</div> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {right}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] text-[#9A9DA1] transition-colors hover:bg-[#F0F0EC] hover:text-[#1A1C1E]"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="border-t border-[#F0F0EC] px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Toast — for placeholder/demo actions
// ---------------------------------------------------------------------------

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => setMounted(true), []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2800);
  }, []);
  const node =
    mounted && msg
      ? createPortal(
          <div className="fixed bottom-6 left-1/2 z-[110] -translate-x-1/2 rounded-xl bg-[#1A1C1E] px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_12px_40px_-12px_rgba(26,28,30,0.5)]" style={{ ['--radius' as string]: '0.625rem' } as React.CSSProperties}>
            {msg}
          </div>,
          document.body,
        )
      : null;
  return { node, show };
}

// ---------------------------------------------------------------------------
// Row action menu (portal dropdown anchored to a trigger)
// ---------------------------------------------------------------------------

export interface RowAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - 184, window.innerWidth - 192)) });
    setOpen((o) => !o);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Actions"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9A9DA1] transition-colors hover:bg-[#F0F0EC] hover:text-[#1A1C1E]"
      >
        ⋯
      </button>
      {mounted && open
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[95]" onClick={() => setOpen(false)} />
              <div
                style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 96, ['--radius' as string]: '0.625rem' } as React.CSSProperties}
                className="w-[184px] overflow-hidden rounded-xl border border-[#E7E7E2] bg-white py-1 shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]"
              >
                {actions.map((a, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      a.onClick();
                    }}
                    className={`block w-full px-3.5 py-2 text-left text-[13px] transition-colors hover:bg-[#FAFAF8] ${
                      a.danger ? 'text-[#A32D2D]' : 'text-[#1A1C1E]'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
