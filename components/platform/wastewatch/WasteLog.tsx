'use client';

import { useEffect, useMemo, useState } from 'react';
import { zar } from '@/lib/platform/orderflow';
import { useToast, Drawer } from '@/components/platform/orderflow/ui';
import { Badge } from '@/components/platform/module-ui';
import { WASTE_REASONS, type WasteEvent } from '@/lib/platform/wastewatch';
import { CategoryBadge, LogWasteModal } from './shared';
import { useWasteWatch } from './categories';

const distinct = (arr: string[]) => Array.from(new Set(arr)).sort();

export function WasteLog({ initialCategory }: { initialCategory?: string }) {
  const { node, show } = useToast();
  const ww = useWasteWatch();
  const categories = ww.categories;
  const events = ww.events;
  const [logOpen, setLogOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(initialCategory || 'all');
  const [employee, setEmployee] = useState('all');
  const [device, setDevice] = useState('all');
  const [recipe, setRecipe] = useState('all');
  const [reason, setReason] = useState('all');

  // Keep the category filter in sync with the URL ?category on same-route navigations
  // (Next.js re-renders this segment with a new prop without remounting). Any non-empty
  // value is accepted — built-in or user-created — so custom-category deep links work too;
  // an unknown value simply matches no events. This stays consistent with the dropdown,
  // which is populated from the same category store.
  useEffect(() => {
    setCategory(initialCategory || 'all');
  }, [initialCategory]);

  const employees = useMemo(() => distinct(events.map((e) => e.employee)), [events]);
  const devices = useMemo(() => distinct(events.map((e) => e.device)), [events]);
  const recipes = useMemo(() => distinct(events.map((e) => e.recipe).filter((r): r is string => !!r)), [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (category !== 'all' && e.category !== category) return false;
      if (employee !== 'all' && e.employee !== employee) return false;
      if (device !== 'all' && e.device !== device) return false;
      if (recipe !== 'all' && e.recipe !== recipe) return false;
      if (reason !== 'all' && e.reason !== reason) return false;
      if (q && !`${e.item} ${e.category} ${e.reason} ${e.employee} ${e.device} ${e.recipe ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, search, category, employee, device, recipe, reason]);

  const open = openId ? events.find((e) => e.id === openId) ?? null : null;
  const sel = 'h-11 rounded-[12px] border border-[#E4E9F0] bg-white px-3.5 text-[14px] text-[#3E4A57] outline-none transition-colors hover:border-[#C9DEF7] focus:border-[#3E7BC4]';

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Waste log</h1>
          <p className="mt-1.5 text-[14px] text-[#8A8E86]">Every waste event — item, recipe, employee and the device that measured it</p>
        </div>
        <button type="button" onClick={() => setLogOpen(true)} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]">+ Log waste</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item, recipe, employee…" className="h-11 min-w-[220px] flex-1 rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={sel}><option value="all">All categories</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
        <select value={employee} onChange={(e) => setEmployee(e.target.value)} className={sel}><option value="all">All employees</option>{employees.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select value={device} onChange={(e) => setDevice(e.target.value)} className={sel}><option value="all">All devices</option>{devices.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select value={recipe} onChange={(e) => setRecipe(e.target.value)} className={sel}><option value="all">All recipes</option>{recipes.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={sel}><option value="all">All reasons</option>{WASTE_REASONS.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                {['Date', 'Time', 'Item', 'Category', 'Qty', 'Cost', 'Reason', 'Recipe', 'Employee', 'Device', 'Location'].map((h) => (
                  <th key={h} className={`px-3 py-2.5 font-medium ${h === 'Qty' || h === 'Cost' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="px-5 py-12 text-center text-[14px] text-[#8A8E86]">No waste events match your filters.</td></tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} onClick={() => setOpenId(e.id)} className="cursor-pointer border-b border-[#F4F5F7] last:border-0 hover:bg-[#F5F9FE]">
                    <td className="of-num px-3 py-3.5 text-[13px] text-[#6B6F68]">{e.date}</td>
                    <td className="of-num px-3 py-3.5 text-[13px] text-[#A0A49C]">{e.time}</td>
                    <td className="px-3 py-3.5 font-semibold text-[#171A17]">{e.item}</td>
                    <td className="px-3 py-3.5"><CategoryBadge cat={e.category} /></td>
                    <td className="of-num px-3 py-3.5 text-right text-[#2C333B]">{e.qty} {e.unit}</td>
                    <td className="of-num px-3 py-3.5 text-right font-semibold" style={{ color: '#A32D2D' }}>{zar(e.cost)}</td>
                    <td className="px-3 py-3.5"><Badge label={e.reason} tone={e.preventable ? 'warning' : 'neutral'} /></td>
                    <td className="px-3 py-3.5 text-[#2C333B]">{e.recipe ?? '—'}</td>
                    <td className="px-3 py-3.5 text-[#2C333B]">{e.employee}</td>
                    <td className="px-3 py-3.5 text-[#2C333B]">{e.device}</td>
                    <td className="px-3 py-3.5 text-[#A0A49C]">{e.location}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open?.item ?? ''} subtitle={open ? `${open.date} · ${open.time} · ${open.location}` : undefined} right={open ? <Badge label={open.preventable ? 'Preventable' : 'Unavoidable'} tone={open.preventable ? 'warning' : 'neutral'} /> : undefined} width={520}>
        {open ? <WasteDetail e={open} /> : null}
      </Drawer>

      <LogWasteModal open={logOpen} onClose={() => setLogOpen(false)} onSaved={() => show('Waste logged')} />
    </div>
  );
}

function WasteDetail({ e }: { e: WasteEvent }) {
  const suggestions: string[] = [];
  if (e.reason === 'Over-portioned' && e.expectedQty != null) suggestions.push(`Recipe expects ${e.expectedQty}${e.unit} of ${e.ingredient ?? e.item}; actual was ${e.qty}${e.unit} — tighten portioning.`);
  if (e.reason === 'Spoiled' && e.ingredient) suggestions.push(`Reduce next order of ${e.ingredient} to cut spoilage.`);
  if (e.reason === 'Prep error') suggestions.push('Recurring prep error on this recipe — worth a quick refresher.');
  if (suggestions.length === 0) suggestions.push('No clear pattern yet — keep logging to surface a recommendation.');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-[13px]">
        <Field label="Quantity" value={`${e.qty} ${e.unit}`} />
        <Field label="Estimated cost" value={zar(e.cost)} color="#A32D2D" />
        <Field label="Reason" value={e.reason} />
        <Field label="Category" value={e.category} />
        <Field label="Employee" value={e.employee} />
        <Field label="Device" value={e.device} />
        <Field label="Recipe" value={e.recipe ?? '—'} />
        <Field label="Location" value={e.location} />
      </div>

      <Section title="Photos">
        <div className="flex gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex h-20 w-20 items-center justify-center rounded-[14px] border border-dashed border-[#D8DFE8] bg-[#F5F9FE] text-[11px] text-[#A0A49C]">No photo</div>
          ))}
        </div>
      </Section>

      <Section title="Linked ingredient — ProcurePulse">
        <div className="rounded-[14px] border border-[#EEF1F5] bg-white px-4 py-3.5 text-[14px]">
          {e.ingredient ? (
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-[#8A8E86]">Ingredient</span><span className="font-medium text-[#171A17]">{e.ingredient}</span></div>
              {e.supplier ? <div className="flex justify-between"><span className="text-[#8A8E86]">Supplier</span><span className="font-medium text-[#171A17]">{e.supplier}</span></div> : null}
              {e.batch ? <div className="flex justify-between"><span className="text-[#8A8E86]">Batch</span><span className="of-num font-medium text-[#171A17]">{e.batch}</span></div> : null}
              {e.expectedQty != null ? <div className="flex justify-between"><span className="text-[#8A8E86]">Expected qty</span><span className="of-num font-medium text-[#171A17]">{e.expectedQty} {e.unit}</span></div> : null}
            </div>
          ) : (
            <p className="text-[13px] text-[#8A8E86]">Will link to the ProcurePulse ingredient, supplier and purchase batch once connected.</p>
          )}
        </div>
      </Section>

      <Section title="AI suggestions">
        <div className="flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[14px]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F5FA8]" /><span className="text-[#6B6F68]">{s}</span></div>
          ))}
        </div>
      </Section>

      {e.notes ? <Section title="Notes"><p className="text-[14px] text-[#6B6F68]">{e.notes}</p></Section> : null}
    </div>
  );
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">{label}</div>
      <div className="of-num mt-1 text-[14px] font-semibold" style={{ color: color ?? '#171A17' }}>{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="of-display mb-2.5 text-[14px] font-semibold text-[#171A17]">{title}</h3>
      {children}
    </div>
  );
}
