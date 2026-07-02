'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Portals mount on document.body, outside the platform subtree's --radius
// override, so re-declare it here (else rounded-lg/xl collapse to square
// corners) plus the app font. Rule 6.
const PORTAL_STYLE = { fontFamily: 'var(--font-inter)', ['--radius' as string]: '0.625rem' } as React.CSSProperties;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export const inputClass =
  'h-9 w-full rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/50 focus:outline-none';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium text-[#1A1C1E]">
        {label}
        {hint ? <span className="ml-1.5 font-normal text-[#9A9DA1]">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export function PrimaryBtn({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-9 items-center justify-center rounded-lg bg-[#1E5E54] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#174A42] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function SecondaryBtn({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-9 items-center justify-center rounded-lg border border-[#D7DAD8] bg-white px-4 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:bg-[#F0F0EC] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function DangerBtn({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-medium text-[#A32D2D] transition-colors hover:bg-[#F3E7E7] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Centered modal shell (portal + backdrop + Escape + rule 6)
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  width = 460,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={PORTAL_STYLE}>
      <div className="absolute inset-0 bg-[#1A1C1E]/25 backdrop-blur-[1px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90vh] w-full flex-col rounded-2xl border border-[#E7E7E2] bg-white shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#1A1C1E]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-[#5F6368]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] text-[#9A9DA1] transition-colors hover:bg-[#F0F0EC] hover:text-[#1A1C1E]"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-[#F0F0EC] px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Confirmation dialog (destructive actions — rule/design language)
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={body}
      width={380}
      footer={
        <>
          <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
          {danger ? (
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#A32D2D] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#8A2626]"
            >
              {confirmLabel}
            </button>
          ) : (
            <PrimaryBtn onClick={onConfirm}>{confirmLabel}</PrimaryBtn>
          )}
        </>
      }
    >
      <span className="sr-only">{title}</span>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Empty state — dashed card with title + body + action
// ---------------------------------------------------------------------------

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-6 py-12 text-center">
      <p className="text-[15px] font-medium text-[#1A1C1E]">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-md text-[13px] text-[#5F6368]">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search input (with leading glyph)
// ---------------------------------------------------------------------------

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#9A9DA1]">⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        className="h-9 w-full rounded-lg border border-[#D7DAD8] bg-white pl-8 pr-3 text-[13px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/50 focus:outline-none sm:w-64"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

export function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: bg, color: fg }}>
      {label}
    </span>
  );
}
