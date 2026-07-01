'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export { zar } from '@/lib/platform/orderflow';

const MODAL_STYLE = { fontFamily: 'var(--font-inter)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

export const inputClass =
  'h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#5B53C0]/50 focus:outline-none';

/** Centered modal shell (portal + backdrop + escape + correct radius/font). */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 460,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  busy?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, busy]);

  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={MODAL_STYLE}>
      <div className="absolute inset-0 bg-[#1A1C1E]/25 backdrop-blur-[1px]" onClick={() => !busy && onClose()} />
      <div role="dialog" aria-modal="true" className="relative w-full rounded-2xl border border-[#E7E7E2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1A1C1E]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-[#5F6368]">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] text-[#9A9DA1] transition-colors hover:bg-[#F0F0EC] hover:text-[#1A1C1E]">✕</button>
        </div>
        <div className="mt-4 space-y-3">{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium text-[#1A1C1E]">
        {label}
        {hint ? <span className="ml-1.5 text-[#9A9DA1]">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

export function ModalButtons({ onCancel, onSave, busy, saveLabel = 'Save', disabled = false }: { onCancel: () => void; onSave: () => void; busy?: boolean; saveLabel?: string; disabled?: boolean }) {
  return (
    <>
      <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03] disabled:opacity-50">Cancel</button>
      <button type="button" onClick={onSave} disabled={busy || disabled} className="rounded-lg bg-[#5B53C0] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#4c45a6] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : saveLabel}</button>
    </>
  );
}

/** ServiceDen primary button (accent purple). */
export function SdPrimary({ onClick, children, disabled = false }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex h-10 items-center rounded-xl bg-[#5B53C0] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#4c45a6] disabled:cursor-not-allowed disabled:opacity-50">
      {children}
    </button>
  );
}
