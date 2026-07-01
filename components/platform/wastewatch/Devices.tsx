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
          <h1 className="text-[24px] font-bold leading-tight text-[#1A1C1E]">Devices</h1>
          <p className="mt-0.5 text-[14px] text-[#5F6368]">Connected scales and sensors that measure waste automatically</p>
        </div>
        <button type="button" onClick={() => setAddOpen(true)} className="inline-flex h-10 items-center rounded-xl bg-[#1E5E54] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#184D45]">+ Add device</button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Connected devices" value={String(devices.length)} />
        <Kpi label="Online" value={String(online)} accent="#0F6E56" />
        <Kpi label="Offline" value={String(offline)} accent={offline > 0 ? '#5F6368' : undefined} />
        <Kpi label="Needs calibration" value={String(needsCal)} accent={needsCal > 0 ? '#854F0B' : undefined} />
        <Kpi label="Events today" value={String(eventsToday)} />
        <Kpi label="Battery alerts" value={String(batteryAlerts)} accent={batteryAlerts > 0 ? '#A32D2D' : undefined} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                {['Device', 'Type', 'Location', 'Status', 'Battery', 'Last sync', 'Current user', 'Current recipe'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} onClick={() => setOpenId(d.id)} className="cursor-pointer border-b border-[#F6F6F2] last:border-0 hover:bg-[#FAFAF8]">
                  <td className="px-3 py-3 font-medium text-[#1A1C1E]">{d.name}</td>
                  <td className="px-3 py-3 text-[#5F6368]">{d.type}</td>
                  <td className="px-3 py-3 text-[#5F6368]">{d.location}</td>
                  <td className="px-3 py-3"><DeviceStatusBadge status={d.status} /></td>
                  <td className="px-3 py-3"><BatteryPill level={d.battery} /></td>
                  <td className="px-3 py-3 text-[#9A9DA1]">{d.lastSync}</td>
                  <td className="px-3 py-3 text-[#5F6368]">{d.currentUser?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-[#5F6368]">{d.currentRecipe?.name ?? '—'}</td>
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
        <button type="button" onClick={() => onAction('Calibration started (demo)')} className="rounded-lg border border-[#D7DAD8] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1C1E] hover:border-[#1E5E54]/40">Calibrate</button>
        <button type="button" onClick={() => onAction('Sync requested (demo)')} className="rounded-lg border border-[#D7DAD8] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1C1E] hover:border-[#1E5E54]/40">Sync now</button>
      </div>

      {/* Current user */}
      <Section title="Current user">
        {d.currentUser ? (
          <div className="rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-[#1A1C1E]">{d.currentUser.name}</span>
              <Link href={MODULE_META.shiftboard.route} className="text-[11px] font-medium" style={{ color: MODULE_META.shiftboard.accent.fg }}>ShiftBoard →</Link>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-[#5F6368]">
              <span>{d.currentUser.role}</span>
              <span>Started {d.currentUser.startedAt}</span>
              <span>{d.currentUser.shift} shift</span>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[#9A9DA1]">No operator assigned right now.</p>
        )}
      </Section>

      {/* Current recipe */}
      <Section title="Current recipe">
        {d.currentRecipe ? (
          <div className="rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] px-4 py-3">
            <div className="text-[14px] font-medium text-[#1A1C1E]">{d.currentRecipe.name}</div>
            <div className="mt-2 text-[11px] uppercase tracking-wide text-[#9A9DA1]">Expected ingredients</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {d.currentRecipe.expected.map((ing) => (<span key={ing} className="rounded-full border border-[#E7E7E2] bg-white px-2.5 py-0.5 text-[12px] text-[#5F6368]">{ing}</span>))}
            </div>
            {d.currentRecipe.currentWaste ? (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-[#FCEBEB] px-3 py-2 text-[13px]">
                <span className="text-[#A32D2D]">Current waste · {d.currentRecipe.currentWaste.item}</span>
                <span className="font-semibold text-[#A32D2D]">{d.currentRecipe.currentWaste.qty}</span>
              </div>
            ) : null}
            <p className="mt-2 text-[11px] text-[#9A9DA1]">Recipe & expected quantities will come from ProcurePulse.</p>
          </div>
        ) : (
          <p className="text-[13px] text-[#9A9DA1]">No recipe in progress.</p>
        )}
      </Section>

      {/* Live measurements */}
      <Section title="Live measurements">
        {d.measurements.length === 0 ? (
          <p className="text-[13px] text-[#9A9DA1]">No recent measurements.</p>
        ) : (
          <div className="flex flex-col">
            {d.measurements.map((m, i) => (
              <div key={i} className={`flex items-center justify-between py-2 text-[13px] ${i > 0 ? 'border-t border-[#F0F0EC]' : ''}`}>
                <span className="text-[#9A9DA1] tabular-nums">{m.time}</span>
                <span className="flex-1 px-3 text-[#1A1C1E]">{m.item}</span>
                <span className="font-medium tabular-nums text-[#1A1C1E]">{m.qty} {m.unit}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* History */}
      <Section title="Device history">
        <div className="flex flex-col gap-3">
          {d.history.map((h, i) => (
            <div key={i} className="flex gap-3 text-[13px]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: historyColor(h.kind) }} />
              <div className="min-w-0">
                <div className="text-[#1A1C1E]">{h.label}</div>
                <div className="text-[11px] text-[#9A9DA1]">{h.time}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function historyColor(kind: DeviceHistoryEvent['kind']) {
  return kind === 'disconnected' ? '#A32D2D' : kind === 'calibration' ? '#854F0B' : kind === 'connected' ? '#0F6E56' : '#1E5E54';
}

function AddDeviceWizard({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { org } = usePlatform();
  const router = useRouter();
  const [type, setType] = useState<string>(DEVICE_TYPES[0]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = 'h-10 w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-[14px] text-[#1A1C1E] placeholder:text-[#9A9DA1] focus:border-[#1E5E54]/40 focus:outline-none';

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
            <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] text-[#5F6368] hover:bg-black/[0.03]">Cancel</button>
            <button type="button" disabled={!canSave} onClick={connect} className="rounded-lg bg-[#1E5E54] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#184D45] disabled:cursor-not-allowed disabled:opacity-40">{saving ? 'Connecting…' : 'Connect device'}</button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-[#1A1C1E]">Device type</div>
          <div className="grid grid-cols-2 gap-2">
            {DEVICE_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className={`rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors ${type === t ? 'border-[#1E5E54] bg-[#F6FAF8] text-[#1A1C1E]' : 'border-[#E7E7E2] bg-white text-[#5F6368] hover:border-[#1E5E54]/40'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[#1A1C1E]">Device name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="e.g. Bench Scale 2" />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[#1A1C1E]">Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={input} placeholder="e.g. Cold prep" />
        </div>
        <p className="rounded-lg bg-[#F6FAF8] px-3 py-2 text-[12px] text-[#5F6368]">More connectors (IoT sensors, barcode &amp; camera stations) plug in here as we add them.</p>
      </div>
    </Drawer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">{label}</div>
      <div className="mt-1 text-[14px] font-medium text-[#1A1C1E]">{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-semibold text-[#1A1C1E]">{title}</h3>
      {children}
    </div>
  );
}
