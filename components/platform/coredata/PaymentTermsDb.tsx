'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { useToast, RowActionsMenu } from '@/components/platform/orderflow/ui';
import type { CdPaymentTerm } from '@/lib/platform/coredata';
import type { CoreData } from '@/lib/platform/coredata-data';
import { Field, Modal, PrimaryBtn, SecondaryBtn, ConfirmDialog, EmptyState, SearchInput, Pill, inputClass } from './ui';

interface Draft {
  name: string;
  days: string;
  description: string;
  is_default: boolean;
}

const EMPTY: Draft = { name: '', days: '30', description: '', is_default: false };

export function PaymentTermsDb({ data }: { data: CoreData }) {
  const router = useRouter();
  const { org } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CdPaymentTerm | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.paymentTerms.filter((t) => !q || `${t.name} ${t.description ?? ''}`.toLowerCase().includes(q));
  }, [data.paymentTerms, search]);

  function startNew() {
    setDraft({ ...EMPTY, is_default: data.paymentTerms.length === 0 });
    setError(null);
    setEditing('new');
  }
  function startEdit(t: CdPaymentTerm) {
    setDraft({ name: t.name ?? '', days: String(t.days ?? 0), description: t.description ?? '', is_default: !!t.is_default });
    setError(null);
    setEditing(t.id);
  }

  async function save() {
    if (!draft.name.trim()) {
      setError('Name is required.');
      return;
    }
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const daysNum = Number(draft.days.replace(/[^0-9-]/g, ''));
    const payload = {
      name: draft.name.trim(),
      days: Number.isFinite(daysNum) ? daysNum : 0,
      description: draft.description.trim() || null,
      is_default: draft.is_default,
    };

    let id = editing === 'new' ? null : (editing as string);
    if (editing === 'new') {
      const { data: inserted, error: err } = await supabase.from('cd_payment_terms').insert({ org_id: org.id, ...payload }).select('id').single();
      if (err) {
        setBusy(false);
        setError(err.message.includes('relation') ? 'Run supabase/core-data.sql to enable payment terms.' : err.message);
        return;
      }
      id = inserted?.id ?? null;
    } else if (editing) {
      const { error: err } = await supabase.from('cd_payment_terms').update(payload).eq('id', editing);
      if (err) {
        setBusy(false);
        setError(err.message);
        return;
      }
    }

    // Setting this as default clears the previous default (two updates).
    if (payload.is_default && id) {
      const { error: clearErr } = await supabase.from('cd_payment_terms').update({ is_default: false }).eq('org_id', org.id).neq('id', id);
      if (clearErr) {
        setBusy(false);
        setError(clearErr.message);
        return;
      }
    }

    setBusy(false);
    setEditing(null);
    toast(editing === 'new' ? 'Payment term added' : 'Payment term updated');
    router.refresh();
  }

  async function remove(t: CdPaymentTerm) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const { error: err } = await supabase.from('cd_payment_terms').delete().eq('id', t.id);
    if (err) {
      toast(err.message);
      return;
    }
    setDeleteTarget(null);
    toast('Payment term deleted');
    router.refresh();
  }

  const hasAny = data.paymentTerms.length > 0;

  return (
    <div className="space-y-4">
      {toastNode}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search terms…" />
        <div className="ml-auto">
          <PrimaryBtn onClick={startNew}>Add payment term</PrimaryBtn>
        </div>
      </div>

      {!hasAny ? (
        <EmptyState
          title="No payment terms yet"
          body="Named terms like COD or 30 days that drive invoice due dates. Add your standard terms here."
          action={<PrimaryBtn onClick={startNew}>Add payment term</PrimaryBtn>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" body="No payment terms match your search." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E7E7E2] bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E7E7E2] text-left text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 text-right font-semibold">Days</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Default</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-[#F0F0EC] last:border-0 hover:bg-[#FBFBF9]">
                  <td className="px-4 py-3 font-medium text-[#1A1C1E]">{t.name}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#1A1C1E]">{t.days === 0 ? 'COD' : `${t.days} days`}</td>
                  <td className="px-4 py-3 text-[#5F6368]">{t.description || '—'}</td>
                  <td className="px-4 py-3">{t.is_default ? <Pill label="Default" bg="#E1F5EE" fg="#0F6E56" /> : <span className="text-[#9A9DA1]">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <RowActionsMenu
                      actions={[
                        { label: 'Edit', onClick: () => startEdit(t) },
                        { label: 'Delete', onClick: () => setDeleteTarget(t), danger: true },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add payment term' : 'Edit payment term'}
        subtitle="Drives the default due date on new invoices."
        width={460}
        footer={
          <>
            <SecondaryBtn onClick={() => setEditing(null)} disabled={busy}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</PrimaryBtn>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 30 days, COD" className={inputClass} />
          </Field>
          <Field label="Days" hint="(0 = cash on delivery)">
            <input value={draft.days} onChange={(e) => setDraft({ ...draft, days: e.target.value })} placeholder="30" inputMode="numeric" className={inputClass} />
          </Field>
          <Field label="Description" hint="(optional)">
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Payment due within 30 days of invoice" className={inputClass} />
          </Field>
          <label className="flex items-center gap-2.5 text-[13px] text-[#1A1C1E]">
            <input type="checkbox" checked={draft.is_default} onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })} className="h-4 w-4 accent-[#3E7BC4]" />
            Use as the default term for new invoices
          </label>
          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete payment term?"
        body={deleteTarget ? `"${deleteTarget.name}" will be removed. Existing invoices keep their due dates.` : undefined}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
