'use client';

/**
 * SupplierProfileDrawer — the rich supplier intelligence drawer for SupplySync.
 *
 * Opened from any SupplySync surface via ss.openProfile(id). Reads the aggregate
 * Supplier from context and surfaces its scorecard, contacts, documents,
 * performance, pricing intelligence, notes and relationship history across
 * internal sub-tabs. SupplySync only *surfaces* pricing and *recommends*
 * suppliers — no stock/inventory or buying workflow lives here (that is
 * ProcurePulse). Two actions persist to Supabase: adding a contact
 * (ss_supplier_contacts) and adding a note (ss_suppliers.notes jsonb). The
 * Documents tab also lists REAL Doc-U documents filed against this supplier
 * (via the suppliers bridge — supabase/supplysync-link.sql); upload/request
 * remain honest (demo) placeholders.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type {
  Supplier,
  SupplierContact,
  SupplierDocument,
  SupplierHistoryEvent,
  SupplierNote,
  SupplierPricingRecord,
  PreferredMethod,
} from '@/lib/platform/supplysync-data';
import { useSupplySync } from '@/components/platform/supplysync/context';
import {
  zar,
  INK,
  MUTE,
  FAINT,
  TEAL,
  GREEN,
  AMBER,
  RED,
  PURPLE,
  scoreColor,
  ScoreStat,
  ScorePill,
  Stars,
  SupplierStatusBadge,
  SupplierRiskBadge,
  DocStatusBadge,
  DOC_STATUS_META,
  POSITION_META,
  marketDiffColor,
  eventMeta,
} from '@/components/platform/supplysync/shared';
import { DataTable } from '@/components/platform/module-ui';
import { Drawer, useToast } from '@/components/platform/orderflow/ui';
import { Sparkline } from '@/components/platform/procurepulse/ui';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';

// ---------------------------------------------------------------------------
// Sub-tabs (local, underline style matching the rest of the app)
// ---------------------------------------------------------------------------

const TABS = ['Overview', 'Contacts', 'Documents', 'Performance', 'Pricing', 'Notes', 'History'] as const;
type Tab = (typeof TABS)[number];

/** Standard compliance document set every preferred supplier should hold. */
const STANDARD_DOCS = [
  'Tax Clearance',
  'BEE Certificate',
  'Food Safety',
  'Bank Confirmation',
  'Insurance',
  'Contract',
  'Price List',
] as const;

const PREFERRED_METHODS: PreferredMethod[] = ['Call', 'WhatsApp', 'Email'];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(v: string | null): string {
  if (!v) return '—';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Small presentational atoms (kept local — no new shared utilities)
// ---------------------------------------------------------------------------

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[#E7E7E2] bg-white px-2.5 py-1 text-[12px] text-[#5F6368]">{children}</span>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F6F6F2] py-2 last:border-0">
      <span className="shrink-0 text-[12px] text-[#9A9DA1]">{label}</span>
      <span className="min-w-0 text-right text-[13px] text-[#1A1C1E]">{children}</span>
    </div>
  );
}

