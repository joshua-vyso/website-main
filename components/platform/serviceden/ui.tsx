'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export { zar } from '@/lib/platform/orderflow';

const MODAL_STYLE = { fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

export const inputClass =
  'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';

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
      <div className="absolute inset-0 bg-[#171A17]/25 backdrop-blur-[1px]" onClick={() => !busy && onClose()} />
      <div role="dialog" aria-modal="true" className="relative w-full rounded-2xl border border-[#EAEDF2] bg-white p-6 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="of-display text-[16px] font-semibold text-[#171A17]">{title}</h2>
            {subtitle ? <p className="mt-1 text-[13px] text-[#6B6F68]">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[18px] text-[#A0A49C] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]">✕</button>
        </div>
        <div className="mt-5 space-y-3.5">{children}</div>
        {footer ? <div className="mt-6 flex justify-end gap-2.5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-[#3E4A57]">
        {label}
        {hint ? <span className="ml-1.5 font-normal text-[#A0A49C]">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

export function ModalButtons({ onCancel, onSave, busy, saveLabel = 'Save', disabled = false }: { onCancel: () => void; onSave: () => void; busy?: boolean; saveLabel?: string; disabled?: boolean }) {
  return (
    <>
      <button type="button" onClick={onCancel} disabled={busy} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-50">Cancel</button>
      <button type="button" onClick={onSave} disabled={busy || disabled} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving…' : saveLabel}</button>
    </>
  );
}

/** ServiceDen primary button (platform blue accent). */
export function SdPrimary({ onClick, children, disabled = false }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-50">
      {children}
    </button>
  );
}
