'use client';

import { useRef, useState } from 'react';
import { Modal, Field, PrimaryBtn, SecondaryBtn, inputClass } from '@/components/platform/coredata/ui';
import { useToast } from '@/components/platform/orderflow/ui';

type Category = 'bug' | 'feature';

const MAX_IMAGES = 4;
// Reject huge source files before we even try to decode them.
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
// Long-edge cap + JPEG quality for the downscale (mirrors SettingsView's canvas
// bounding pattern, but tuned larger for legible screenshots).
const MAX_EDGE = 1400;
const JPEG_QUALITY = 0.7;
// Cap the resulting data URL so the JSON payload stays bounded (~1.2 MB each).
const MAX_RESULT_BYTES = 1_200_000;

/**
 * Downscale one image file to a bounded JPEG data URL via canvas. Resolves null
 * (with the reason surfaced through onError) if the file is unusable.
 */
function downscaleImage(file: File, onError: (msg: string) => void): Promise<string | null> {
  return new Promise((resolve) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      onError('Please choose a PNG, JPG or WebP image.');
      resolve(null);
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      onError('Each image must be under 8 MB.');
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          // Bound the long edge; short edge scales proportionally.
          const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { onError('Could not process that image.'); resolve(null); return; }
          ctx.drawImage(img, 0, 0, w, h);
          let dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          // If still too heavy, step the quality down before giving up.
          if (dataUrl.length > MAX_RESULT_BYTES) dataUrl = canvas.toDataURL('image/jpeg', 0.5);
          if (dataUrl.length > MAX_RESULT_BYTES) {
            onError('That screenshot is too large — try a smaller one.');
            resolve(null);
            return;
          }
          resolve(dataUrl);
        } catch {
          onError('Could not process that image.');
          resolve(null);
        }
      };
      img.onerror = () => { onError('Could not read that image.'); resolve(null); };
      img.src = reader.result as string;
    };
    reader.onerror = () => { onError('Could not read that file.'); resolve(null); };
    reader.readAsDataURL(file);
  });
}

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { node, show } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<Category>('bug');
  const [message, setMessage] = useState('');
  const [shots, setShots] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCategory('bug');
    setMessage('');
    setShots([]);
    setError(null);
    setSending(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function close() {
    reset();
    onClose();
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const room = MAX_IMAGES - shots.length;
    if (room <= 0) { setError(`You can attach at most ${MAX_IMAGES} images.`); return; }
    const picked = Array.from(files).slice(0, room);
    if (Array.from(files).length > room) setError(`Only the first ${room} image${room === 1 ? '' : 's'} were added (max ${MAX_IMAGES}).`);
    const next: string[] = [];
    for (const f of picked) {
      const url = await downscaleImage(f, setError);
      if (url) next.push(url);
    }
    if (next.length) setShots((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
    if (fileRef.current) fileRef.current.value = '';
  }

  function removeShot(i: number) {
    setShots((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: trimmed,
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
          screenshots: shots,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError((data && data.error) || 'Could not send feedback. Please try again.');
        setSending(false);
        return;
      }
      show('Thanks — sent to the Vyso team');
      close();
    } catch {
      setError('Could not send feedback. Please try again.');
      setSending(false);
    }
  }

  return (
    <>
      {node}
      <Modal
        open={open}
        onClose={close}
        title="Send feedback"
        subtitle="Report a bug or request a feature — it goes straight to the Vyso team."
        width={480}
        footer={
          <>
            <SecondaryBtn onClick={close}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={submit} disabled={sending || !message.trim()}>
              {sending ? 'Sending…' : 'Send feedback'}
            </PrimaryBtn>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="What kind of feedback?">
            <div className="inline-flex rounded-lg border border-[#D7DAD8] bg-[#FBFBF9] p-0.5">
              {(['bug', 'feature'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    category === c ? 'bg-white text-[#1A1C1E] shadow-[0_1px_2px_rgba(26,28,30,0.08)]' : 'text-[#5F6368] hover:text-[#1A1C1E]'
                  }`}
                >
                  {c === 'bug' ? 'Bug' : 'Feature request'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Details">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the bug you're seeing, or the feature you'd like."
              className={`${inputClass} h-28 py-2`}
            />
          </Field>

          <Field label="Screenshots" hint={`(optional, up to ${MAX_IMAGES})`}>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <div className="flex flex-wrap items-center gap-2">
              {shots.map((src, i) => (
                <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-[#E7E7E2] bg-[#FBFBF9]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Screenshot ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeShot(i)}
                    aria-label="Remove screenshot"
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1C1E]/70 text-[11px] leading-none text-white transition-colors hover:bg-[#1A1C1E]"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {shots.length < MAX_IMAGES ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-[#D7DAD8] bg-white text-[11px] text-[#5F6368] transition-colors hover:border-[#1E5E54]/50 hover:text-[#1A1C1E]"
                >
                  <span className="text-[16px] leading-none">+</span>
                  Add
                </button>
              ) : null}
            </div>
          </Field>

          {error ? <p className="text-[12px] text-[#A32D2D]">{error}</p> : null}
        </div>
      </Modal>
    </>
  );
}
