'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { logActivity } from '@/lib/platform/orderflow-activity';
import type { LinkedDocument } from '@/lib/platform/orderflow-data';
import { useToast } from '@/components/platform/orderflow/ui';

const MAX_MB = 20;

function docDate(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  return t.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Linked-document panel for OrderFlow detail views: lists documents attached to
 * an entity (customer / order / invoice…) and lets the user upload a new one that
 * is stored in the 'documents' bucket and linked via entity_type/entity_id.
 * Copies the Doc-U upload conventions (bucket, path, insert columns).
 */
export function AttachDocuments({
  entityType,
  entityId,
  customerId,
  documents,
  title,
  documentType,
}: {
  entityType: string;
  entityId: string;
  customerId?: string | null;
  documents: LinkedDocument[];
  title?: string;
  documentType?: string | null;
}) {
  const router = useRouter();
  const { org, email, userId } = usePlatform();
  const { node: toastNode, show: toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  async function open(doc: LinkedDocument) {
    if (!doc.storage_path) return;
    const supabase = createClient();
    if (!supabase) {
      setError('Not connected.');
      return;
    }
    setOpening(doc.id);
    setError(null);
    try {
      const { data, error: signErr } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.storage_path, 600);
      if (signErr || !data?.signedUrl) throw signErr ?? new Error('Could not open the document.');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the document.');
    } finally {
      setOpening(null);
    }
  }

  async function handleFile(file: File) {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    const okType =
      file.type === 'application/pdf' ||
      file.type.startsWith('image/') ||
      /\.(pdf|png|jpe?g)$/i.test(file.name);
    if (!okType) {
      setError('Only PDF, JPG or PNG.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_MB}MB.`);
      return;
    }

    setBusy(true);
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
          document_type: documentType ?? null,
          storage_path: path,
          uploaded_by: userId,
          entity_type: entityType,
          entity_id: entityId,
          customer_id: customerId ?? null,
        })
        .select('id')
        .single();
      if (insertErr || !inserted) throw insertErr ?? new Error('Could not save the document.');

      logActivity(supabase, {
        orgId: org.id,
        actorEmail: email,
        entityType,
        entityId,
        customerId: customerId ?? null,
        event: 'document_attached',
        description: file.name,
      });

      toast('Document attached');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-[#1A1C1E]">{title ?? 'Documents'}</h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D7DAD8] bg-white px-3 text-[12px] font-medium text-[#1A1C1E] transition-colors hover:border-[#3E7BC4]/40 disabled:opacity-60"
        >
          {busy ? 'Uploading…' : '↑ Attach'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {documents.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#9A9DA1]">No documents attached yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#F0F0EC] overflow-hidden rounded-xl border border-[#E7E7E2]">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => void open(doc)}
                  disabled={!doc.storage_path || opening === doc.id}
                  className="block max-w-full truncate text-left text-[13px] font-medium text-[#1F5FA8] transition-colors hover:text-[#174C87] disabled:text-[#9A9DA1]"
                  title={doc.filename}
                >
                  {opening === doc.id ? 'Opening…' : doc.filename}
                </button>
                <div className="mt-0.5 text-[11px] text-[#9A9DA1]">
                  {doc.document_type ? <span className="capitalize">{doc.document_type}</span> : null}
                  {doc.document_type && doc.created_at ? ' · ' : null}
                  {docDate(doc.created_at)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <div className="mt-3 rounded-xl bg-[#FCEBEB] px-3 py-2.5 text-[13px] text-[#A32D2D]">{error}</div>
      ) : null}

      {toastNode}
    </div>
  );
}
