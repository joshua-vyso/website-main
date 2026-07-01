'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { useToast } from '@/components/platform/orderflow/ui';
import { SectionCard } from '@/components/platform/module-ui';
import { EMPTY_SD_SETTINGS } from '@/lib/platform/serviceden';
import { useServiceDen } from './context';
import { Field, SdPrimary, inputClass } from './ui';

export function SettingsView() {
  const { settings } = useServiceDen();
  const { org } = usePlatform();
  const router = useRouter();
  const { node, show } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const init = settings ?? EMPTY_SD_SETTINGS;
  const [form, setForm] = useState({
    businessName: init.businessName ?? '',
    businessEmail: init.businessEmail ?? '',
    businessPhone: init.businessPhone ?? '',
    businessAddress: init.businessAddress ?? '',
    vatNumber: init.vatNumber ?? '',
    bankName: init.bankName ?? '',
    accountName: init.accountName ?? '',
    accountNumber: init.accountNumber ?? '',
    branchCode: init.branchCode ?? '',
    swift: init.swift ?? '',
    paymentReference: init.paymentReference ?? '',
  });
  const [logo, setLogo] = useState<string | null>(init.logoData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  function onLogoFile(file: File | null) {
    if (!file) return;
    // Raster formats only — SVG can taint the canvas / reference external content.
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Please choose a PNG, JPG or WebP image.'); return; }
    if (file.size > 4 * 1024 * 1024) { setError('Logo must be under 4 MB.'); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          // Cap BOTH dimensions so the stored data URL stays bounded regardless
          // of aspect ratio.
          const maxW = 400;
          const maxH = 240;
          const scale = Math.min(1, maxW / img.width, maxH / img.height);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { setError('Could not process that image.'); return; }
          ctx.drawImage(img, 0, 0, w, h);
          // Prefer PNG (keeps transparency); fall back to JPEG for heavy/photo logos.
          let dataUrl = canvas.toDataURL('image/png');
          if (dataUrl.length > 500_000) dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          if (dataUrl.length > 1_400_000) { setError('That image is too detailed for a logo — try a simpler / smaller one.'); return; }
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
    if (!supabase || !org) { setError('Not connected.'); return; }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('sd_settings').upsert(
      {
        org_id: org.id,
        business_name: form.businessName.trim() || null,
        business_email: form.businessEmail.trim() || null,
        business_phone: form.businessPhone.trim() || null,
        business_address: form.businessAddress.trim() || null,
        vat_number: form.vatNumber.trim() || null,
        bank_name: form.bankName.trim() || null,
        account_name: form.accountName.trim() || null,
        account_number: form.accountNumber.trim() || null,
        branch_code: form.branchCode.trim() || null,
        swift: form.swift.trim() || null,
        payment_reference: form.paymentReference.trim() || null,
        logo_data: logo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' },
    );
    setBusy(false);
    if (err) { setError(err.message); return; }
    show('Settings saved');
    router.refresh();
  }

  return (
    <div className="max-w-[760px] space-y-5">
      {node}

      <SectionCard title="Business details" right={<span className="text-[12px] text-[#9A9DA1]">Shown as the &ldquo;from&rdquo; on invoices</span>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Business name" hint={org?.name ? `(default: ${org.name})` : undefined}><input value={form.businessName} onChange={set('businessName')} placeholder={org?.name ?? 'Your business'} className={inputClass} /></Field>
          <Field label="Email"><input value={form.businessEmail} onChange={set('businessEmail')} placeholder="billing@yourbusiness.co.za" className={inputClass} /></Field>
          <Field label="Phone"><input value={form.businessPhone} onChange={set('businessPhone')} placeholder="011 …" className={inputClass} /></Field>
          <Field label="VAT number" hint="(optional)"><input value={form.vatNumber} onChange={set('vatNumber')} placeholder="4xxxxxxxxx" className={inputClass} /></Field>
          <div className="sm:col-span-2">
            <Field label="Address" hint="(optional)"><textarea value={form.businessAddress} onChange={set('businessAddress')} placeholder="Street, city, postal code" className={`${inputClass} h-16 py-2`} /></Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Banking details" right={<span className="text-[12px] text-[#9A9DA1]">The &ldquo;pay to&rdquo; block on invoices</span>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Bank"><input value={form.bankName} onChange={set('bankName')} placeholder="e.g. FNB, Standard Bank" className={inputClass} /></Field>
          <Field label="Account name"><input value={form.accountName} onChange={set('accountName')} placeholder="Account holder" className={inputClass} /></Field>
          <Field label="Account number"><input value={form.accountNumber} onChange={set('accountNumber')} placeholder="62xxxxxxxxx" className={inputClass} /></Field>
          <Field label="Branch code"><input value={form.branchCode} onChange={set('branchCode')} placeholder="250655" className={inputClass} /></Field>
          <Field label="SWIFT / BIC" hint="(optional)"><input value={form.swift} onChange={set('swift')} placeholder="For international payments" className={inputClass} /></Field>
          <Field label="Payment reference" hint="(optional)"><input value={form.paymentReference} onChange={set('paymentReference')} placeholder="Use invoice number as reference" className={inputClass} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="Logo" right={<span className="text-[12px] text-[#9A9DA1]">Appears on your invoices</span>}>
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
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-[#D7DAD8] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#5B53C0]/50">{logo ? 'Replace logo' : 'Upload logo'}</button>
              {logo ? <button type="button" onClick={() => setLogo(null)} className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-[#A32D2D] transition-colors hover:bg-[#FCEBEB]">Remove</button> : null}
            </div>
            <p className="text-[12px] text-[#9A9DA1]">PNG or JPG, under 4 MB. Auto-resized for the invoice.</p>
          </div>
        </div>
      </SectionCard>

      <div className="flex items-center justify-end gap-3">
        {error ? <span className="text-[12px] text-[#A32D2D]">{error}</span> : null}
        <SdPrimary onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</SdPrimary>
      </div>
    </div>
  );
}
