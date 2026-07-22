'use client';

/**
 * Delivery-note detail — the printable picking slip plus the operational
 * toolbar clients act on: mark out for delivery, mark delivered (captures a
 * signed-by name), inline driver/vehicle (Fleet-module placeholders), print and
 * a proof-of-delivery upload. All writes go straight to Supabase (of_delivery_
 * notes + documents) with real toasts + activity — no demo shortcuts.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import { DocSheet, PrintButton, type DocSheetLine } from '@/components/platform/orderflow/DocSheet';
import { useToast } from '@/components/platform/orderflow/ui';
import {
  Field,
  Modal,
  PrimaryBtn,
  SecondaryBtn,
  inputClass,
} from '@/components/platform/coredata/ui';
import type { LinkedDocument } from '@/lib/platform/orderflow-data';
import {
  DELIVERY_NOTE_STATUS_STYLE,
  type OfCustomer,
  type OfDeliveryNote,
  type OfDeliveryNoteItem,
  type OfInvoice,
  type OfOrder,
} from '@/lib/platform/orderflow';
import type { CdCompanyProfile } from '@/lib/platform/coredata';

const MAX_MB = 20;

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DeliveryNoteDetail({
  note,
  items,
  customer,
  order,
  invoice,
  companyProfile,
  documents,
  orgName,
}: {
  note: OfDeliveryNote;
  items: OfDeliveryNoteItem[];
  customer: OfCustomer | null;
  order: OfOrder | null;
  invoice: OfInvoice | null;
  companyProfile: CdCompanyProfile | null;
  documents: LinkedDocument[];
  orgName: string | null;
}) {
  const router = useRouter();
  const { org, email, userId } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [signedBy, setSignedBy] = useState('');
  const [driver, setDriver] = useState(note.driver_name ?? '');
  const [vehicle, setVehicle] = useState(note.vehicle ?? '');
  const [fleetOpen, setFleetOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [uploading, setUploading] = useState(false);

  const s = DELIVERY_NOTE_STATUS_STYLE[note.status] ?? DELIVERY_NOTE_STATUS_STYLE.draft;
  const podDoc = note.pod_document_id ? documents.find((d) => d.id === note.pod_document_id) ?? null : null;

  const lines: DocSheetLine[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    qty: Number(i.qty) || 0,
    unit: i.unit,
    unit_price: 0,
  }));

  const meta: { label: string; value: string }[] = [{ label: 'Date', value: fmtDate(note.created_at) }];
  if (order?.order_number) meta.push({ label: 'Order no', value: order.order_number });
  if (invoice?.invoice_number) meta.push({ label: 'Invoice no', value: invoice.invoice_number });
  if (note.driver_name) meta.push({ label: 'Driver', value: note.driver_name });
  if (note.vehicle) meta.push({ label: 'Vehicle', value: note.vehicle });

  // -------------------------------------------------------------------------
  // Status transitions
  // -------------------------------------------------------------------------

  async function setOutForDelivery() {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: upErr } = await supabase
      .from('of_delivery_notes')
      .update({ status: 'out_for_delivery' })
      .eq('id', note.id);
    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'delivery_note',
      entityId: note.id,
      customerId: note.customer_id,
      event: 'delivery_note_delivered',
      description: `${note.dn_number} out for delivery`,
    });
    toast('Marked out for delivery');
    setBusy(false);
    router.refresh();
  }

  async function confirmDelivered() {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const name = signedBy.trim();
    const { error: upErr } = await supabase
      .from('of_delivery_notes')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        signed_by: name || null,
      })
      .eq('id', note.id);
    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }
    logActivity(supabase, {
      orgId: org.id,
      actorEmail: email,
      entityType: 'delivery_note',
      entityId: note.id,
      customerId: note.customer_id,
      event: 'delivery_note_delivered',
      description: name ? `${note.dn_number} received by ${name}` : `${note.dn_number} delivered`,
    });
    toast('Delivery confirmed');
    setBusy(false);
    setDeliverOpen(false);
    setSignedBy('');
    router.refresh();
  }

  async function saveFleet() {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: upErr } = await supabase
      .from('of_delivery_notes')
      .update({ driver_name: driver.trim() || null, vehicle: vehicle.trim() || null })
      .eq('id', note.id);
    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }
    toast('Driver & vehicle saved');
    setBusy(false);
    setFleetOpen(false);
    router.refresh();
  }

  // -------------------------------------------------------------------------
  // Proof of delivery — upload to the documents bucket + link + set pod_document_id
  // (AttachDocuments' pattern, inline because we need the inserted document id).
  // -------------------------------------------------------------------------

  async function uploadPod(file: File) {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    const okType =
      file.type === 'application/pdf' || file.type.startsWith('image/') || /\.(pdf|png|jpe?g)$/i.test(file.name);
    if (!okType) {
      setError('Only PDF, JPG or PNG.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_MB}MB.`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const path = `${org.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: inserted, error: insertErr } = await supabase
        .from('documents')
        .insert({
          org_id: org.id,
          filename: file.name,
          status: 'reviewed',
          document_type: 'delivery_note',
          storage_path: path,
          uploaded_by: userId,
          entity_type: 'delivery_note',
          entity_id: note.id,
          customer_id: note.customer_id ?? null,
        })
        .select('id')
        .single();
      if (insertErr || !inserted) throw insertErr ?? new Error('Could not save the document.');

      const { error: linkErr } = await supabase
        .from('of_delivery_notes')
        .update({ pod_document_id: (inserted as { id: string }).id })
        .eq('id', note.id);
      if (linkErr) throw linkErr;

      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType: 'delivery_note',
        entityId: note.id,
        customerId: note.customer_id,
        event: 'pod_uploaded',
        description: file.name,
      });

      toast('Proof of delivery uploaded');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function openPod() {
    if (!podDoc?.storage_path) return;
    const supabase = createClient();
    if (!supabase) {
      setError('Not connected.');
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const { data, error: signErr } = await supabase.storage
        .from('documents')
        .createSignedUrl(podDoc.storage_path, 600);
      if (signErr || !data?.signedUrl) throw signErr ?? new Error('Could not open the document.');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the document.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <div>
      {/* Back link + toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/app/orderflow/delivery-notes" className="text-[13px] text-[#6B6F68] transition-colors hover:text-[#171A17]">
          ← Delivery notes
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {note.status === 'draft' ? (
            <SecondaryBtn onClick={setOutForDelivery} disabled={busy}>
              Mark out for delivery
            </SecondaryBtn>
          ) : null}
          {note.status !== 'delivered' ? (
            <PrimaryBtn onClick={() => setDeliverOpen(true)} disabled={busy}>
              Mark delivered
            </PrimaryBtn>
          ) : null}
          <PrintButton label="Download PDF" />
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl bg-[#FCEBEB] px-3 py-2.5 text-[13px] text-[#A32D2D] print:hidden">{error}</div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Printable sheet */}
        <div>
          <DocSheet
            title="Delivery note"
            number={note.dn_number}
            statusPill={{ label: s.label, bg: s.bg, fg: s.fg }}
            companyProfile={companyProfile}
            orgName={orgName}
            customer={customer}
            deliverTo={note.delivery_address ?? undefined}
            meta={meta}
            lines={lines}
            showPrices={false}
            notes={note.instructions ?? note.notes ?? undefined}
            signatureBlock
          />
        </div>

        {/* Operational side panel */}
        <div className="space-y-4 print:hidden">
          {/* Delivery details */}
          <div className="rounded-2xl border border-[#EAEDF2] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-[#171A17]">Delivery</h3>
              <button
                type="button"
                onClick={() => {
                  setDriver(note.driver_name ?? '');
                  setVehicle(note.vehicle ?? '');
                  setFleetOpen(true);
                }}
                className="text-[12px] font-medium text-[#1F5FA8] transition-colors hover:text-[#174C87]"
              >
                Edit
              </button>
            </div>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <Row label="Status" value={s.label} />
              <Row label="Delivered" value={fmtDate(note.delivered_at)} />
              {note.signed_by ? <Row label="Received by" value={note.signed_by} /> : null}
              <Row label="Driver" value={note.driver_name || 'Not assigned'} muted={!note.driver_name} />
              <Row label="Vehicle" value={note.vehicle || 'Not assigned'} muted={!note.vehicle} />
            </dl>
            <p className="mt-3 text-[11px] text-[#8A8E86]">Driver &amp; vehicle are placeholders for the Fleet module.</p>
          </div>

          {/* Source */}
          {order || invoice ? (
            <div className="rounded-2xl border border-[#EAEDF2] bg-white p-4">
              <h3 className="text-[13px] font-semibold text-[#171A17]">Source</h3>
              <div className="mt-3 space-y-2 text-[13px]">
                {order ? (
                  <Link href={`/app/orderflow/orders/${order.id}`} className="flex items-center justify-between gap-3 text-[#1F5FA8] hover:text-[#174C87]">
                    <span className="text-[#6B6F68]">Order</span>
                    <span className="font-medium">{order.order_number || 'View order'}</span>
                  </Link>
                ) : null}
                {invoice ? (
                  <Link href={`/app/orderflow/invoices/${invoice.id}`} className="flex items-center justify-between gap-3 text-[#1F5FA8] hover:text-[#174C87]">
                    <span className="text-[#6B6F68]">Invoice</span>
                    <span className="font-medium">{invoice.invoice_number}</span>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Proof of delivery */}
          <div className="rounded-2xl border border-[#EAEDF2] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-[#171A17]">Proof of delivery</h3>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E2E6EC] bg-white px-3 text-[12px] font-medium text-[#171A17] transition-colors hover:border-[#3E7BC4]/40 disabled:opacity-60"
              >
                {uploading ? 'Uploading…' : podDoc ? '↑ Replace' : '↑ Upload'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadPod(f);
                  e.target.value = '';
                }}
              />
            </div>
            {podDoc ? (
              <button
                type="button"
                onClick={() => void openPod()}
                disabled={!podDoc.storage_path || opening}
                className="mt-3 block max-w-full truncate text-left text-[13px] font-medium text-[#1F5FA8] transition-colors hover:text-[#174C87] disabled:text-[#8A8E86]"
                title={podDoc.filename}
              >
                {opening ? 'Opening…' : `✓ ${podDoc.filename}`}
              </button>
            ) : (
              <p className="mt-3 text-[13px] text-[#8A8E86]">No proof of delivery uploaded yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Mark delivered — capture signed-by */}
      <Modal
        open={deliverOpen}
        onClose={() => setDeliverOpen(false)}
        title="Confirm delivery"
        subtitle="Record who received the goods (optional)."
        width={400}
        footer={
          <>
            <SecondaryBtn onClick={() => setDeliverOpen(false)} disabled={busy}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn onClick={confirmDelivered} disabled={busy}>
              {busy ? 'Saving…' : 'Confirm delivered'}
            </PrimaryBtn>
          </>
        }
      >
        <Field label="Received by" hint="name of the person who signed">
          <input
            className={inputClass}
            value={signedBy}
            onChange={(e) => setSignedBy(e.target.value)}
            placeholder="e.g. J. Nkosi"
            autoFocus
          />
        </Field>
      </Modal>

      {/* Driver & vehicle inline edit (Fleet placeholders) */}
      <Modal
        open={fleetOpen}
        onClose={() => setFleetOpen(false)}
        title="Driver & vehicle"
        subtitle="Placeholder fields ahead of the Fleet module."
        width={400}
        footer={
          <>
            <SecondaryBtn onClick={() => setFleetOpen(false)} disabled={busy}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn onClick={saveFleet} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </PrimaryBtn>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Driver">
            <input className={inputClass} value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Driver name" />
          </Field>
          <Field label="Vehicle">
            <input className={inputClass} value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="e.g. Toyota Hilux · CA 123-456" />
          </Field>
        </div>
      </Modal>

      {toastNode}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[#8A8E86]">{label}</dt>
      <dd className={muted ? 'text-[#8A8E86]' : 'text-[#171A17]'}>{value}</dd>
    </div>
  );
}
