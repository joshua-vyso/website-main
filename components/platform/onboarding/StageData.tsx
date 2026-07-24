'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { useFinchStream } from '@/components/platform/finch/useFinchStream';
import { FinchMark } from '@/components/platform/finch/FinchMark';
import { BouncingDots } from '@/components/platform/finch/BouncingDots';
import { ImportWizard } from '@/components/platform/coredata/ImportWizard';
import { MODULE_META, type VysoModuleMeta } from '@/lib/platform/module-meta';
import type { FeatureKey } from '@/lib/platform/types';
import { MigrationMissingCard, isMissingRpcError } from './shared';

const META_BY_FEATURE = Object.fromEntries(
  Object.values(MODULE_META).map((m) => [m.featureKey, m]),
) as Record<FeatureKey, VysoModuleMeta>;

/** One line per module about what the uploaded data powers. */
const UNLOCKS: Partial<Record<FeatureKey, string>> = {
  procurepulse: 'Your products become live stock levels you can track and reorder.',
  pricepilot: 'Set selling prices and margins from your product list.',
  marginview: 'Budget and forecast around your operational numbers.',
  wastelog: 'Log wastage and shrinkage to cut preventable losses.',
  shiftboard: 'Plan shifts and keep your labour visible.',
  suppliers: 'Upload supplier invoices or statements to build supplier records.',
  reportgen: 'Turn your operational data into reports and insight.',
  orderflow: 'Your customers become invoices, payments and a simple CRM.',
};

const MAX_PDF_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 13 * 1024 * 1024;

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

/** Images are downscaled to a small JPEG (a phone photo would otherwise 413);
 *  PDFs pass through as base64. */
async function fileToPayload(file: File): Promise<{ base64: string; mediaType: string }> {
  const dataUrl = await readDataUrl(file);
  const strip = (u: string) => {
    const comma = u.indexOf(',');
    return comma >= 0 ? u.slice(comma + 1) : u;
  };
  if (!file.type.startsWith('image/')) {
    return { base64: strip(dataUrl), mediaType: file.type || 'application/octet-stream' };
  }
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('decode failed'));
      i.src = dataUrl;
    });
    const maxDim = 2000;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { base64: strip(dataUrl), mediaType: file.type };
    ctx.drawImage(img, 0, 0, w, h);
    return { base64: strip(canvas.toDataURL('image/jpeg', 0.82)), mediaType: 'image/jpeg' };
  } catch {
    return { base64: strip(dataUrl), mediaType: file.type || 'application/octet-stream' };
  }
}

/** D5 — ensure a single default global price list when PricePilot is chosen.
 *  Fully tolerant: a missing table/column or insert error is logged, never thrown,
 *  and never blocks completing onboarding. */
async function ensureDefaultPriceList(supabase: SupabaseClient, orgId: string): Promise<void> {
  try {
    const { data, error } = await supabase.from('pl_price_lists').select('id').eq('org_id', orgId).limit(1);
    if (error) return; // table absent (migration not run) → tolerate
    if (data && data.length > 0) return; // already has a list
    const { error: insErr } = await supabase
      .from('pl_price_lists')
      .insert({ org_id: orgId, name: 'Standard pricing', customer_id: null });
    if (insErr) console.warn('onboarding: default price list not created —', insErr.message);
  } catch (e) {
    console.warn('onboarding: default price list step skipped —', e);
  }
}

function renderContent(text: string) {
  return text.split('**').map((seg, i) => (i % 2 === 1 ? <strong key={i}>{seg}</strong> : <span key={i}>{seg}</span>));
}

interface DocResult {
  id: string;
  filename: string;
  status: 'uploading' | 'done' | 'error';
  summary?: string;
  error?: string;
}

const INTRO = "Hi — I'm Finch. Bring your data in on the right: a spreadsheet of customers or products, or documents like invoices and price lists. Ask me anything, like \"what should I upload first?\" — or skip and add it later.";

