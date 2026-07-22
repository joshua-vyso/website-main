'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast, Drawer } from '@/components/platform/orderflow/ui';
import { Kpi } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import { DEVICE_TYPES, type Device, type DeviceHistoryEvent } from '@/lib/platform/wastewatch';
import { DeviceStatusBadge, BatteryPill } from './shared';
import { useWasteWatch } from './categories';

export function WasteDevices() {
  const { node, show } = useToast();
  const { devices } = useWasteWatch();
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const online = devices.filter((d) => d.status === 'online').length;
  const offline = devices.filter((d) => d.status === 'offline').length;
  const needsCal = devices.filter((d) => d.status === 'calibrating' || d.calibration.startsWith('Due')).length;
  const eventsToday = devices.reduce((s, d) => s + d.eventsToday, 0);
  const batteryAlerts = devices.filter((d) => d.battery != null && d.battery <= 20).length;

  const open = openId ? devices.find((d) => d.id === openId) ?? null : null;

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Devices</h1>
          <p className="mt-1.5 text-[14px] text-[#8A8E86]">Connected scales and sensors that measure waste automatically</p>
        </div>
        <button type="button" onClick={() => setAddOpen(true)} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]">+ Add device</button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Connected devices" value={String(devices.length)} />
        <Kpi label="Online" value={String(online)} accent="#0F6E56" />
        <Kpi label="Offline" value={String(offline)} accent={offline > 0 ? '#6B6F68' : undefined} />
        <Kpi label="Needs calibration" value={String(needsCal)} accent={needsCal > 0 ? '#854F0B' : undefined} />
        <Kpi label="Events today" value={String(eventsToday)} />
        <Kpi label="Battery alerts" value={String(batteryAlerts)} accent={batteryAlerts > 0 ? '#A32D2D' : undefined} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                {['Device', 'Type', 'Location', 'Status', 'Battery', 'Last sync', 'Current user', 'Current recipe'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} onClick={() => setOpenId(d.id)} className="cursor-pointer border-b border-[#F4F5F7] last:border-0 hover:bg-[#F5F9FE]">
                  <td className="px-3 py-3.5 font-semibold text-[#171A17]">{d.name}</td>
                  <td className="px-3 py-3.5 text-[#2C333B]">{d.type}</td>
                  <td className="px-3 py-3.5 text-[#2C333B]">{d.location}</td>
                  <td className="px-3 py-3.5"><DeviceStatusBadge status={d.status} /></td>
                  <td className="px-3 py-3.5"><BatteryPill level={d.battery} /></td>
                  <td className="of-num px-3 py-3.5 text-[13px] text-[#A0A49C]">{d.lastSync}</td>
                  <td className="px-3 py-3.5 text-[#2C333B]">{d.currentUser?.name ?? '—'}</td>
                  <td className="px-3 py-3.5 text-[#2C333B]">{d.currentRecipe?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Device detail */}
      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''} subtitle={open ? `${open.type} · ${open.location}` : undefined} right={open ? <DeviceStatusBadge status={open.status} /> : undefined} width={540}>
        {open ? <DeviceDetail d={open} onAction={(m) => show(m)} /> : null}
      </Drawer>

      {/* Add device wizard */}
      <AddDeviceWizard open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => show('Device connected')} />
    </div>
  );
}