function MiniStat({ label, value, color = INK, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white p-3.5">
      <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">{label}</div>
      <div className="mt-1 text-[20px] font-bold leading-none tabular-nums" style={{ color }}>{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-[#9A9DA1]">{sub}</div> : null}
    </div>
  );
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h4 className="text-[13px] font-semibold text-[#1A1C1E]">{children}</h4>
      {right}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

export function SupplierProfileDrawer() {
  const ss = useSupplySync();
  const supplier = ss.supplierById(ss.profileId);
  if (!supplier) return null;
  return <ProfileBody key={supplier.id} supplier={supplier} />;
}

function ProfileBody({ supplier }: { supplier: Supplier }) {
  const ss = useSupplySync();
  const [tab, setTab] = useState<Tab>('Overview');
  const toast = useToast();

  const subtitle = `${supplier.category || 'Supplier'} · Last order ${supplier.lastOrder ? fmtDate(supplier.lastOrder) : '—'}`;

  const right = (
    <div className="flex items-center gap-2">
      <SupplierStatusBadge status={supplier.status} />
      <button
        type="button"
        onClick={() => {
          if (!ss.isComparing(supplier.id)) ss.toggleCompare(supplier.id);
          ss.openCompare();
        }}
        className="rounded-lg border border-[#E7E7E2] px-2.5 py-1 text-[12px] font-medium text-[#5F6368] transition-colors hover:bg-[#F0F0EC] hover:text-[#1A1C1E]"
      >
        {ss.isComparing(supplier.id) ? 'In compare' : 'Compare'}
      </button>
    </div>
  );

  return (
    <Drawer open onClose={ss.closeProfile} title={supplier.name} subtitle={subtitle} right={right} width={640}>
      {/* Header strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-3.5">
          <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Overall</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[22px] font-bold leading-none tabular-nums" style={{ color: scoreColor(supplier.scorecard.overall) }}>
              {supplier.scorecard.overall}
            </span>
            <ScorePill value={supplier.scorecard.overall} />
          </div>
        </div>
        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-3.5">
          <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Risk</div>
          <div className="mt-1.5"><SupplierRiskBadge risk={supplier.risk} /></div>
        </div>
        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-3.5">
          <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Rating</div>
          <div className="mt-1.5"><Stars rating={supplier.rating} /></div>
        </div>
        <div className="rounded-2xl border border-[#E7E7E2] bg-white p-3.5">
          <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Avg / month</div>
          <div className="mt-1 text-[18px] font-bold leading-none tabular-nums text-[#1A1C1E]">{zar(supplier.avgMonthlySpend)}</div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-b border-[#F0F0EC] pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-1.5 pt-1 text-[13px] transition-colors ${
              tab === t ? 'border-[#B0466A] font-medium text-[#1A1C1E]' : 'border-transparent text-[#9A9DA1] hover:text-[#5F6368]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'Overview' ? <OverviewTab supplier={supplier} /> : null}
        {tab === 'Contacts' ? <ContactsTab supplier={supplier} show={toast.show} /> : null}
        {tab === 'Documents' ? <DocumentsTab supplier={supplier} show={toast.show} /> : null}
        {tab === 'Performance' ? <PerformanceTab supplier={supplier} /> : null}
        {tab === 'Pricing' ? <PricingTab supplier={supplier} /> : null}
        {tab === 'Notes' ? <NotesTab supplier={supplier} show={toast.show} /> : null}
        {tab === 'History' ? <HistoryTab supplier={supplier} /> : null}
      </div>

      {toast.node}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewTab({ supplier }: { supplier: Supplier }) {
  const sc = supplier.scorecard;
  const primary = supplier.contacts.find((c) => c.isPrimary) ?? supplier.contacts[0];
  const backup = supplier.contacts.find((c) => !c.isPrimary && c.id !== primary?.id) ?? supplier.contacts[1];
  const latestNote = supplier.notes.length ? supplier.notes[supplier.notes.length - 1] : null;
  const primaryLabel = primary ? `${primary.name}${primary.role ? ` · ${primary.role}` : ''}` : supplier.contactName ?? '—';

  const chain = [
    { label: 'Supplier', color: PURPLE },
    { label: `Contacts ${supplier.contacts.length}`, color: TEAL },
    { label: `Documents ${supplier.docs.length}`, color: GREEN },
    { label: 'Performance', color: AMBER },
    { label: 'Pricing', color: TEAL },
    { label: `Risk ${supplier.openRisks}`, color: supplier.openRisks ? RED : FAINT },
  ];

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Scorecard</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ScoreStat label="Overall" value={sc.overall} />
          <ScoreStat label="Reliability" value={sc.reliability} />
          <ScoreStat label="Quality" value={sc.quality} />
          <ScoreStat label="Delivery" value={sc.deliveryConsistency} />
          <ScoreStat label="Price stab." value={sc.priceStability} />
          <ScoreStat label="Response" value={sc.responsiveness} />
          <ScoreStat label="Compliance" value={sc.compliance} />
        </div>
      </div>

      <div>
        <SectionLabel>Details</SectionLabel>
        <div className="mt-2 rounded-2xl border border-[#E7E7E2] bg-white px-4 py-1.5">
          <DetailRow label="Categories">
            {supplier.categories.length ? (
              <span className="inline-flex flex-wrap justify-end gap-1.5">
                {supplier.categories.map((c) => (<Chip key={c}>{c}</Chip>))}
              </span>
            ) : (
              '—'
            )}
          </DetailRow>
          <DetailRow label="Status"><SupplierStatusBadge status={supplier.status} /></DetailRow>
          <DetailRow label="Risk level"><SupplierRiskBadge risk={supplier.risk} /></DetailRow>
          <DetailRow label="Last order">{fmtDate(supplier.lastOrder)}</DetailRow>
          <DetailRow label="Avg monthly spend">{zar(supplier.avgMonthlySpend)}</DetailRow>
          <DetailRow label="Lead time">{supplier.leadTimeDays} day{supplier.leadTimeDays === 1 ? '' : 's'}</DetailRow>
          <DetailRow label="Primary contact">{primaryLabel}</DetailRow>
          <DetailRow label="Backup contact">{backup ? `${backup.name}${backup.role ? ` · ${backup.role}` : ''}` : '—'}</DetailRow>
          <DetailRow label="Linked documents">{supplier.docs.length}</DetailRow>
          <DetailRow label="Latest note">
            {latestNote ? <span className="text-[#5F6368]">{latestNote.body}</span> : '—'}
          </DetailRow>
        </div>
      </div>

      <div>
        <SectionLabel>How this supplier connects</SectionLabel>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {chain.map((c, i) => (
            <span key={c.label} className="inline-flex items-center gap-1.5">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium"
                style={{ backgroundColor: `${c.color}14`, color: c.color }}
              >
                {c.label}
              </span>
              {i < chain.length - 1 ? <span className="text-[12px] text-[#C4C4BE]">→</span> : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contacts (real insert into ss_supplier_contacts)
// ---------------------------------------------------------------------------

function ContactsTab({ supplier, show }: { supplier: Supplier; show: (m: string) => void }) {
  const { org } = usePlatform();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Sales');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<PreferredMethod>('Call');

  async function save() {
    if (!name.trim()) {
      setError('Contact name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      setSaving(false);
      return;
    }
    const { error: err } = await supabase.from('ss_supplier_contacts').insert({
      org_id: org.id,
      supplier_id: supplier.id,
      name: name.trim(),
      role: role.trim() || 'Sales',
      email: email.trim() || null,
      phone: phone.trim() || null,
      preferred_method: method,
      is_primary: false,
      sort_order: supplier.contacts.length,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setAdding(false);
    setName('');
    setRole('Sales');
    setEmail('');
    setPhone('');
    setMethod('Call');
    await supabase.from('ss_suppliers').update({ updated_at: new Date().toISOString() }).eq('id', supplier.id).eq('org_id', org.id);
    show('Contact added');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <SectionLabel
        right={
          !adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-lg border border-[#E7E7E2] px-2.5 py-1 text-[12px] font-medium text-[#5F6368] transition-colors hover:bg-[#F0F0EC] hover:text-[#1A1C1E]"
            >
              + Add contact
            </button>
          ) : null
        }
      >
        Contacts
      </SectionLabel>

      {adding ? (
        <div className="rounded-2xl border border-[#E7E7E2] bg-[#FBFBF9] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Full name" />
            </Field>
            <Field label="Role">
              <input value={role} onChange={(e) => setRole(e.target.value)} className={inputCls} placeholder="Sales" />
            </Field>
            <Field label="Email">
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="name@supplier.co.za" />
            </Field>
            <Field label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+27…" />
            </Field>
            <Field label="Preferred method">
              <select value={method} onChange={(e) => setMethod(e.target.value as PreferredMethod)} className={inputCls}>
                {PREFERRED_METHODS.map((m) => (<option key={m} value={m}>{m}</option>))}
              </select>
            </Field>
          </div>
          {error ? <p className="mt-2 text-[12px] text-[#A32D2D]">{error}</p> : null}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-[#1A1C1E] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save contact'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#5F6368] transition-colors hover:text-[#1A1C1E]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {supplier.contacts.length === 0 && !adding ? (
        <p className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-4 py-6 text-center text-[13px] text-[#9A9DA1]">
          No contacts captured yet. Add the person you deal with most.
        </p>
      ) : (
        <div className="space-y-2">
          {supplier.contacts.map((c) => (
            <ContactCard key={c.id} contact={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContactCard({ contact }: { contact: SupplierContact }) {
  return (
    <div className="rounded-2xl border border-[#E7E7E2] bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-semibold text-[#1A1C1E]">{contact.name}</span>
            {contact.isPrimary ? <span className="text-[13px]" style={{ color: '#C9A227' }} aria-label="Primary contact">★</span> : null}
          </div>
          <div className="mt-0.5 text-[12px] text-[#5F6368]">{contact.role}</div>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: '#F0F0EC', color: MUTE }}
        >
          Prefers {contact.preferredMethod}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#5F6368]">
        {contact.email ? <span>{contact.email}</span> : null}
        {contact.phone ? <span>{contact.phone}</span> : null}
        {!contact.email && !contact.phone ? <span className="text-[#9A9DA1]">No email or phone on file</span> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents (checklist + missing standard docs; upload/request are demo)
// ---------------------------------------------------------------------------

function DocumentsTab({ supplier, show }: { supplier: Supplier; show: (m: string) => void }) {
  const present = supplier.docs;
  const presentLabels = new Set(present.map((d) => d.label.toLowerCase()));
  const missing = STANDARD_DOCS.filter((label) => !presentLabels.has(label.toLowerCase()));

  return (
    <div className="space-y-4">
      <SectionLabel>Compliance documents</SectionLabel>

      {present.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-4 py-6 text-center text-[13px] text-[#9A9DA1]">
          No documents on file yet.
        </p>
      ) : (
        <div className="space-y-2">
          {present.map((d) => (
            <DocRow key={d.id} doc={d} show={show} />
          ))}
        </div>
      )}

      {missing.length ? (
        <div>
          <SectionLabel>Missing from standard set</SectionLabel>
          <div className="mt-2 space-y-2">
            {missing.map((label) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E7E7E2] bg-white p-3.5">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[#1A1C1E]">{label}</div>
                  <div className="mt-0.5"><DocStatusBadge status="missing" /></div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => show(`Document request sent to ${supplier.name} (demo)`)} className={ghostBtn}>
                    Request
                  </button>
                  <button type="button" onClick={() => show('Doc-U upload coming soon (demo)')} className={ghostBtn}>
                    Upload
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {supplier.linkedDocs.length ? (
        <div>
          <SectionLabel>From Doc-U</SectionLabel>
          <div className="mt-2 space-y-2">
            {supplier.linkedDocs.map((d) => (
              <Link
                key={d.id}
                href={`/app/docu/${d.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#E7E7E2] bg-white p-3.5 transition-colors hover:border-[#B0466A]/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-[#1A1C1E]">{d.filename}</div>
                  <div className="mt-0.5 text-[12px] text-[#9A9DA1]">
                    {[LINKED_DOC_LABEL[d.docType ?? ''] ?? 'Document', d.date ? fmtDate(d.date) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <div className="shrink-0 text-[13px] font-semibold tabular-nums text-[#1A1C1E]">
                  {d.total != null ? zar(d.total) : ''}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const LINKED_DOC_LABEL: Record<string, string> = {
  invoice: 'Invoice',
  statement: 'Statement',
  delivery_note: 'Delivery note',
  price_list: 'Price list',
  order: 'Order',
};

function DocRow({ doc, show }: { doc: SupplierDocument; show: (m: string) => void }) {
  const meta = DOC_STATUS_META[doc.status];
  const expiryText =
    doc.status === 'missing'
      ? 'Not provided'
      : doc.expiry
        ? `Expires ${fmtDate(doc.expiry)}${doc.daysRemaining != null ? ` · ${doc.daysRemaining < 0 ? `${Math.abs(doc.daysRemaining)}d overdue` : `${doc.daysRemaining}d left`}` : ''}`
        : 'No expiry';
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E7E7E2] bg-white p-3.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[#1A1C1E]">{doc.label}</div>
        <div className="mt-1 flex items-center gap-2">
          <DocStatusBadge status={doc.status} />
          <span className="text-[12px]" style={{ color: doc.status === 'expired' || doc.status === 'missing' ? RED : meta.color }}>
            {expiryText}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => show(`Document request sent to ${doc.label} owner (demo)`)} className={ghostBtn}>
          Request
        </button>
        <button type="button" onClick={() => show('Doc-U upload coming soon (demo)')} className={ghostBtn}>
          Upload
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

function PerformanceTab({ supplier }: { supplier: Supplier }) {
  const p = supplier.performance;
  const trends: { label: string; data: number[]; color: string }[] = [
    { label: 'Reliability trend', data: p.reliabilityTrend, color: TEAL },
    { label: 'Delivery trend', data: p.deliveryTrend, color: GREEN },
    { label: 'Score trend', data: p.scoreTrend, color: PURPLE },
  ];
  const hasTrends = trends.some((t) => t.data.length > 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ScoreStat label="Reliability" value={supplier.scorecard.reliability} />
        <ScoreStat label="Delivery" value={supplier.scorecard.deliveryConsistency} suffix="" />
        <MiniStat label="On time" value={`${supplier.onTimePct}%`} color={scoreColor(supplier.onTimePct)} />
        <MiniStat label="Delivered" value={`${supplier.deliveryPct}%`} color={scoreColor(supplier.deliveryPct)} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Late deliveries" value={String(p.lateDeliveries)} color={p.lateDeliveries ? RED : GREEN} sub="last 90 days" />
        <MiniStat label="Quality issues" value={String(p.qualityIssues)} color={p.qualityIssues ? AMBER : GREEN} sub="last 90 days" />
        <MiniStat label="Complaints" value={String(p.complaints)} color={p.complaints ? RED : GREEN} sub="last 90 days" />
        <MiniStat label="Response time" value={`${p.responseHours}h`} color={INK} sub="avg" />
      </div>

      <div>
        <SectionLabel>Trends</SectionLabel>
        {hasTrends ? (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {trends.map((t) => (
              <div key={t.label} className="rounded-2xl border border-[#E7E7E2] bg-white p-3.5">
                <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">{t.label}</div>
                <div className="mt-2">
                  {t.data.length > 1 ? (
                    <Sparkline data={t.data} color={t.color} width={180} height={44} />
                  ) : (
                    <span className="text-[12px] text-[#9A9DA1]">Not enough data</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-4 py-6 text-center text-[13px] text-[#9A9DA1]">
            No trend history captured yet.
          </p>
        )}
      </div>

      {supplier.lastIssue ? (
        <div className="rounded-2xl border border-[#E7E7E2] bg-[#FBFBF9] p-3.5">
          <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">Last issue</div>
          <div className="mt-1 text-[13px] text-[#1A1C1E]">{supplier.lastIssue}</div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pricing (intelligence only — SupplySync surfaces, ProcurePulse buys)
// ---------------------------------------------------------------------------

function PricingTab({ supplier }: { supplier: Supplier }) {
  const rows: React.ReactNode[][] = supplier.pricing.map((p: SupplierPricingRecord) => {
    const pos = POSITION_META[p.position];
    return [
      <div key="item" className="min-w-0">
        <div className="font-medium text-[#1A1C1E]">{p.item}</div>
        <div className="text-[11px] text-[#9A9DA1]">{p.category} · per {p.unit}</div>
      </div>,
      <span key="cur" className="tabular-nums text-[#1A1C1E]">{zar(p.currentPrice)}</span>,
      <span key="prev" className="tabular-nums text-[#9A9DA1]">{zar(p.previousPrice)}</span>,
      <span key="chg" className="tabular-nums font-medium" style={{ color: p.changePct > 0 ? RED : p.changePct < 0 ? GREEN : MUTE }}>
        {p.changePct > 0 ? '+' : ''}{p.changePct}%
      </span>,
      <span key="mkt" className="tabular-nums text-[#5F6368]">{zar(p.marketAvg)}</span>,
      <span key="pos" className="font-medium" style={{ color: pos.color }}>
        {pos.label}
        <span className="ml-1 text-[11px]" style={{ color: marketDiffColor(p.diffVsMarketPct) }}>
          ({p.diffVsMarketPct > 0 ? '+' : ''}{p.diffVsMarketPct}%)
        </span>
      </span>,
      <span key="upd" className="text-[12px] text-[#9A9DA1]">{fmtDate(p.lastUpdated)}</span>,
      p.trend.length > 1 ? (
        <Sparkline key="spark" data={p.trend} color={p.changePct > 0 ? RED : TEAL} width={72} height={26} />
      ) : (
        <span key="spark" className="text-[12px] text-[#C4C4BE]">—</span>
      ),
    ];
  });

  return (
    <div className="space-y-3">
      <SectionLabel>Pricing intelligence</SectionLabel>
      <DataTable
        columns={[
          { label: 'Item' },
          { label: 'Current', align: 'right' },
          { label: 'Previous', align: 'right' },
          { label: 'Change', align: 'right' },
          { label: 'Market avg', align: 'right' },
          { label: 'Position' },
          { label: 'Updated' },
          { label: 'Trend' },
        ]}
        rows={rows}
        empty="No pricing captured for this supplier yet."
      />
      <p className="text-[12px] text-[#9A9DA1]">
        Pricing is surfaced for comparison only. Place and manage orders in ProcurePulse.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes (real append to ss_suppliers.notes jsonb)
// ---------------------------------------------------------------------------

function NotesTab({ supplier, show }: { supplier: Supplier; show: (m: string) => void }) {
  const { org } = usePlatform();
  const router = useRouter();
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addNote() {
    if (!body.trim()) {
      setError('Write something first.');
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      setSaving(false);
      return;
    }
    const next: SupplierNote[] = [...supplier.notes, { body: body.trim(), date: todayISO(), author: 'You' }];
    const { error: err } = await supabase.from('ss_suppliers').update({ notes: next, updated_at: new Date().toISOString() }).eq('id', supplier.id).eq('org_id', org.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setBody('');
    show('Note added');
    router.refresh();
  }

  const notes = [...supplier.notes].reverse();

  return (
    <div className="space-y-4">
      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Add a note about this supplier — a call outcome, a quality flag, a pricing agreement…"
          className="w-full resize-none rounded-2xl border border-[#E7E7E2] bg-white px-3.5 py-2.5 text-[13px] text-[#1A1C1E] outline-none placeholder:text-[#9A9DA1] focus:border-[#B0466A]"
        />
        {error ? <p className="mt-1 text-[12px] text-[#A32D2D]">{error}</p> : null}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={addNote}
            disabled={saving}
            className="rounded-lg bg-[#1A1C1E] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add note'}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-4 py-6 text-center text-[13px] text-[#9A9DA1]">
          No notes yet.
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((n, i) => (
            <div key={`${n.date}-${i}`} className="rounded-2xl border border-[#E7E7E2] bg-white p-3.5">
              <p className="text-[13px] text-[#1A1C1E]">{n.body}</p>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#9A9DA1]">
                <span>{fmtDate(n.date)}</span>
                {n.author ? <span>· {n.author}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History (relationship timeline)
// ---------------------------------------------------------------------------

function HistoryTab({ supplier }: { supplier: Supplier }) {
  const events = supplier.history;
  if (events.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[#D7DAD8] bg-[#FBFBF9] px-4 py-6 text-center text-[13px] text-[#9A9DA1]">
        No relationship history yet.
      </p>
    );
  }
  return (
    <ol className="relative ml-1 space-y-4 border-l border-[#F0F0EC] pl-5">
      {events.map((ev) => (
        <TimelineItem key={ev.id} event={ev} />
      ))}
    </ol>
  );
}

function TimelineItem({ event }: { event: SupplierHistoryEvent }) {
  const meta = eventMeta(event.eventType);
  return (
    <li className="relative">
      <span
        className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white"
        style={{ backgroundColor: meta.color }}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
        <span className="shrink-0 text-[11px] text-[#9A9DA1]">{fmtDate(event.date)}</span>
      </div>
      {event.summary ? <p className="mt-0.5 text-[13px] text-[#1A1C1E]">{event.summary}</p> : null}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#9A9DA1]">
        {event.contactName ? <span>{event.contactName}</span> : null}
        {event.channel ? <span>· {event.channel}</span> : null}
        {event.owner ? <span>· {event.owner}</span> : null}
      </div>
      {event.followUp ? (
        <div className="mt-1.5 rounded-lg border border-[#E7E7E2] bg-[#FBFBF9] px-2.5 py-1.5 text-[12px]">
          <span className="font-medium" style={{ color: event.followUpDone ? GREEN : AMBER }}>
            {event.followUpDone ? 'Follow-up done' : 'Follow-up'}
          </span>
          <span className="text-[#5F6368]"> — {event.followUp}</span>
          {event.followUpDate ? <span className="text-[#9A9DA1]"> ({fmtDate(event.followUpDate)})</span> : null}
        </div>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Small shared class strings + form field
// ---------------------------------------------------------------------------

const inputCls =
  'w-full rounded-lg border border-[#E7E7E2] bg-white px-2.5 py-1.5 text-[13px] text-[#1A1C1E] outline-none placeholder:text-[#9A9DA1] focus:border-[#B0466A]';

const ghostBtn =
  'rounded-lg border border-[#E7E7E2] px-2.5 py-1 text-[12px] font-medium text-[#5F6368] transition-colors hover:bg-[#F0F0EC] hover:text-[#1A1C1E]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-[#9A9DA1]">{label}</span>
      {children}
    </label>
  );
}