export function StageData({
  orgName,
  chosenModules,
}: {
  orgName: string;
  email: string;
  chosenModules: FeatureKey[];
}) {
  const router = useRouter();
  const { org } = usePlatform();
  const finch = useFinchStream({ module: 'onboarding', orgName: orgName || org?.name || null });

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const [counts, setCounts] = useState({ customers: 0, products: 0, documents: 0 });
  const [importEntity, setImportEntity] = useState<'customers' | 'products' | null>(null);
  const [docResults, setDocResults] = useState<DocResult[]>([]);
  const docSeq = useRef(0);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationMissing, setMigrationMissing] = useState(false);

  const refreshCounts = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !org) return;
    const q = (t: string) => supabase.from(t).select('id', { count: 'exact', head: true }).eq('org_id', org.id);
    const [c, p, d] = await Promise.all([q('of_customers'), q('pp_stock_items'), q('documents')]);
    setCounts({ customers: c.count ?? 0, products: p.count ?? 0, documents: d.count ?? 0 });
  }, [org]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [finch.messages, finch.streamText, finch.streaming]);

  async function uploadDocs(files: File[]) {
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const okType = file.type === 'application/pdf' || isImage;
      const id = `doc_${docSeq.current++}`;
      if (!okType) {
        setDocResults((prev) => [...prev, { id, filename: file.name, status: 'error', error: 'Not a PDF or image.' }]);
        continue;
      }
      if (file.size > (isImage ? MAX_IMAGE_BYTES : MAX_PDF_BYTES)) {
        setDocResults((prev) => [
          ...prev,
          { id, filename: file.name, status: 'error', error: `Too large (max ${isImage ? '~13MB' : '3MB for PDFs'}).` },
        ]);
        continue;
      }
      setDocResults((prev) => [...prev, { id, filename: file.name, status: 'uploading' }]);
      try {
        const { base64, mediaType } = await fileToPayload(file);
        const res = await fetch('/api/ai/agent/ingest-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, mediaType, filename: file.name }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          documentType?: string;
          customerName?: string | null;
          supplier?: string | null;
          itemCount?: number;
          orderSync?: { invoice_number?: string | null } | null;
        };
        if (!res.ok || !data.documentType) {
          setDocResults((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status: 'error', error: data.error ?? `Failed (${res.status}).` } : r)),
          );
          continue;
        }
        const bits: string[] = [`Read as a ${String(data.documentType).replace('_', ' ')}`];
        if (data.customerName) bits.push(`for ${data.customerName}`);
        if (data.supplier) bits.push(`from ${data.supplier}`);
        if (typeof data.itemCount === 'number' && data.itemCount > 0) bits.push(`· ${data.itemCount} lines`);
        if (data.orderSync?.invoice_number) bits.push(`· invoice ${data.orderSync.invoice_number}`);
        setDocResults((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'done', summary: bits.join(' ') } : r)));
        void refreshCounts();
      } catch (err) {
        setDocResults((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: 'error', error: err instanceof Error ? err.message : 'Upload failed.' } : r)),
        );
      }
    }
  }

  async function finish() {
    setError(null);
    setMigrationMissing(false);
    const supabase = createClient();
    if (!supabase) {
      router.push('/app');
      return;
    }
    setFinishing(true);
    const { error: rpcError } = await supabase.rpc('onboarding_complete');
    if (rpcError) {
      setFinishing(false);
      if (isMissingRpcError(rpcError.message)) setMigrationMissing(true);
      else setError(rpcError.message);
      return;
    }
    // D5 — default PricePilot price list (tolerant; never blocks completion).
    if (chosenModules.includes('pricepilot') && org) await ensureDefaultPriceList(supabase, org.id);
    router.push('/app');
    router.refresh();
  }

  const unlockKeys: FeatureKey[] = ['docu', ...chosenModules];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ── Left: Finch chat ─────────────────────────────────────────────── */}
      <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-[#E4E9F0] bg-white">
        <div className="flex items-center gap-2 border-b border-[#EEF1F5] px-5 py-3.5">
          <span className="finch-gradient flex h-6 w-6 items-center justify-center rounded-full">
            <FinchMark size={13} title="" />
          </span>
          <span className="of-display text-[15px] font-semibold text-[#171A17]">Finch</span>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl border border-[#EFEFEA] bg-[#FBFCFE] px-3.5 py-2.5 text-[13.5px] leading-5 text-[#171A17]">
              {INTRO}
            </div>
          </div>
          {finch.messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-5 ${
                  m.role === 'user' ? 'bg-[#EAF3FC] text-[#123]' : 'border border-[#EFEFEA] bg-[#FBFCFE] text-[#171A17]'
                }`}
              >
                {m.role === 'assistant' ? renderContent(m.content) : m.content}
              </div>
            </div>
          ))}
          {finch.streaming ? (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl border border-[#EFEFEA] bg-[#FBFCFE] px-3.5 py-2.5 text-[13.5px] leading-5 text-[#171A17]">
                {finch.streamText ? (
                  <span className="whitespace-pre-wrap">{renderContent(finch.streamText)}</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <BouncingDots size={7} />
                    {finch.streamStatus ? <span className="text-[12px] text-[#6B6F68]">{finch.streamStatus}</span> : null}
                  </span>
                )}
              </div>
            </div>
          ) : null}
          {finch.error ? <p className="px-1 text-[12px] text-[#A32D2D]">{finch.error}</p> : null}
        </div>

        <div className="border-t border-[#EEF1F5] p-3">
          <div className="flex items-center gap-2 rounded-2xl border border-[#E2E6EC] bg-white px-3 py-2 focus-within:border-[#3E8FE0]/60">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const t = input;
                  setInput('');
                  void finch.send(t);
                }
              }}
              rows={1}
              placeholder="Ask Finch anything about getting set up…"
              className="max-h-28 flex-1 resize-none bg-transparent text-[14px] text-[#171A17] placeholder:text-[#8A8E86] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const t = input;
                setInput('');
                void finch.send(t);
              }}
              disabled={!input.trim() || finch.streaming}
              aria-label="Send"
              className="finch-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12l16-8-6 8 6 8-16-8z" fill="#fff" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: uploads + progress + module summary ───────────────────── */}
      <div className="space-y-5">
        {migrationMissing ? <MigrationMissingCard /> : null}

        {/* Progress checklist */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Customers', n: counts.customers },
            { label: 'Products', n: counts.products },
            { label: 'Documents', n: counts.documents },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-[#E4E9F0] bg-white p-4 text-center">
              <div className="of-num text-[24px] font-semibold text-[#171A17]">{c.n}</div>
              <div className="mt-0.5 text-[12px] text-[#6B6F68]">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Upload surface */}
        <div className="rounded-2xl border border-[#E4E9F0] bg-white p-5">
          <h3 className="of-display text-[15px] font-semibold text-[#171A17]">Bring your data in</h3>

          <div className="mt-1 text-[12.5px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Spreadsheets</div>
          <p className="mt-1 text-[12.5px] text-[#6B6F68]">Excel or CSV — a QuickBooks export works well.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setImportEntity('customers')}
              className="inline-flex h-10 items-center gap-2 rounded-[11px] border border-[#E4E9F0] bg-white px-4 text-[13.5px] font-medium text-[#174C87] transition-colors hover:border-[#C9DEF7] hover:bg-[#EAF2FC]"
            >
              Import customers
            </button>
            <button
              type="button"
              onClick={() => setImportEntity('products')}
              className="inline-flex h-10 items-center gap-2 rounded-[11px] border border-[#E4E9F0] bg-white px-4 text-[13.5px] font-medium text-[#174C87] transition-colors hover:border-[#C9DEF7] hover:bg-[#EAF2FC]"
            >
              Import products
            </button>
          </div>

          <div className="mt-5 text-[12.5px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Documents</div>
          <p className="mt-1 text-[12.5px] text-[#6B6F68]">Invoices, statements, price lists or a customer order (PDF or photo).</p>
          <input
            ref={docInputRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) void uploadDocs(files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            className="mt-2.5 inline-flex h-10 items-center gap-2 rounded-[11px] border border-[#E4E9F0] bg-white px-4 text-[13.5px] font-medium text-[#174C87] transition-colors hover:border-[#C9DEF7] hover:bg-[#EAF2FC]"
          >
            Upload documents
          </button>

          {docResults.length ? (
            <div className="mt-3 space-y-1.5">
              {docResults.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-lg border border-[#EFEFEA] bg-[#FBFCFE] px-3 py-2 text-[12px]">
                  {r.status === 'uploading' ? (
                    <BouncingDots size={6} />
                  ) : (
                    <span className={r.status === 'done' ? 'text-[#0F6E56]' : 'text-[#A32D2D]'}>
                      {r.status === 'done' ? '✓' : '✕'}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[#171A17]">{r.filename}</span>
                  <span className="shrink-0 truncate text-[11.5px] text-[#6B6F68]">
                    {r.status === 'uploading' ? 'Reading…' : r.status === 'done' ? r.summary : r.error}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* What your modules unlock */}
        <div className="rounded-2xl border border-[#E4E9F0] bg-white p-5">
          <h3 className="of-display text-[15px] font-semibold text-[#171A17]">What your data unlocks</h3>
          <ul className="mt-3 space-y-2.5">
            {unlockKeys.map((k) => {
              const meta = META_BY_FEATURE[k];
              const copy = k === 'docu' ? 'Every document you upload is read and filed automatically.' : UNLOCKS[k];
              if (!meta || !copy) return null;
              return (
                <li key={k} className="flex items-start gap-2.5 text-[12.5px] leading-snug">
                  <span
                    className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: meta.accent.fg }}
                    aria-hidden
                  />
                  <span>
                    <span className="font-semibold text-[#171A17]">{meta.name}</span>{' '}
                    <span className="text-[#6B6F68]">— {copy}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {error ? (
          <div role="alert" className="rounded-xl border border-[#E7C9C9] bg-[#F9F0F0] px-3 py-2.5 text-[13px] text-[#A32D2D]">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void finish()}
            disabled={finishing}
            className="text-[13.5px] font-medium text-[#6B6F68] transition-colors hover:text-[#171A17] disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => void finish()}
            disabled={finishing}
            className="inline-flex h-[44px] items-center justify-center rounded-[11px] bg-[#1F5FA8] px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {finishing ? 'Finishing…' : 'Finish setup'}
          </button>
        </div>
      </div>

      {/* ── Embedded import wizard modal ─────────────────────────────────── */}
      {importEntity ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ ['--radius' as string]: '0.625rem' } as React.CSSProperties}>
          <div className="absolute inset-0 bg-[#0F1720]/45 backdrop-blur-[3px]" onClick={() => setImportEntity(null)} />
          <div className="relative flex max-h-[88vh] w-full max-w-[860px] flex-col overflow-hidden rounded-3xl border border-[#EAEDF2] bg-white shadow-[0_30px_80px_-24px_rgba(15,23,32,0.55)]">
            <div className="flex items-center justify-between border-b border-[#EEF1F5] px-6 py-3.5">
              <span className="of-display text-[15px] font-semibold text-[#171A17]">
                Import {importEntity === 'customers' ? 'customers' : 'products'}
              </span>
              <button
                type="button"
                onClick={() => setImportEntity(null)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[16px] text-[#8A8E86] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <ImportWizard
                initialEntity={importEntity}
                entity={importEntity}
                embedded
                onComplete={() => void refreshCounts()}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