function DeviceDetail({ d, onAction }: { d: Device; onAction: (m: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-[13px]">
        <Field label="Battery" value={d.battery != null ? `${d.battery}%` : '—'} />
        <Field label="Last sync" value={d.lastSync} />
        <Field label="Firmware" value={d.firmware} />
        <Field label="Calibration" value={d.calibration} />
        <Field label="Location" value={d.location} />
        <Field label="Events today" value={String(d.eventsToday)} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => onAction('Calibration started (demo)')} className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">Calibrate</button>
        <button type="button" onClick={() => onAction('Sync requested (demo)')} className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">Sync now</button>
      </div>

      {/* Current user */}
      <Section title="Current user">
        {d.currentUser ? (
          <div className="rounded-[14px] border border-[#EEF1F5] bg-white px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[#171A17]">{d.currentUser.name}</span>
              <Link href={MODULE_META.shiftboard.route} className="text-[11px] font-semibold" style={{ color: MODULE_META.shiftboard.accent.fg }}>ShiftBoard →</Link>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-[#8A8E86]">
              <span>{d.currentUser.role}</span>
              <span>Started {d.currentUser.startedAt}</span>
              <span>{d.currentUser.shift} shift</span>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[#8A8E86]">No operator assigned right now.</p>
        )}
      </Section>

      {/* Current recipe */}
      <Section title="Current recipe">
        {d.currentRecipe ? (
          <div className="rounded-[14px] border border-[#EEF1F5] bg-white px-4 py-3.5">
            <div className="text-[14px] font-semibold text-[#171A17]">{d.currentRecipe.name}</div>
            <div className="mt-2.5 text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">Expected ingredients</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {d.currentRecipe.expected.map((ing) => (<span key={ing} className="rounded-full border border-[#EAEDF2] bg-white px-2.5 py-1 text-[12px] text-[#6B6F68]">{ing}</span>))}
            </div>
            {d.currentRecipe.currentWaste ? (
              <div className="mt-3 flex items-center justify-between rounded-[10px] bg-[#FCEBEB] px-3 py-2 text-[13px]">
                <span className="text-[#A32D2D]">Current waste · {d.currentRecipe.currentWaste.item}</span>
                <span className="of-num font-semibold text-[#A32D2D]">{d.currentRecipe.currentWaste.qty}</span>
              </div>
            ) : null}
            <p className="mt-2.5 text-[11px] text-[#A0A49C]">Recipe & expected quantities will come from ProcurePulse.</p>
          </div>
        ) : (
          <p className="text-[13px] text-[#8A8E86]">No recipe in progress.</p>
        )}
      </Section>

      {/* Live measurements */}
      <Section title="Live measurements">
        {d.measurements.length === 0 ? (
          <p className="text-[13px] text-[#8A8E86]">No recent measurements.</p>
        ) : (
          <div className="flex flex-col">
            {d.measurements.map((m, i) => (
              <div key={i} className={`flex items-center justify-between py-2.5 text-[14px] ${i > 0 ? 'border-t border-[#F4F5F7]' : ''}`}>
                <span className="of-num text-[13px] text-[#A0A49C]">{m.time}</span>
                <span className="flex-1 px-3 text-[#2C333B]">{m.item}</span>
                <span className="of-num font-semibold text-[#171A17]">{m.qty} {m.unit}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* History */}
      <Section title="Device history">
        <div className="flex flex-col gap-3">
          {d.history.map((h, i) => (
            <div key={i} className="flex gap-3 text-[14px]">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: historyColor(h.kind) }} />
              <div className="min-w-0">
                <div className="text-[#2C333B]">{h.label}</div>
                <div className="of-num mt-0.5 text-[12px] text-[#A0A49C]">{h.time}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function historyColor(kind: DeviceHistoryEvent['kind']) {
  return kind === 'disconnected' ? '#A32D2D' : kind === 'calibration' ? '#854F0B' : kind === 'connected' ? '#0F6E56' : '#3E7BC4';
}

function AddDeviceWizard({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { org } = usePlatform();
  const router = useRouter();
  const [type, setType] = useState<string>(DEVICE_TYPES[0]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = 'h-11 w-full rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]';

  const canSave = !!org && name.trim().length > 0 && location.trim().length > 0 && !saving;

  async function connect() {
    if (!org || !canSave) return;
    const supabase = createClient();
    if (!supabase) { setError('Not connected.'); return; }
    setSaving(true);
    setError(null);
    const { error: insErr } = await supabase.from('ww_devices').insert({
      org_id: org.id,
      name: name.trim(),
      type,
      location: location.trim(),
      status: 'online',
      last_sync: 'Just now',
      calibration: 'Pending first calibration',
      events_today: 0,
      history: [{ kind: 'connected', label: 'Device added', time: 'Just now' }],
    });
    if (insErr) {
      setSaving(false);
      setError(insErr.message);
      return;
    }
    router.refresh();
    setName('');
    setLocation('');
    onClose();
    onSaved();
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add device"
      subtitle="Connect a measuring device"
      width={460}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-[#A32D2D]">{error ?? ''}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">Cancel</button>
            <button type="button" disabled={!canSave} onClick={connect} className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-40">{saving ? 'Connecting…' : 'Connect device'}</button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-[#171A17]">Device type</div>
          <div className="grid grid-cols-2 gap-2">
            {DEVICE_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className={`rounded-[12px] border px-3.5 py-2.5 text-left text-[13px] font-medium transition-all ${type === t ? 'border-[#3E7BC4] bg-[#EAF2FC] text-[#174C87]' : 'border-[#E2E6EC] bg-white text-[#6B6F68] hover:border-[#C9DEF7] hover:bg-[#F5F9FE]'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[#171A17]">Device name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="e.g. Bench Scale 2" />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[#171A17]">Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={input} placeholder="e.g. Cold prep" />
        </div>
        <p className="rounded-[12px] border border-[#EAF2FC] bg-[#F5F9FE] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#6B6F68]">More connectors (IoT sensors, barcode &amp; camera stations) plug in here as we add them.</p>
      </div>
    </Drawer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">{label}</div>
      <div className="of-num mt-1 text-[14px] font-semibold text-[#171A17]">{value}</div>
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
