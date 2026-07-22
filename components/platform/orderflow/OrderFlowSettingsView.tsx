'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { useIsAdmin } from '@/components/platform/RoleGate';
import { useToast } from '@/components/platform/orderflow/ui';
import { Field, PrimaryBtn, inputClass } from '@/components/platform/coredata/ui';
import { formatDocNumber, type OfSettings } from '@/lib/platform/orderflow';
import type { CdPaymentTerm, CdVatRate } from '@/lib/platform/coredata';

// A relation-not-found error means core-data.sql hasn't been run for this org.
const MIGRATION_NOTE = 'Run supabase/core-data.sql to enable OrderFlow settings.';
function isMissingTable(msg: string): boolean {
  return /relation|does not exist|schema cache|could not find the table/i.test(msg);
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-[#171A17]">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[13px] text-[#6B6F68]">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

// The five numbered document kinds, mapped to their of_settings prefix/next columns.
type PrefixKey = 'invoice_prefix' | 'quote_prefix' | 'order_prefix' | 'credit_prefix' | 'dn_prefix';
type NextKey = 'invoice_next' | 'quote_next' | 'order_next' | 'credit_next' | 'dn_next';

const DOC_KINDS: { label: string; prefixKey: PrefixKey; nextKey: NextKey }[] = [
  { label: 'Invoice', prefixKey: 'invoice_prefix', nextKey: 'invoice_next' },
  { label: 'Quote', prefixKey: 'quote_prefix', nextKey: 'quote_next' },
  { label: 'Order', prefixKey: 'order_prefix', nextKey: 'order_next' },
  { label: 'Credit note', prefixKey: 'credit_prefix', nextKey: 'credit_next' },
  { label: 'Delivery note', prefixKey: 'dn_prefix', nextKey: 'dn_next' },
];

function LinkRow({ title, body, links }: { title: string; body: string; links: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#EAEDF2] bg-[#FBFCFE] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[#171A17]">{title}</div>
        <p className="mt-0.5 text-[12px] text-[#6B6F68]">{body}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#171A17] transition-colors hover:bg-[#EEF1F5]"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function OrderFlowSettingsView({
  settings,
  paymentTerms,
  vatRates,
}: {
  settings: OfSettings;
  paymentTerms: CdPaymentTerm[];
  vatRates: CdVatRate[];
}) {
  const { org } = usePlatform();
  const router = useRouter();
  // Numbering + VAT/terms defaults are owner/admin-only (RLS). Hide the Save buttons for
  // members so they don't hit an error; the fields stay visible (read-only in effect).
  const isAdmin = useIsAdmin();
  const { node: toastNode, show: toast } = useToast();

  // --- Document numbering -------------------------------------------------
  const [prefixes, setPrefixes] = useState<Record<PrefixKey, string>>({
    invoice_prefix: settings.invoice_prefix,
    quote_prefix: settings.quote_prefix,
    order_prefix: settings.order_prefix,
    credit_prefix: settings.credit_prefix,
    dn_prefix: settings.dn_prefix,
  });
  const [nexts, setNexts] = useState<Record<NextKey, string>>({
    invoice_next: String(settings.invoice_next),
    quote_next: String(settings.quote_next),
    order_next: String(settings.order_next),
    credit_next: String(settings.credit_next),
    dn_next: String(settings.dn_next),
  });
  const [pad, setPad] = useState(String(settings.number_pad));

  // Lowering next below the value we loaded risks reusing a number → warn.
  const initialNext: Record<NextKey, number> = {
    invoice_next: settings.invoice_next,
    quote_next: settings.quote_next,
    order_next: settings.order_next,
    credit_next: settings.credit_next,
    dn_next: settings.dn_next,
  };
  const lowered = DOC_KINDS.filter((k) => {
    const n = parseInt(nexts[k.nextKey], 10);
    return Number.isFinite(n) && n < initialNext[k.nextKey];
  });

  const [numberBusy, setNumberBusy] = useState(false);
  const [numberError, setNumberError] = useState<string | null>(null);

  const padNum = Math.max(1, parseInt(pad, 10) || 1);

  async function saveNumbering() {
    const supabase = createClient();
    if (!supabase || !org) {
      setNumberError('Not connected.');
      return;
    }
    setNumberBusy(true);
    setNumberError(null);
    // Re-read the current counters: documents issued since page-load have advanced
    // *_next past what we rendered. Writing our stale value would rewind it and
    // reissue numbers. Take Math.max(stored, userInput) so the user can raise a
    // counter but never accidentally rewind one below already-issued documents.
    const { data: current, error: readErr } = await supabase
      .from('of_settings')
      .select('invoice_next, quote_next, order_next, credit_next, dn_next')
      .eq('org_id', org.id)
      .maybeSingle();
    if (readErr) {
      setNumberBusy(false);
      setNumberError(isMissingTable(readErr.message) ? MIGRATION_NOTE : readErr.message);
      return;
    }
    const stored = (current ?? {}) as Partial<Record<NextKey, number>>;
    const bumped: string[] = [];
    const row: Record<string, string | number> = {
      org_id: org.id,
      number_pad: padNum,
      updated_at: new Date().toISOString(),
    };
    for (const k of DOC_KINDS) {
      row[k.prefixKey] = prefixes[k.prefixKey].trim();
      const wanted = Math.max(1, parseInt(nexts[k.nextKey], 10) || 1);
      const storedNext = Number(stored[k.nextKey] ?? 0);
      const next = Math.max(storedNext, wanted);
      row[k.nextKey] = next;
      if (next > wanted) bumped.push(`${k.label.toLowerCase()} advanced to ${next} to stay ahead of issued documents`);
    }
    const { error } = await supabase.from('of_settings').upsert(row, { onConflict: 'org_id' });
    setNumberBusy(false);
    if (error) {
      setNumberError(isMissingTable(error.message) ? MIGRATION_NOTE : error.message);
      return;
    }
    toast(bumped.length > 0 ? `Numbering saved — ${bumped.join('; ')}` : 'Document numbering saved');
    router.refresh();
  }

  // --- Defaults -----------------------------------------------------------
  const [terms, setTerms] = useState(String(settings.default_payment_terms_days));
  const [vat, setVat] = useState(String(settings.default_vat_rate));
  const [defaultsBusy, setDefaultsBusy] = useState(false);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);

  // Distinct day values from the payment terms Core Data list, sorted.
  const termDays = Array.from(new Set(paymentTerms.map((t) => t.days))).sort((a, b) => a - b);
  // A term day that isn't offered as an option (e.g. edited elsewhere) → keep a custom fallback.
  const termsIsKnown = termDays.includes(parseInt(terms, 10));

  const vatValues = Array.from(new Set(vatRates.map((r) => Number(r.rate)))).sort((a, b) => a - b);

  async function saveDefaults() {
    const supabase = createClient();
    if (!supabase || !org) {
      setDefaultsError('Not connected.');
      return;
    }
    setDefaultsBusy(true);
    setDefaultsError(null);
    const { error } = await supabase.from('of_settings').upsert(
      {
        org_id: org.id,
        default_payment_terms_days: Math.max(0, parseInt(terms, 10) || 0),
        default_vat_rate: Number.isFinite(parseFloat(vat)) ? parseFloat(vat) : 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' },
    );
    setDefaultsBusy(false);
    if (error) {
      setDefaultsError(isMissingTable(error.message) ? MIGRATION_NOTE : error.message);
      return;
    }
    toast('Defaults saved');
    router.refresh();
  }

  return (
    <div className="max-w-[900px] space-y-5">
      {toastNode}

      <div>
        <h2 className="text-[18px] font-semibold text-[#171A17]">Settings</h2>
        <p className="mt-0.5 text-[13px] text-[#6B6F68]">
          Document numbering and defaults for OrderFlow. Company details, templates, payment terms and VAT rates live in
          Core Data (Doc-U → Databases).
        </p>
      </div>

      {/* 1. Document numbering ------------------------------------------- */}
      <Section
        title="Document numbering"
        subtitle="The prefix and next number issued for each document type. Padding sets the minimum digit width across all types."
      >
        <div className="mb-4 max-w-[220px]">
          <Field label="Number padding" hint="(digits)">
            <input
              type="number"
              min={1}
              max={10}
              value={pad}
              onChange={(e) => setPad(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#EAEDF2]">
          <div className="hidden grid-cols-[1.1fr_1.4fr_1fr_1.4fr] gap-3 border-b border-[#EAEDF2] bg-[#FBFCFE] px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-[#8A8E86] sm:grid">
            <div>Document</div>
            <div>Prefix</div>
            <div>Next number</div>
            <div>Preview</div>
          </div>
          {DOC_KINDS.map((k, i) => {
            const nextN = parseInt(nexts[k.nextKey], 10);
            const preview = formatDocNumber(prefixes[k.prefixKey], Number.isFinite(nextN) ? nextN : 0, padNum);
            return (
              <div
                key={k.prefixKey}
                className={`grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[1.1fr_1.4fr_1fr_1.4fr] sm:items-center ${
                  i > 0 ? 'border-t border-[#EEF1F5]' : ''
                }`}
              >
                <div className="text-[13px] font-medium text-[#171A17]">{k.label}</div>
                <input
                  value={prefixes[k.prefixKey]}
                  onChange={(e) => setPrefixes({ ...prefixes, [k.prefixKey]: e.target.value })}
                  placeholder="e.g. TNS-INV-"
                  className={inputClass}
                />
                <input
                  type="number"
                  min={1}
                  value={nexts[k.nextKey]}
                  onChange={(e) => setNexts({ ...nexts, [k.nextKey]: e.target.value })}
                  className={inputClass}
                />
                <div className="truncate rounded-lg bg-[#FBFCFE] px-3 py-2 font-mono text-[13px] text-[#171A17]">{preview}</div>
              </div>
            );
          })}
        </div>

        {lowered.length > 0 ? (
          <p className="mt-3 rounded-lg bg-[#FBEEDA] px-3 py-2 text-[12px] text-[#854F0B]">
            You&rsquo;ve lowered the next number for {lowered.map((k) => k.label.toLowerCase()).join(', ')}. Issuing a
            number below one already used can create duplicate document numbers.
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-3">
          {numberError ? <span className="text-[12px] text-[#A32D2D]">{numberError}</span> : null}
          {isAdmin ? (
            <PrimaryBtn onClick={saveNumbering} disabled={numberBusy}>
              {numberBusy ? 'Saving…' : 'Save numbering'}
            </PrimaryBtn>
          ) : (
            <span className="text-[12px] text-[#8A8E86]">Only an owner or admin can change this.</span>
          )}
        </div>
      </Section>

      {/* 2. Defaults ----------------------------------------------------- */}
      <Section
        title="Defaults"
        subtitle="Applied to new documents. Payment terms drive invoice due dates; the VAT rate is pre-filled on new documents."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Default payment terms" hint="(days)">
            {termDays.length > 0 ? (
              <select
                value={termsIsKnown ? terms : '__custom__'}
                onChange={(e) => {
                  if (e.target.value !== '__custom__') setTerms(e.target.value);
                }}
                className={inputClass}
              >
                {termDays.map((d) => {
                  const named = paymentTerms.find((t) => t.days === d);
                  return (
                    <option key={d} value={String(d)}>
                      {named ? `${named.name} (${d} days)` : `${d} days`}
                    </option>
                  );
                })}
                {!termsIsKnown ? <option value="__custom__">{`Custom (${terms} days)`}</option> : null}
              </select>
            ) : (
              <input type="number" min={0} value={terms} onChange={(e) => setTerms(e.target.value)} className={inputClass} />
            )}
          </Field>

          <Field label="Default VAT rate" hint="(%)">
            <div className="flex gap-2">
              {vatValues.length > 0 ? (
                <select
                  value={vatValues.includes(parseFloat(vat)) ? vat : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') setVat(e.target.value);
                  }}
                  className={inputClass}
                >
                  {vatValues.map((r) => {
                    const named = vatRates.find((x) => Number(x.rate) === r);
                    return (
                      <option key={r} value={String(r)}>
                        {named ? `${named.name} (${r}%)` : `${r}%`}
                      </option>
                    );
                  })}
                  {!vatValues.includes(parseFloat(vat)) ? <option value="__custom__">{`Custom (${vat}%)`}</option> : null}
                </select>
              ) : null}
              <input
                type="number"
                min={0}
                step="0.01"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
                className={inputClass}
                placeholder="15"
              />
            </div>
          </Field>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          {defaultsError ? <span className="text-[12px] text-[#A32D2D]">{defaultsError}</span> : null}
          {!isAdmin ? (
            <span className="text-[12px] text-[#8A8E86]">Only an owner or admin can change this.</span>
          ) : (
          <PrimaryBtn onClick={saveDefaults} disabled={defaultsBusy}>
            {defaultsBusy ? 'Saving…' : 'Save defaults'}
          </PrimaryBtn>
          )}
        </div>
      </Section>

      {/* 3. Links -------------------------------------------------------- */}
      <Section
        title="Company & templates"
        subtitle="These live in Core Data (Doc-U → Databases) so every module shares one source of truth. Edit them there."
      >
        <div className="space-y-2.5">
          <LinkRow
            title="Company profile"
            body="Your business identity, banking details and logo printed on documents."
            links={[{ label: 'Open company profile', href: '/app/docu/databases/company' }]}
          />
          <LinkRow
            title="Document templates"
            body="Layout, footer text and terms per document type."
            links={[{ label: 'Open templates', href: '/app/docu/databases/templates' }]}
          />
          <LinkRow
            title="Payment terms & VAT"
            body="Named terms and tax rates the defaults above pick from."
            links={[
              { label: 'Payment terms', href: '/app/docu/databases/payment-terms' },
              { label: 'VAT rates', href: '/app/docu/databases/vat' },
            ]}
          />
        </div>
      </Section>

      {/* 4. Placeholders ------------------------------------------------- */}
      <Section title="More" subtitle="Coming to OrderFlow.">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between rounded-xl border border-[#EAEDF2] bg-[#FBFCFE] px-4 py-3">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[#171A17]">Email sending</div>
              <p className="mt-0.5 text-[12px] text-[#6B6F68]">Send invoices and quotes to customers directly from OrderFlow.</p>
            </div>
            <span className="shrink-0 text-[12px] text-[#8A8E86]">· soon</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#EAEDF2] bg-[#FBFCFE] px-4 py-3">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[#171A17]">User permissions</div>
              <p className="mt-0.5 text-[12px] text-[#6B6F68]">Control who can issue, edit and void documents.</p>
            </div>
            <span className="shrink-0 text-[12px] text-[#8A8E86]">· soon</span>
          </div>
        </div>
      </Section>
    </div>
  );
}
