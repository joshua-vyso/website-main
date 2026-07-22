'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type {
  SupplierStatus,
  SupplierRisk,
  PreferredMethod,
} from '@/lib/platform/supplysync-data';
import { useSupplySync } from '@/components/platform/supplysync/context';
import {
  Stars,
  SUPPLIER_STATUS_META,
  SUPPLIER_RISK_META,
  INK,
  MUTE,
  FAINT,
  GREEN,
  RED,
} from '@/components/platform/supplysync/shared';
import { useToast } from '@/components/platform/orderflow/ui';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';

// ---------------------------------------------------------------------------
// Wizard constants
// ---------------------------------------------------------------------------

const ACCENT = '#1F5FA8';

const STEPS = [
  { n: 1, label: 'Supplier details' },
  { n: 2, label: 'Contacts' },
  { n: 3, label: 'Categories supplied' },
  { n: 4, label: 'Documents' },
  { n: 5, label: 'Risk & preferred' },
] as const;

const CONTACT_ROLES = ['Sales', 'Accounts', 'Dispatch', 'Owner/Manager', 'After-hours'] as const;
type ContactRole = (typeof CONTACT_ROLES)[number];

const PREFERRED_METHODS: PreferredMethod[] = ['Call', 'WhatsApp', 'Email'];

const COMMON_CATEGORIES = [
  'Citrus',
  'Pome Fruit',
  'Leafy Greens',
  'Root Veg',
  'Tomatoes & Peppers',
  'Grapes & Berries',
  'Mixed Veg',
] as const;

const STANDARD_DOCS = [
  'Tax Clearance',
  'BEE Certificate',
  'Food Safety Certificate',
  'Bank Confirmation',
  'Insurance',
  'Contract',
  'Price List',
] as const;

const STATUS_OPTIONS: SupplierStatus[] = ['active', 'preferred', 'review'];
const RISK_OPTIONS: SupplierRisk[] = ['low', 'medium', 'high'];

interface DraftContact {
  key: number;
  name: string;
  role: ContactRole;
  email: string;
  phone: string;
  preferredMethod: PreferredMethod;
}

function emptyContact(key: number): DraftContact {
  return { key, name: '', role: 'Sales', email: '', phone: '', preferredMethod: 'Call' };
}

// ---------------------------------------------------------------------------
// Small shared field primitives (local — matches Vyso form language)
// ---------------------------------------------------------------------------

