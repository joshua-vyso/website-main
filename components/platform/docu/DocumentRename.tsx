'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';

/**
 * Inline rename of a document's filename on the detail header. Click the title
 * (or the pencil) to edit; Enter or blur saves to documents.filename.
 */
export function DocumentRename({ documentId, filename }: { documentId: string; filename: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(filename);
  const [busy, setBusy] = useState(false);

  async function save() {
    const next = value.trim();
    setEditing(false);
    if (!next || next === filename) {
      setValue(filename);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    if (supabase) {
      await supabase.from('documents').update({ filename: next }).eq('id', documentId);
    }
    router.refresh();
    setBusy(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
          if (e.key === 'Escape') {
            setValue(filename);
            setEditing(false);
          }
        }}
        aria-label="Rename document"
        className="of-display w-full max-w-[420px] rounded-[10px] border border-[#3E7BC4] bg-white px-2.5 py-0.5 text-[24px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17] outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(filename);
        setEditing(true);
      }}
      disabled={busy}
      title="Rename document"
      className="group inline-flex max-w-full items-center gap-1.5 text-left disabled:opacity-60"
    >
      <span className="of-display truncate text-[24px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">{filename}</span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="shrink-0 text-[#BFC5CC] transition-colors group-hover:text-[#1F5FA8]"
      >
        <path
          d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
