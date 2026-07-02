'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { useToast, RowActionsMenu } from '@/components/platform/orderflow/ui';
import { DOC_TEMPLATE_TYPES, type CdDocTemplate, type DocTemplateType } from '@/lib/platform/coredata';
import type { CoreData } from '@/lib/platform/coredata-data';
import { Field, Modal, PrimaryBtn, SecondaryBtn, ConfirmDialog, EmptyState, SearchInput, Pill, inputClass } from './ui';

interface Draft {
  template_type: DocTemplateType;
  name: string;
  logo_placement: 'left' | 'center' | 'right';
  footer_text: string;
  terms: string;
  is_default: boolean;
}

const EMPTY: Draft = { template_type: 'invoice', name: '', logo_placement: 'left', footer_text: '', terms: '', is_default: false };

const PLACEMENTS: { value: Draft['logo_placement']; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(DOC_TEMPLATE_TYPES.map((t) => [t.value, t.label]));

export function TemplatesDb({ data }: { data: CoreData }) {
  const router = useRouter();
  const { org } = usePlatform();
  const { node: toastNode, show: toast } = useToast();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CdDocTemplate | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.templates.filter((t) => {
      if (typeFilter !== 'all' && t.template_type !== typeFilter) return false;
      if (q && !`${t.name} ${TYPE_LABEL[t.template_type] ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.templates, search, typeFilter]);

  function startNew() {
    setDraft(EMPTY);
    setError(null);
    setEditing('new');
  }
  function startEdit(t: CdDocTemplate) {
    setDraft({
      template_type: t.template_type,
      name: t.name ?? '',
      logo_placement: (t.logo_placement as Draft['logo_placement']) ?? 'left',
      footer_text: t.footer_text ?? '',
      terms: t.terms ?? '',
      is_default: !!t.is_default,
    });
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
    const payload = {
      template_type: draft.template_type,
      name: draft.name.trim(),
      logo_placement: draft.logo_placement,
      footer_text: draft.footer_text.trim() || null,
      terms: draft.terms.trim() || null,
      is_default: draft.is_default,
    };

    let id = editing === 'new' ? null : (editing as string);
    if (editing === 'new') {
      const { data: inserted, error: err } = await supabase.from('cd_doc_templates').insert({ org_id: org.id, ...payload }).select('id').single();
      if (err) {
        setBusy(false);
        setError(err.message.includes('relation') ? 'Run supabase/core-data.sql to enable document templates.' : err.message);
        return;
      }
      id = inserted?.id ?? null;
    } else if (editing) {
      const { error: err } = await supabase.from('cd_doc_templates').update(payload).eq('id', editing);
      if (err) {
        setBusy(false);
        setError(err.message);
        return;
      }
    }

    // Default is per-type: setting this clears others of the same type.
    if (payload.is_default && id) {
      const { error: clearErr } = await supabase
        .from('cd_doc_templates')
        .update({ is_default: false })
        .eq('org_id', org.id)
        .eq('template_type', payload.template_type)
        .neq('id', id);
      if (clearErr) {
        setBusy(false);
        setError(clearErr.message);
        return;
      }
    }

    setBusy(false);
    setEditing(null);
    toast(editing === 'new' ? 'Template created' : 'Template updated');
    router.refresh();
  }

  async function remove(t: CdDocTemplate) {
    const supabase = createClient();
    if (!supabase || !org) {
      toast('Not connected.');
      return;
    }
    const { error: err } = await supabase.from('cd_doc_templates').delete().eq('id', t.id);
    if (err) {
      toast(err.message);
      return;
    }
    setDeleteTarget(null);
    toast('Template deleted');
    router.refresh();
  }

  const hasAny = data.templates.length > 0;

  return (
    <div className="space-y-4">
      {toastNode}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search templates…" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputClass} sm:w-auto`}>
          <option value="all">All types</option>
          {DOC_TEMPLATE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <div className="ml-auto">
          <PrimaryBtn onClick={startNew}>New template</PrimaryBtn>
        </div>
      </div>

      {!hasAny ? (
        <EmptyState
          title="No document templates yet"
          body="Layout, footer text and terms per document type. Create a template to control how invoices, quotes and delivery notes print."
          action={<PrimaryBtn onClick={startNew}>New template</PrimaryBtn>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" body="No templates match your search and filters." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E7E7E2] bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E7E7E2] text-left text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Logo</th>
                <th className="px-4 py-3 font-semibold">Default</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-[#F0F0EC] last:border-0 hover:bg-[#FBFBF9]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1A1C1E]">{t.name}</div>
                    {t.footer_text ? <div className="max-w-[280px] truncate text-[11px] text-[#9A9DA1]">{t.footer_text}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-[#5F6368]">{TYPE_LABEL[t.template_type] ?? t.template_type}</td>
                  <td className="px-4 py-3 capitalize text-[#5F6368]">{t.logo_placement}</td>
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
        title={editing === 'new' ? 'New template' : 'Edit template'}
        subtitle="Controls layout, footer and terms for one document type."
        width={520}
        footer={
          <>
            <SecondaryBtn onClick={() => setEditing(null)} disabled={busy}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</PrimaryBtn>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Document type">
              <select value={draft.template_type} onChange={(e) => setDraft({ ...draft, template_type: e.target.value as DocTemplateType })} className={inputClass}>
                {DOC_TEMPLATE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Logo placement">
              <select value={draft.logo_placement} onChange={(e) => setDraft({ ...draft, logo_placement: e.target.value as Draft['logo_placement'] })} className={inputClass}>
                {PLACEMENTS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Name">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Standard invoice" className={inputClass} />
          </Field>
          <Field label="Footer text" hint="(optional)">
            <textarea value={draft.footer_text} onChange={(e) => setDraft({ ...draft, footer_text: e.target.value })} placeholder="Thank you for your business." className={`${inputClass} h-16 py-2`} />
          </Field>
          <Field label="Terms" hint="(optional)">
            <textarea value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} placeholder="Payment due within 30 days." className={`${inputClass} h-20 py-2`} />
          </Field>
          <label className="flex items-center gap-2.5 text-[13px] text-[#1A1C1E]">
            <input type="checkbox" checked={draft.is_default} onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })} className="h-4 w-4 accent-[#1E5E54]" />
            Default template for {TYPE_LABEL[draft.template_type]?.toLowerCase() ?? draft.template_type} documents
          </label>
          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete template?"
        body={deleteTarget ? `"${deleteTarget.name}" will be removed.` : undefined}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
