'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { useToast } from '@/components/platform/orderflow/ui';
import { EMPTY_COMPANY_PROFILE } from '@/lib/platform/coredata';
import type { CoreData } from '@/lib/platform/coredata-data';
import { Field, PrimaryBtn, inputClass } from './ui';

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-[#1A1C1E]">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export function CompanyProfileDb({ data }: { data: CoreData }) {
  const { org } = usePlatform();
  const router = useRouter();
  const { node: toastNode, show: toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const init = data.companyProfile ?? EMPTY_COMPANY_PROFILE;
  const [form, setForm] = useState({
    company_name: init.company_name ?? '',
    vat_number: init.vat_number ?? '',
    registration_number: init.registration_number ?? '',
    email: init.email ?? '',
    phone: init.phone ?? '',
    address: init.address ?? '',
    bank_name: init.bank_name ?? '',
    account_name: init.account_name ?? '',
    account_number: init.account_number ?? '',
    branch_code: init.branch_code ?? '',
    swift: init.swift ?? '',
    invoice_footer: init.invoice_footer ?? '',
    terms: init.terms ?? '',
  });
  const [logo, setLogo] = useState<string | null>(init.logo_data);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  // Copied from serviceden/SettingsView.tsx — raster-only, 400×240 cap, PNG→JPEG
  // fallback, size guards, try/catch.
  function onLogoFile(file: File | null) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Please choose a PNG, JPG or WebP image.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Logo must be under 4 MB.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 400;
          const maxH = 240;
          const scale = Math.min(1, maxW / img.width, maxH / img.height);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setError('Could not process that image.');
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          let dataUrl = canvas.toDataURL('image/png');
          if (dataUrl.length > 500_000) dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          if (dataUrl.length > 1_400_000) {
            setError('That image is too detailed for a logo — try a simpler / smaller one.');
            return;
          }
          setLogo(dataUrl);
        } catch {
          setError('Could not process that image.');
        }
      };
      img.onerror = () => setError('Could not read that image.');
      img.src = reader.result as string;
    };
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsDataURL(file);
  }

  async function save() {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('cd_company_profile').upsert(
      {
        org_id: org.id,
        company_name: form.company_name.trim() || null,
        vat_number: form.vat_number.trim() || null,
        registration_number: form.registration_number.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        bank_name: form.bank_name.trim() || null,
        account_name: form.account_name.trim() || null,
        account_number: form.account_number.trim() || null,
        branch_code: form.branch_code.trim() || null,
        swift: form.swift.trim() || null,
        invoice_footer: form.invoice_footer.trim() || null,
        terms: form.terms.trim() || null,
        logo_data: logo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' },
    );
    setBusy(false);
    if (err) {
      setError(
        /relation|does not exist|schema cache|could not find the/i.test(err.message)
          ? 'Run supabase/core-data.sql to enable the company profile.'
          : err.message,
      );
      return;
    }
    toast('Company profile saved');
    router.refresh();
  }

  return (
    <div className="max-w-[820px] space-y-5">
      {toastNode}

      <Section title="Business details" right={<span className="text-[12px] text-[#9A9DA1]">The &ldquo;from&rdquo; identity on your documents</span>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Company name" hint={org?.name ? `(default: ${org.name})` : undefined}>
            <input value={form.company_name} onChange={set('company_name')} placeholder={org?.name ?? 'Your business'} className={inputClass} />
          </Field>
          <Field label="Email">
            <input value={form.email} onChange={set('email')} placeholder="billing@yourbusiness.co.za" className={inputClass} />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={set('phone')} placeholder="011 …" className={inputClass} />
          </Field>
          <Field label="VAT number" hint="(optional)">
            <input value={form.vat_number} onChange={set('vat_number')} placeholder="4xxxxxxxxx" className={inputClass} />
          </Field>
          <Field label="Registration number" hint="(optional)">
            <input value={form.registration_number} onChange={set('registration_number')} placeholder="2020/xxxxxx/07" className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address" hint="(optional)">
              <textarea value={form.address} onChange={set('address')} placeholder="Street, city, postal code" className={`${inputClass} h-16 py-2`} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Banking details" right={<span className="text-[12px] text-[#9A9DA1]">The &ldquo;pay to&rdquo; block on invoices</span>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Bank"><input value={form.bank_name} onChange={set('bank_name')} placeholder="e.g. FNB, Standard Bank" className={inputClass} /></Field>
          <Field label="Account name"><input value={form.account_name} onChange={set('account_name')} placeholder="Account holder" className={inputClass} /></Field>
          <Field label="Account number"><input value={form.account_number} onChange={set('account_number')} placeholder="62xxxxxxxxx" className={inputClass} /></Field>
          <Field label="Branch code"><input value={form.branch_code} onChange={set('branch_code')} placeholder="250655" className={inputClass} /></Field>
          <Field label="SWIFT / BIC" hint="(optional)"><input value={form.swift} onChange={set('swift')} placeholder="For international payments" className={inputClass} /></Field>
        </div>
      </Section>

      <Section title="Document text" right={<span className="text-[12px] text-[#9A9DA1]">Footer & terms printed on documents</span>}>
        <div className="space-y-3">
          <Field label="Invoice footer" hint="(shown at the bottom of documents)">
            <textarea value={form.invoice_footer} onChange={set('invoice_footer')} placeholder="Thank you for your business." className={`${inputClass} h-16 py-2`} />
          </Field>
          <Field label="Default terms" hint="(optional)">
            <textarea value={form.terms} onChange={set('terms')} placeholder="Payment due within 30 days. Goods remain our property until paid in full." className={`${inputClass} h-20 py-2`} />
          </Field>
        </div>
      </Section>

      <Section title="Logo" right={<span className="text-[12px] text-[#9A9DA1]">Appears on your documents</span>}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-xl border border-[#E7E7E2] bg-[#FBFBF9]">
            {logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logo} alt="Logo preview" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-[12px] text-[#9A9DA1]">No logo</span>
            )}
          </div>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)} />
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-[#D7DAD8] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:bg-[#F0F0EC]">
                {logo ? 'Replace logo' : 'Upload logo'}
              </button>
              {logo ? (
                <button type="button" onClick={() => setLogo(null)} className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-[#A32D2D] transition-colors hover:bg-[#F3E7E7]">
                  Remove
                </button>
              ) : null}
            </div>
            <p className="text-[12px] text-[#9A9DA1]">PNG or JPG, under 4 MB. Auto-resized for documents.</p>
          </div>
        </div>
      </Section>

      <div className="flex items-center justify-end gap-3">
        {error ? <span className="text-[12px] text-[#A32D2D]">{error}</span> : null}
        <PrimaryBtn onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</PrimaryBtn>
      </div>
    </div>
  );
}
