'use client';

/**
 * Record-payment modal — inserts an of_payments row against an invoice,
 * recomputes the invoice's effective status from the new paid total and
 * persists it when it changed, logs payment_recorded, then toasts + refreshes.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { logActivity } from '@/lib/platform/orderflow-activity';
import {
  PAYMENT_METHODS,
  balanceDue,
  effectiveInvoiceStatus,
  setupMessage,
  zar2,
  type OfInvoice,
  type PaymentMethod,
} from '@/lib/platform/orderflow';
import { Field, Modal, PrimaryBtn, SecondaryBtn, inputClass } from '@/components/platform/coredata/ui';
import { useToast } from '@/components/platform/orderflow/ui';

function friendlyError(message: string | undefined): string {
  if (!message) return 'Could not record the payment.';
  if (/does not exist|schema cache/i.test(message)) return 'Run supabase/core-data.sql to enable payments.';
  return setupMessage(message);
}

export function RecordPaymentModal({
  open,
  onClose,
  invoice,
  paidSoFar,
  total,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  invoice: OfInvoice;
  paidSoFar: number;
  total: number;
  onRecorded?: () => void;
}) {
  // Toast lives out here so it survives the modal closing after a record.
  const { node, show } = useToast();
  return (
    <>
      {node}
      {open ? (
        <PaymentForm
          onClose={onClose}
          invoice={invoice}
          paidSoFar={paidSoFar}
          total={total}
          onRecorded={onRecorded}
          show={show}
        />
      ) : null}
    </>
  );
}

/** Mounted fresh each time the modal opens, so the form always starts from the current balance. */
function PaymentForm({
  onClose,
  invoice,
  paidSoFar,
  total,
  onRecorded,
  show,
}: {
  onClose: () => void;
  invoice: OfInvoice;
  paidSoFar: number;
  total: number;
  onRecorded?: () => void;
  show: (m: string) => void;
}) {
  const { org, email } = usePlatform();
  const router = useRouter();

  const balance = balanceDue(total, paidSoFar);

  const [amount, setAmount] = useState(() => (balance > 0 ? String(balance) : ''));
  const [method, setMethod] = useState<PaymentMethod>('eft');
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    const amt = Math.round((Number(amount) || 0) * 100) / 100;
    if (!(amt > 0)) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (amt > balance + 0.005) {
      setError(`Amount exceeds the balance due of ${zar2(balance)}.`);
      return;
    }
    if (!paidOn) {
      setError('Pick a payment date.');
      return;
    }
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);

    const { data: pay, error: payErr } = await supabase
      .from('of_payments')
      .insert({
        org_id: org.id,
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        amount: amt,
        method,
        paid_on: paidOn,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      })
      .select('id')
      .single();
    if (payErr || !pay) {
      setBusy(false);
      setError(friendlyError(payErr?.message));
      return;
    }

    const nextStatus = effectiveInvoiceStatus(invoice, paidSoFar + amt, total);
    if (nextStatus !== invoice.status) {
      const { error: upErr } = await supabase
        .from('of_invoices')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', invoice.id);
      if (upErr) console.warn('invoice status update failed:', upErr.message);
    }

    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'payment',
      entityId: pay.id,
      customerId: invoice.customer_id,
      event: 'payment_recorded',
      description: `${zar2(amt)} against ${invoice.invoice_number} (${method.toUpperCase()})`,
    });

    setBusy(false);
    show(`Payment of ${zar2(amt)} recorded`);
    router.refresh();
    onRecorded?.();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record payment"
      subtitle={`Against ${invoice.invoice_number}`}
      width={520}
      footer={
        <div className="flex items-center justify-end gap-2">
          <SecondaryBtn type="button" onClick={onClose} disabled={busy}>
            Cancel
          </SecondaryBtn>
          <PrimaryBtn type="button" onClick={() => void record()} disabled={busy}>
            {busy ? 'Recording…' : 'Record payment'}
          </PrimaryBtn>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#E7E7E2] bg-[#FBFBF9] p-3 text-[13px]">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Total</div>
            <div className="mt-0.5 tabular-nums font-medium text-[#1A1C1E]">{zar2(total)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Paid</div>
            <div className="mt-0.5 tabular-nums font-medium text-[#0F6E56]">{zar2(paidSoFar)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Balance</div>
            <div className="mt-0.5 tabular-nums font-semibold text-[#854F0B]">{zar2(balance)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Amount" hint={balance > 0 ? `balance ${zar2(balance)}` : undefined}>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className={inputClass}
            />
          </Field>
          <Field label="Method">
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={inputClass}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Reference" hint="(optional)">
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="EFT reference…"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Notes" hint="(optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth remembering about this payment…"
            className={`${inputClass} h-20 py-2`}
          />
        </Field>

        {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
      </div>
    </Modal>
  );
}
