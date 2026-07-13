'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { isUniqueViolation } from '@/lib/platform/db-errors';

const MAX_MB = 20;

/**
 * Upload a customer order (WhatsApp screenshot, email, handwritten photo, PDF).
 * The file is published to Doc-U (Orders folder, document_type='order'), read by
 * the order extractor, and turned into an OrderFlow order — auto-invoiced when the
 * customer is confidently matched, else opened in Doc-U to confirm the customer.
 */
export function PublishOrderButton() {
  const router = useRouter();
  const { org, userId } = usePlatform();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'reading'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  // Uses order('created_at').limit(1) rather than maybeSingle() so a pre-existing
  // duplicate "Orders" folder can't turn the lookup into a multi-row error that
  // keeps re-creating the folder (mirrors the ingest endpoint).
  async function ordersFolderId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
    if (!supabase || !org?.id) return null;
    const orgId = org.id;
    const findExisting = async () => {
      const { data } = await supabase
        .from('document_folders')
        .select('id')
        .eq('org_id', orgId)
        .eq('name', 'Orders')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      return (data as { id: string } | null)?.id ?? null;
    };
    const existing = await findExisting();
    if (existing) return existing;
    const { data: created, error } = await supabase
      .from('document_folders')
      .insert({ org_id: orgId, name: 'Orders', created_by: userId })
      .select('id')
      .maybeSingle();
    if (created) return (created as { id: string }).id;
    // Lost a create race against the unique index — re-read the winning folder.
    if (isUniqueViolation(error)) return await findExisting();
    return null;
  }

  async function handle(file: File) {
    const supabase = createClient();
    if (!supabase || !org?.id) {
      setMsg('You’re not signed in.');
      return;
    }
    const okType =
      file.type === 'application/pdf' ||
      file.type.startsWith('image/') ||
      /\.(pdf|png|jpe?g|webp|gif|heic|bmp)$/i.test(file.name);
    if (!okType || file.size > MAX_MB * 1024 * 1024) {
      setMsg(`Only PDF, JPG or PNG up to ${MAX_MB}MB.`);
      return;
    }

    setMsg(null);
    setStatus('uploading');
    try {
      const path = `${org.id}/${crypto.randomUUID()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (upErr) throw upErr;

      const folderId = await ordersFolderId(supabase);
      const { data: inserted, error: insErr } = await supabase
        .from('documents')
        .insert({
          org_id: org.id,
          filename: file.name,
          status: 'pending',
          storage_path: path,
          uploaded_by: userId,
          document_type: 'order',
          folder_id: folderId,
        })
        .select('id')
        .single();
      if (insErr || !inserted) throw insErr ?? new Error('Could not save the document.');
      const documentId = (inserted as { id: string }).id;

      setStatus('reading');
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        orderSync?: { orderId?: string; needsCustomerReview?: boolean };
      };
      setStatus('idle');
      if (!res.ok) {
        setMsg(json?.error ?? 'Could not read the order.');
        return;
      }
      const sync = json.orderSync;
      // Confident match → straight to the invoiced order; otherwise review the
      // customer in Doc-U.
      if (sync?.orderId && !sync.needsCustomerReview) {
        router.push(`/app/orderflow/orders/${sync.orderId}`);
      } else {
        router.push(`/app/docu/${documentId}`);
      }
      router.refresh();
    } catch (e) {
      setStatus('idle');
      setMsg(e instanceof Error ? e.message : 'Upload failed.');
    }
  }

  const busy = status !== 'idle';
  return (
    <div className="relative inline-flex flex-col items-end">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D7DAD8] bg-white px-4 text-[14px] font-medium text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/40 disabled:opacity-60"
      >
        {status === 'uploading' ? 'Uploading…' : status === 'reading' ? 'Reading order…' : '↑ Upload order'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handle(f);
          e.target.value = '';
        }}
      />
      {msg ? (
        <p className="absolute right-0 top-full z-10 mt-1 w-[240px] rounded-lg bg-[#FCEBEB] px-3 py-2 text-right text-[12px] text-[#A32D2D]">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