function fieldClass(): string {
  return 'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none transition-colors placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-[12px] font-medium text-[#6B6F68]">
      {children}
      {required ? <span className="ml-0.5 text-[#A32D2D]">*</span> : null}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={fieldClass()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((s, i) => {
        const idx = i;
        const done = idx < step;
        const current = idx === step;
        return (
          <div key={s.n} className="flex items-center gap-1.5">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors"
              style={
                current
                  ? { backgroundColor: ACCENT, color: '#fff' }
                  : done
                    ? { backgroundColor: `${ACCENT}1A`, color: ACCENT }
                    : { backgroundColor: '#EEF1F5', color: FAINT }
              }
            >
              {done ? '✓' : s.n}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="h-px w-4 shrink-0" style={{ backgroundColor: done ? ACCENT : '#EEF1F5' }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-supplier wizard
// ---------------------------------------------------------------------------

export function AddSupplierWizard() {
  const ss = useSupplySync();
  const { org } = usePlatform();
  const router = useRouter();
  const { node: toastNode, show } = useToast();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // --- Wizard state ------------------------------------------------------
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — supplier details
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Step 2 — extra contacts
  const [contacts, setContacts] = useState<DraftContact[]>([]);
  const [contactSeq, setContactSeq] = useState(1);

  // Step 3 — categories supplied
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');

  // Step 4 — documents on file (informational for now)
  const [docsOnFile, setDocsOnFile] = useState<string[]>([]);

  // Step 5 — risk & preferred
  const [status, setStatus] = useState<SupplierStatus>('active');
  const [risk, setRisk] = useState<SupplierRisk>('low');
  const [rating, setRating] = useState(4);

  // Reset every field whenever the wizard is (re)opened.
  useEffect(() => {
    if (!ss.addOpen) return;
    setStep(0);
    setSaving(false);
    setError(null);
    setName('');
    setCategory('');
    setContactName('');
    setContactPhone('');
    setContactEmail('');
    setContacts([]);
    setContactSeq(1);
    setCategories([]);
    setCategoryInput('');
    setDocsOnFile([]);
    setStatus('active');
    setRisk('low');
    setRating(4);
  }, [ss.addOpen]);

  const nameValid = name.trim().length > 0;
  const isLast = step === STEPS.length - 1;

  // --- Category chip helpers --------------------------------------------
  function addCategory(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setCategories((prev) => (prev.some((c) => c.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value]));
    setCategoryInput('');
  }
  function removeCategory(value: string) {
    setCategories((prev) => prev.filter((c) => c !== value));
  }

  // --- Contact helpers --------------------------------------------------
  function addContact() {
    setContacts((prev) => [...prev, emptyContact(contactSeq)]);
    setContactSeq((n) => n + 1);
  }
  function removeContact(key: number) {
    setContacts((prev) => prev.filter((c) => c.key !== key));
  }
  function patchContact(key: number, patch: Partial<DraftContact>) {
    setContacts((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  // --- Doc toggle --------------------------------------------------------
  function toggleDoc(doc: string) {
    setDocsOnFile((prev) => (prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc]));
  }

  // --- Real create -------------------------------------------------------
  async function handleCreate() {
    if (!nameValid || saving) return;
    setError(null);
    setSaving(true);

    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected — reconnect to Supabase to add a supplier.');
      setSaving(false);
      return;
    }

    const trimmedName = name.trim();

    const { data: inserted, error: insertErr } = await supabase
      .from('ss_suppliers')
      .insert({
        org_id: org.id,
        name: trimmedName,
        category: category.trim() || null,
        categories,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        status,
        risk,
        rating,
        notes: [],
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      setError(insertErr?.message ?? 'Could not create the supplier.');
      setSaving(false);
      return;
    }

    // Persist any extra contacts against the new supplier.
    const namedContacts = contacts.filter((c) => c.name.trim().length > 0);
    if (namedContacts.length > 0) {
      const { error: contactErr } = await supabase.from('ss_supplier_contacts').insert(
        namedContacts.map((c, index) => ({
          org_id: org.id,
          supplier_id: inserted.id,
          name: c.name.trim(),
          role: c.role,
          email: c.email.trim() || null,
          phone: c.phone.trim() || null,
          preferred_method: c.preferredMethod,
          is_primary: false,
          sort_order: index,
        })),
      );
      if (contactErr) {
        // Supplier is created; surface the contact failure but don't lose the record.
        setError(`Supplier added, but contacts failed: ${contactErr.message}`);
        setSaving(false);
        router.refresh();
        return;
      }
    }

    router.refresh();
    ss.closeAdd();
    show(`${trimmedName} added`);
  }

  const canAdvance = useMemo(() => {
    if (step === 0) return nameValid;
    return true;
  }, [step, nameValid]);

  if (!mounted) return <>{toastNode}</>;
  if (!ss.addOpen) return <>{toastNode}</>;

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 sm:items-center"
          style={{ fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties}
        >
          <div className="absolute inset-0 bg-[#171A17]/25 backdrop-blur-[2px]" onClick={ss.closeAdd} />

          <div className="relative my-auto w-full max-w-[560px] rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_24px_70px_-20px_rgba(26,28,30,0.45)]">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="of-display text-[18px] font-semibold tracking-[-0.015em] text-[#171A17]">Add supplier</div>
                <div className="mt-0.5 text-[13px] text-[#6B6F68]">
                  Step <span className="of-num">{step + 1}</span> of <span className="of-num">{STEPS.length}</span> · {STEPS[step].label}
                </div>
              </div>
              <button
                type="button"
                onClick={ss.closeAdd}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] text-[#8A8E86] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]"
              >
                ✕
              </button>
            </div>

            <div className="mt-3.5">
              <StepIndicator step={step} />
            </div>

            <div className="my-4 h-px w-full bg-[#EEF1F5]" />

            {/* Body */}
            <div className="min-h-[248px]">
              {step === 0 ? (
                <div className="space-y-3.5">
                  <TextField
                    label="Supplier name"
                    required
                    autoFocus
                    value={name}
                    onChange={setName}
                    placeholder="e.g. Cape Fresh Produce"
                  />
                  <TextField
                    label="Primary category"
                    value={category}
                    onChange={setCategory}
                    placeholder="e.g. Citrus"
                  />
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <TextField label="Contact name" value={contactName} onChange={setContactName} placeholder="Main contact" />
                    <TextField label="Contact phone" type="tel" value={contactPhone} onChange={setContactPhone} placeholder="072 000 0000" />
                  </div>
                  <TextField label="Contact email" type="email" value={contactEmail} onChange={setContactEmail} placeholder="orders@supplier.co.za" />
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-3">
                  <p className="text-[12px] leading-snug text-[#6B6F68]">
                    Add the people you deal with. These are saved against the supplier — the primary contact from step 1 is
                    kept separately.
                  </p>
                  {contacts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-4 py-6 text-center text-[13px] text-[#6B6F68]">
                      No extra contacts yet — optional.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contacts.map((c) => (
                        <div key={c.key} className="rounded-xl border border-[#EAEDF2] bg-[#FBFCFE] p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-medium text-[#6B6F68]">Contact</span>
                            <button
                              type="button"
                              onClick={() => removeContact(c.key)}
                              className="text-[12px] font-medium text-[#A32D2D] hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <input
                              value={c.name}
                              onChange={(e) => patchContact(c.key, { name: e.target.value })}
                              placeholder="Name"
                              className={fieldClass()}
                            />
                            <select
                              value={c.role}
                              onChange={(e) => patchContact(c.key, { role: e.target.value as ContactRole })}
                              className={fieldClass()}
                            >
                              {CONTACT_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                            <input
                              value={c.email}
                              onChange={(e) => patchContact(c.key, { email: e.target.value })}
                              placeholder="Email"
                              type="email"
                              className={fieldClass()}
                            />
                            <input
                              value={c.phone}
                              onChange={(e) => patchContact(c.key, { phone: e.target.value })}
                              placeholder="Phone"
                              type="tel"
                              className={fieldClass()}
                            />
                            <select
                              value={c.preferredMethod}
                              onChange={(e) => patchContact(c.key, { preferredMethod: e.target.value as PreferredMethod })}
                              className={`${fieldClass()} sm:col-span-2`}
                            >
                              {PREFERRED_METHODS.map((m) => (
                                <option key={m} value={m}>
                                  Preferred: {m}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={addContact}
                    className="inline-flex h-[42px] w-full items-center justify-center rounded-[12px] border border-dashed border-[#E2E6EC] px-4 text-[14px] font-medium text-[#6B6F68] transition-colors hover:border-[#3E7BC4] hover:text-[#1F5FA8]"
                  >
                    + Add contact
                  </button>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-3.5">
                  <div>
                    <Label>Categories supplied</Label>
                    <div className="flex gap-2">
                      <input
                        value={categoryInput}
                        onChange={(e) => setCategoryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCategory(categoryInput);
                          }
                        }}
                        placeholder="Type a category and press Enter"
                        className={fieldClass()}
                      />
                      <button
                        type="button"
                        onClick={() => addCategory(categoryInput)}
                        disabled={!categoryInput.trim()}
                        className="inline-flex h-11 shrink-0 items-center rounded-[12px] px-[18px] text-[14px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ backgroundColor: INK }}
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1 text-[12px] font-medium"
                          style={{ backgroundColor: `${ACCENT}12`, color: ACCENT }}
                        >
                          {c}
                          <button
                            type="button"
                            onClick={() => removeCategory(c)}
                            aria-label={`Remove ${c}`}
                            className="flex h-4 w-4 items-center justify-center rounded-full text-[11px] leading-none text-[#8A8E86] transition-colors hover:bg-[#EEF1F5] hover:text-[#171A17]"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#8A8E86]">No categories added yet.</p>
                  )}

                  <div>
                    <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Quick add</div>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_CATEGORIES.map((c) => {
                        const chosen = categories.some((x) => x.toLowerCase() === c.toLowerCase());
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => (chosen ? removeCategory(c) : addCategory(c))}
                            className="rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors"
                            style={
                              chosen
                                ? { borderColor: ACCENT, backgroundColor: `${ACCENT}12`, color: ACCENT }
                                : { borderColor: '#EAEDF2', color: MUTE }
                            }
                          >
                            {chosen ? '✓ ' : '+ '}
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-3">
                  <p className="text-[12px] leading-snug text-[#6B6F68]">
                    Tick the compliance documents you already hold for this supplier. This is a checklist for now — once{' '}
                    <span className="font-medium text-[#171A17]">Doc-U</span> reads an uploaded document it will feed the
                    live document record and expiry tracking here.
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {STANDARD_DOCS.map((doc) => {
                      const on = docsOnFile.includes(doc);
                      return (
                        <button
                          key={doc}
                          type="button"
                          onClick={() => toggleDoc(doc)}
                          className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors"
                          style={
                            on
                              ? { borderColor: GREEN, backgroundColor: `${GREEN}0F` }
                              : { borderColor: '#EAEDF2', backgroundColor: '#fff' }
                          }
                        >
                          <span
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-bold text-white"
                            style={{ backgroundColor: on ? GREEN : '#E1E1DC' }}
                          >
                            {on ? '✓' : ''}
                          </span>
                          <span className="text-[#171A17]">{doc}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[12px] text-[#A0A49C]">
                    <span className="of-num">{docsOnFile.length}</span> of <span className="of-num">{STANDARD_DOCS.length}</span> marked on file · informational only, not required to save.
                  </p>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <Label>Status</Label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as SupplierStatus)}
                        className={fieldClass()}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {SUPPLIER_STATUS_META[s].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Risk level</Label>
                      <select
                        value={risk}
                        onChange={(e) => setRisk(e.target.value as SupplierRisk)}
                        className={fieldClass()}
                      >
                        {RISK_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {SUPPLIER_RISK_META[r].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label>Rating</Label>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setRating(n)}
                            aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
                            className="text-[20px] leading-none transition-colors"
                            style={{ color: n <= rating ? '#C9A227' : '#E1E1DC' }}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <span className="of-num text-[14px] text-[#6B6F68]">{rating}.0</span>
                    </div>
                  </div>

                  <label
                    className="flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-3 transition-colors"
                    style={
                      status === 'preferred'
                        ? { borderColor: GREEN, backgroundColor: `${GREEN}0D` }
                        : { borderColor: '#EAEDF2', backgroundColor: '#FBFCFE' }
                    }
                  >
                    <span>
                      <span className="block text-[13px] font-medium text-[#171A17]">Preferred supplier</span>
                      <span className="mt-0.5 block text-[12px] text-[#6B6F68]">
                        Flag as a go-to supplier — sets status to preferred.
                      </span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={status === 'preferred'}
                      onClick={() =>
                        setStatus((prev) => (prev === 'preferred' ? 'active' : 'preferred'))
                      }
                      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                      style={{ backgroundColor: status === 'preferred' ? GREEN : '#E2E6EC' }}
                    >
                      <span
                        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                        style={{ left: status === 'preferred' ? '22px' : '2px' }}
                      />
                    </button>
                  </label>

                  <div className="rounded-[14px] border border-[#EEF1F5] bg-[#FBFCFE] p-3.5">
                    <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Ready to add</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="of-display text-[15px] font-semibold text-[#171A17]">
                        {name.trim() || 'Unnamed supplier'}
                      </span>
                      <Stars rating={rating} />
                    </div>
                    <div className="mt-1 text-[12px] text-[#6B6F68]">
                      {SUPPLIER_STATUS_META[status].label} · {SUPPLIER_RISK_META[risk].label}
                      {categories.length > 0 ? ` · ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}` : ''}
                      {contacts.filter((c) => c.name.trim()).length > 0
                        ? ` · ${contacts.filter((c) => c.name.trim()).length} contact${contacts.filter((c) => c.name.trim()).length === 1 ? '' : 's'}`
                        : ''}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Error */}
            {error ? (
              <p className="mt-3 rounded-xl px-3 py-2 text-[12px]" style={{ backgroundColor: `${RED}0F`, color: RED }}>
                {error}
              </p>
            ) : null}

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#EEF1F5] pt-4">
              <button
                type="button"
                onClick={() => (step === 0 ? ss.closeAdd() : setStep((s) => s - 1))}
                disabled={saving}
                className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-50"
              >
                {step === 0 ? 'Cancel' : 'Back'}
              </button>

              {isLast ? (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!nameValid || saving}
                  className="inline-flex h-[42px] items-center rounded-[11px] px-[18px] text-[14px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ backgroundColor: ACCENT }}
                >
                  {saving ? 'Creating…' : 'Create supplier'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => canAdvance && setStep((s) => s + 1)}
                  disabled={!canAdvance}
                  className="inline-flex h-[42px] items-center rounded-[11px] px-[18px] text-[14px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ backgroundColor: ACCENT }}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      {toastNode}
    </>
  );
}
