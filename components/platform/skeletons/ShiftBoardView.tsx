'use client';

import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, KpiStrip, Kpi, Badge, SectionCard, DataTable, ModuleWidgetCard } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { widgetsFor } from '@/lib/platform/module-widgets';

const M = MODULE_META.shiftboard;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STAFF = [
  { name: 'Thandi Mokoena', role: 'Manager', status: 'On shift', next: 'Today 14:00', hours: 38, shifts: ['08–16', '08–16', 'Off', '08–16', '08–16', '10–18', 'Off'] },
  { name: 'Sipho Dlamini', role: 'Chef', status: 'On shift', next: 'Today 16:00', hours: 42, shifts: ['10–18', '10–18', '10–18', 'Off', '10–18', '12–20', '12–20'] },
  { name: 'Aisha Patel', role: 'Server', status: 'Off', next: 'Tomorrow 11:00', hours: 28, shifts: ['Off', '11–17', '11–17', '11–17', 'Off', '11–19', 'Off'] },
  { name: 'Johan Botha', role: 'Driver', status: 'On leave', next: '2 Jul 06:00', hours: 0, shifts: ['Leave', 'Leave', 'Leave', '06–12', '06–12', 'Off', 'Off'] },
  { name: 'Lerato Khumalo', role: 'Server', status: 'On shift', next: 'Today 12:00', hours: 31, shifts: ['12–20', 'Off', '12–20', '12–20', '12–20', 'Off', '10–18'] },
];
const LEAVE = [
  { name: 'Johan Botha', type: 'Annual leave', dates: '30 Jun – 1 Jul', tone: 'warning' as const },
  { name: 'Aisha Patel', type: 'Sick leave', dates: '3 Jul', tone: 'warning' as const },
];

function shiftTone(s: string) {
  if (s === 'Off') return { bg: '#F0F0EC', fg: '#9A9DA1' };
  if (s === 'Leave') return { bg: '#FBEEDA', fg: '#854F0B' };
  return { bg: '#E3F0ED', fg: '#1E5E54' };
}

export function ShiftBoardView() {
  const { node: toastNode, show: toast } = useToast();

  return (
    <div>
      {toastNode}
      <ModuleHeader icon={M.icon} title={M.name} description={M.description} actions={<PrimaryAction onClick={() => toast('Create shift (demo)')}>+ Create shift</PrimaryAction>} />

      <div className="mt-6">
        <KpiStrip>
          <Kpi label="Staff on shift today" value="9" sub="of 12 scheduled" />
          <Kpi label="Open shifts" value="3" accent="#854F0B" sub="this week" />
          <Kpi label="Leave requests" value="2" accent="#854F0B" />
          <Kpi label="Labour hours this week" value="312" />
          <Kpi label="Attendance issues" value="1" accent="#A32D2D" />
        </KpiStrip>
      </div>

      <SectionCard title="Weekly roster" right={<span className="text-[12px] text-[#9A9DA1]">Week of 29 Jun</span>} className="mt-5">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                <th className="px-2 py-2 text-left font-medium">Staff</th>
                {DAYS.map((d) => (<th key={d} className="px-2 py-2 text-center font-medium">{d}</th>))}
              </tr>
            </thead>
            <tbody>
              {STAFF.map((s) => (
                <tr key={s.name} className="border-t border-[#F0F0EC]">
                  <td className="px-2 py-2.5 text-[13px] font-medium text-[#1A1C1E]">{s.name}</td>
                  {s.shifts.map((sh, i) => {
                    const t = shiftTone(sh);
                    return (
                      <td key={i} className="px-1.5 py-2 text-center">
                        <span className="inline-flex w-full justify-center rounded-md px-1.5 py-1 text-[11px] font-medium" style={{ backgroundColor: t.bg, color: t.fg }}>{sh}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        <SectionCard title="Staff">
          <DataTable
            columns={[{ label: 'Name' }, { label: 'Role' }, { label: 'Status' }, { label: 'Next shift' }, { label: 'Hours / wk', align: 'right' }]}
            rows={STAFF.map((s) => [
              s.name,
              s.role,
              <Badge key="s" label={s.status} tone={s.status === 'On shift' ? 'positive' : s.status === 'On leave' ? 'warning' : 'neutral'} />,
              s.next,
              String(s.hours),
            ])}
            empty="No staff yet."
          />
        </SectionCard>

        <SectionCard title="Leave requests" right={<button type="button" onClick={() => toast('Leave policy (demo)')} className="text-[12px] font-medium text-[#1E5E54] hover:underline">Policy</button>}>
          {LEAVE.length === 0 ? (
            <p className="text-[13px] text-[#9A9DA1]">No pending requests.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {LEAVE.map((l, i) => (
                <div key={i} className="rounded-xl border border-[#F0F0EC] bg-[#FCFCFB] px-3.5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[#1A1C1E]">{l.name}</span>
                    <Badge label={l.type} tone={l.tone} />
                  </div>
                  <div className="mt-0.5 text-[12px] text-[#9A9DA1]">{l.dates}</div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => toast('Leave approved (demo)')} className="rounded-lg bg-[#1E5E54] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#184D45]">Approve</button>
                    <button type="button" onClick={() => toast('Leave declined (demo)')} className="rounded-lg border border-[#D7DAD8] px-3 py-1.5 text-[12px] font-medium text-[#5F6368] hover:border-[#1E5E54]/40">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-5">
        <h2 className="mb-2 text-[13px] font-semibold text-[#9A9DA1]">Mobile snapshot — widgets the companion app will surface</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {widgetsFor('shiftboard').map((w) => (<ModuleWidgetCard key={w.id} widget={w} onAction={() => toast(`${w.actionLabel} (demo)`)} />))}
        </div>
      </div>
    </div>
  );
}
