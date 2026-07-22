'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';

const ACCEPT = 'application/pdf,image/*';
const MAX_MB = 20;

/**
 * In-place upload popover (no page navigation). Drag a file onto the field or
 * click to browse; each file is stored, a `pending` document row is inserted,
 * and AI extraction is kicked off. The inbox then polls until extraction
 * completes (see InboxView). Anchored by the caller; renders its own backdrop.
 */
export function UploadBubble({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { org, userId } = usePlatform();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  // Escape closes the bubble (unless an upload is in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function uploadOne(file: File): Promise<void> {
    const supabase = createClient();
    if (!supabase) throw new Error('Supabase is not configured.');
    if (!org?.id) throw new Error('No organisation on your profile.');

    // Random prefix avoids same-name/same-ms collisions across a batch.
    const path = `${org.id}/${crypto.randomUUID()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (uploadErr) throw uploadErr;

    const { data: inserted, error: insertErr } = await supabase
      .from('documents')
      .insert({ org_id: org.id, filename: file.name, status: 'pending', storage_path: path, uploaded_by: userId })
      .select('id')
      .single();
    if (insertErr) throw insertErr;

    // Kick off extraction. keepalive lets it outlive this component unmounting;
    // a network-level failure is non-fatal — the row stays 'pending' and the
    // extract route self-marks 'error' on its own failures.
    void fetch('/api/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: inserted.id }),
      keepalive: true,
    }).catch(() => {});
  }

  async function handleFiles(files: FileList | File[]) {
    // Validate the whole batch up front, then upload each file independently
    // so one bad/failed file doesn't silently drop the rest.
    const valid: File[] = [];
    const skipped: string[] = [];
    for (const f of Array.from(files)) {
      const okType =
        f.type === 'application/pdf' ||
        f.type.startsWith('image/') ||
        /\.(pdf|png|jpe?g|webp|gif|heic|bmp)$/i.test(f.name);
      const okSize = f.size <= MAX_MB * 1024 * 1024;
      if (okType && okSize) valid.push(f);
      else skipped.push(`${f.name} (${!okSize ? `over ${MAX_MB}MB` : 'unsupported'})`);
    }
    if (valid.length === 0) {
      setError(skipped.length ? `Skipped ${skipped.join(', ')}` : 'Only PDF, JPG or PNG files are supported.');
      return;
    }

    setBusy(true);
    setError(null);
    setDone(0);
    const failed: string[] = [];
    for (const file of valid) {
      try {
        await uploadOne(file);
        setDone((n) => n + 1);
      } catch {
        failed.push(file.name);
      }
    }
    router.refresh();
    setBusy(false);

    const problems = [...skipped, ...failed.map((n) => `${n} (failed)`)];
    if (problems.length) setError(`Couldn’t upload ${problems.join(', ')}`);
    else onClose();
  }

  return (
    <>
      {/* Click-away backdrop */}
      <button
        type="button"
        aria-label="Close upload"
        disabled={busy}
        onClick={() => (busy ? null : onClose())}
        className={`fixed inset-0 z-40 bg-black/5 ${busy ? 'cursor-not-allowed' : 'cursor-default'}`}
      />
      {/* Bubble */}
      <div
        role="dialog"
        aria-label="Upload document"
        className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-2xl border border-[#E7E7E2] bg-white p-4 shadow-[0_12px_40px_-12px_rgba(26,28,30,0.25)]"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#1A1C1E]">Upload document</h3>
          <button
            type="button"
            onClick={() => (busy ? null : onClose())}
            disabled={busy}
            aria-label="Close"
            className="text-[#9A9DA1] transition-colors hover:text-[#1A1C1E] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy && e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => (busy ? null : inputRef.current?.click())}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-9 text-center transition-colors ${
            dragging
              ? 'border-[#3E7BC4] bg-[#E7EEF8]'
              : 'border-[#E7E7E2] bg-[#FAFAF8] hover:border-[#3E7BC4]/40'
          }`}
        >
          <span className="text-[13px] font-medium text-[#1A1C1E]">
            {busy ? `Uploading… (${done})` : dragging ? 'Drop to upload' : 'Drag a file here'}
          </span>
          <span className="mt-1 text-[12px] text-[#9A9DA1]">
            {busy ? 'Doc-U is ingesting your file' : `or click to browse · PDF, JPG, PNG · up to ${MAX_MB}MB`}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.length) void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-lg bg-[#FCEBEB] px-3 py-2 text-[12px] text-[#A32D2D]">{error}</p>
        ) : null}
      </div>
    </>
  );
}
