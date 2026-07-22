'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { useToast, RowActionsMenu } from '@/components/platform/orderflow/ui';
import type { CdVatRate } from '@/lib/platform/coredata';
import type { CoreData } from '@/lib/platform/coredata-data';
import { Field, Modal, PrimaryBtn, SecondaryBtn, ConfirmDialog, EmptyState, SearchInput, Pill, inputClass } from './ui';

interface Draft {
  name: string;
  rate: string;
  description: string;
  active: boolean;
}

const EMPTY: Draft = { name: '', rate: '15', description: '', active: true };

export function VatDb({ data }: { data: CoreData }) {
  const router = useRouter();
  const { org } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CdVatRate | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.vatRates.filter((r) => !q || `${r.name} ${r.description ?? ''}`.toLowerCase().includes(q));
  }, [data.vatRates, search]);

  function startNew() {
    setDraft(EMPTY);
    setError(null);
    setEditing('new');
  }
  function startEdit(r: CdVatRate) {
    setDraft({ name: r.name ?? '', rate: r.rate != null ? String(r.rate) : '', description: r.description ?? '', active: r.active !== false });
    setError(null);
    setEditing(r.id);
  }

  async function save() {
    if (!draft.name.trim()) {
      setError('Name is required.');
      return;
    }
    const rateNum = Number(draft.rate.replace(/[%\s]/g, ''));
    if (!Number.isFinite(rateNum)) {
      setError('Enter a valid rate.');
      return;
    }
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: draft.name.trim(),
      rate: rateNum,
      description: draft.description.trim() || null,
      active: draft.active,
    };
    if (editing === 'new') {
      const { error: err } = await supabase.from('cd_vat_rates').insert({ org_id: org.id, ...payload });
      setBusy(false);
      if (err) {
        setError(err.message.includes('relation') ? 'Run supabase/core-data.sql to enable VAT settings.' : err.message);
        return;
      }
      setEditing(null);
      toast('VAT rate added');
      router.refresh();
    } else if (editing) {
      const { error: err } = await supabase.from('cd_vat_rates').update(payload).eq('id', editing);
      setBusy(false);
      if (err) {
        setError(err.message);
        return;
      }
      setEditing(null);
      toast('VAT rate updated');
      router.refresh();
    }
  }

  async function toggleActive(r: CdVatRate) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const next = !(r.active !== false);
    const { error: err } = await supabase.from('cd_vat_rates').update({ active: next }).eq('id', r.id);
    if (err) {
      toast(err.message);
      return;
    }
    toast(next ? 'VAT rate activated' : 'VAT rate deactivated');
    router.refresh();
  }

  async function remove(r: CdVatRate) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const { error: err } = await supabase.from('cd_vat_rates').delete().eq('id', r.id);
    if (err) {
      toast(err.message);
      return;
    }
    setDeleteTarget(null);
    toast('VAT rate deleted');
    router.refresh();
  }

  const hasAny = data.vatRates.length > 0;

  return (
    <div className="space-y-4">
      {toastNode}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search VAT rates…" />
        <div className="ml-auto">
          <PrimaryBtn onClick={startNew}>Add VAT rate</PrimaryBtn>
        </div>
      </div>

      {!hasAny ? (
        <EmptyState
          title="No VAT rates yet"
          body="Tax rates and categories applied on documents. Add your standard rate (e.g. 15% Standard) here."
          action={<PrimaryBtn onClick={startNew}>Add VAT rate</PrimaryBtn>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" body="No VAT rates match your search." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-left text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 text-right font-medium">Rate</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const active = r.active !== false;
                return (
                  <tr key={r.id} className="border-b border-[#F4F5F7] last:border-0 hover:bg-[#F5F9FE]">
                    <td className="px-4 py-3.5 font-semibold text-[#171A17]">{r.name}</td>
                    <td className="of-num px-4 py-3.5 text-right text-[#171A17]">{r.rate}%</td>
                    <td className="px-4 py-3.5 text-[#6B6F68]">{r.description || '—'}</td>
                    <td className="px-4 py-3.5">
                      {active ? <Pill label="Active" bg="#E1F5EE" fg="#0F6E56" /> : <Pill label="Inactive" bg="#EEF1F5" fg="#6B6F68" />}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <RowActionsMenu
                        actions={[
                          { label: 'Edit', onClick: () => startEdit(r) },
                          { label: active ? 'Deactivate' : 'Activate', onClick: () => toggleActive(r) },
                          { label: 'Delete', onClick: () => setDeleteTarget(r), danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add VAT rate' : 'Edit VAT rate'}
        subtitle="Applied on invoices, quotes and credit notes."
        width={460}
        footer={
          <>
            <SecondaryBtn onClick={() => setEditing(null)} disabled={busy}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</PrimaryBtn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Standard, Zero-rated" className={inputClass} />
          </Field>
          <Field label="Rate %">
            <input value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} placeholder="15" inputMode="decimal" className={inputClass} />
          </Field>
          <Field label="Description" hint="(optional)">
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Standard-rated supplies" className={inputClass} />
          </Field>
          <label className="flex items-center gap-2.5 text-[14px] text-[#171A17]">
            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4 accent-[#1F5FA8]" />
            Active (available to select on documents)
          </label>
          {error ? <p className="text-[13px] text-[#A32D2D]">{error}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete VAT rate?"
        body={deleteTarget ? `"${deleteTarget.name}" will be removed. Existing documents keep their VAT.` : undefined}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
