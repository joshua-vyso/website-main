'use client';

import { Drawer } from '@/components/platform/orderflow/ui';
import { ModuleWidgetCard } from '@/components/platform/module-ui';
import { widgetsFor } from '@/lib/platform/module-widgets';
import { DEVICE_STATUS_STYLE, CATEGORY_COLOR, WASTE_REASONS, type DeviceStatus, type WasteCategory } from '@/lib/platform/wastewatch';
import { useCategories } from './categories';

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const s = DEVICE_STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'online' ? 'animate-pulse' : ''}`} style={{ backgroundColor: s.fg }} />
      {s.label}
    </span>
  );
}

export function CategoryBadge({ cat }: { cat: WasteCategory }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-[#5F6368]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[cat] }} />
      {cat}
    </span>
  );
}

export function BatteryPill({ level }: { level: number | null }) {
  if (level == null) return <span className="text-[12px] text-[#9A9DA1]">—</span>;
  const color = level <= 20 ? '#A32D2D' : level <= 50 ? '#854F0B' : '#0F6E56';
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums" style={{ color }}>
      <span className="relative inline-block h-3 w-6 rounded-sm border" style={{ borderColor: color }}>
        <span className="absolute inset-y-0.5 left-0.5 rounded-[1px]" style={{ width: `${Math.max(8, level * 0.18)}px`, backgroundColor: color }} />
      </span>
      {level}%
    </span>
  );
}

export function TrendArrow({ dir }: { dir: 'up' | 'down' | 'flat' }) {
  const map = { up: { g: '▲', c: '#A32D2D' }, down: { g: '▼', c: '#0F6E56' }, flat: { g: '→', c: '#9A9DA1' } };
  return <span style={{ color: map[dir].c }}>{map[dir].g}</span>;
}

export function MobileWidgets({ onAction }: { onAction?: () => void }) {
  return (
    <div>
      <h2 className="mb-2 text-[13px] font-semibold text-[#9A9DA1]">Mobile snapshot — widgets the companion app will surface</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {widgetsFor('wastewatch').map((w) => (
          <ModuleWidgetCard key={w.id} widget={w} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

export function LogWasteDrawer({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { categories } = useCategories();
  const input = 'h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none';
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Log waste"
      subtitle="Record an item — a connected scale will fill this automatically"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">Cancel</button>
          <button type="button" onClick={() => { onClose(); onSaved(); }} className="rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#184D45]">Log waste</button>
        </div>
      }
    >
      <div className="space-y-3">
        <input className={input} placeholder="Item (e.g. Strawberries)" />
        <div className="grid grid-cols-2 gap-3">
          <input className={input} placeholder="Quantity" />
          <select className={input}>{categories.map((c) => <option key={c.name}>{c.name}</option>)}</select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className={input} placeholder="Estimated cost (R)" />
          <select className={input}>{WASTE_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
        </div>
        <input className={input} placeholder="Recipe (optional)" />
        <textarea className={`${input} h-20 py-2`} placeholder="Notes (optional)" />
        <p className="rounded-lg bg-[#F6FAF8] px-3 py-2 text-[12px] text-[#5F6368]">A connected scale (Bluetooth / bench / floor) will capture quantity, device and operator automatically.</p>
      </div>
    </Drawer>
  );
}
