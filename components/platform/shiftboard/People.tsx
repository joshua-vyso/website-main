'use client';

import { useMemo, useState } from 'react';
import { useToast, Drawer, RowActionsMenu } from '@/components/platform/orderflow/ui';
import { SKILL_NAMES, type Employee, type ActivityEvent } from '@/lib/platform/shiftboard';
import { DeptBadge, StatusBadge, SkillStars } from './shared';
import { useShiftBoard } from './context';

function scoreColor(score: number) {
  return score >= 90 ? '#0F6E56' : score >= 80 ? '#854F0B' : '#A32D2D';
}

function activityFor(e: Employee): ActivityEvent[] {
  const start = e.shiftTime.split('–')[0] || '08:00';
  const events: ActivityEvent[] = [];
  if (e.status === 'On leave') return [{ time: '—', label: 'On approved leave', kind: 'clock' }];
  if (e.status === 'Absent') return [{ time: e.shiftTime.split('–')[0] || '06:00', label: 'No clock-in recorded — marked absent', kind: 'clock' }];
  events.push({ time: start, label: 'Clocked in', kind: 'clock' });
  events.push({ time: start, label: `Assigned to ${e.currentDepartment ?? e.department}`, kind: 'assign' });
  if (e.currentRecipe) events.push({ time: addMin(start, 12), label: `Started recipe — ${e.currentRecipe}`, kind: 'recipe' });
  if (e.assignedDevice) events.push({ time: addMin(start, 14), label: `Using ${e.assignedDevice}`, kind: 'device' });
  if (e.currentTask) events.push({ time: addMin(start, 20), label: e.currentTask, kind: 'task' });
  if (e.status === 'On break') events.push({ time: addMin(start, 180), label: 'Took a break', kind: 'break' });
  return events.reverse();
}

function addMin(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h * 60 + m + mins) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function People() {
  const { node, show } = useToast();
  const sb = useShiftBoard();
  const [openId, setOpenId] = useState<string | null>(null);
  const [dept, setDept] = useState<string>('all');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sb.employees.filter((e) => (dept === 'all' || e.department === dept) && (!q || `${e.name} ${e.role}`.toLowerCase().includes(q)));
  }, [sb.employees, dept, search]);

  const open = openId ? sb.employees.find((e) => e.id === openId) ?? null : null;
  const sel = 'h-9 rounded-lg border border-[#D7DAD8] bg-white px-2.5 text-[13px] text-[#5F6368] outline-none focus:border-[#3E7BC4]';

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold leading-tight text-[#1A1C1E]">People</h1>
          <p className="mt-0.5 text-[14px] text-[#5F6368]">Profiles, skills, availability and device history</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={dept} onChange={(e) => setDept(e.target.value)} className={sel}><option value="all">All departments</option>{sb.departments.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}</select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" className="h-9 min-w-[180px] rounded-lg border border-[#D7DAD8] bg-white px-3 text-[13px] text-[#1A1C1E] outline-none placeholder:text-[#9A9DA1] focus:border-[#3E7BC4]" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E7E7E2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                {['Name', 'Department', 'Status', 'Next shift', 'Hours / wk', 'Attendance', 'Device', ''].map((h) => (
                  <th key={h} className={`px-3 py-2.5 font-medium ${h === 'Hours / wk' || h === 'Attendance' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} onClick={() => setOpenId(e.id)} className="cursor-pointer border-b border-[#F6F6F2] last:border-0 hover:bg-[#FAFAF8]">
                  <td className="px-3 py-3"><span className="font-medium text-[#1A1C1E]">{e.name}</span><span className="ml-1.5 text-[12px] text-[#9A9DA1]">{e.role}</span></td>
                  <td className="px-3 py-3"><DeptBadge department={e.department} /></td>
                  <td className="px-3 py-3"><StatusBadge status={e.status} /></td>
                  <td className="px-3 py-3 text-[#5F6368]">{e.nextShift}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-[#5F6368]">{e.hoursThisWeek}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium" style={{ color: scoreColor(e.attendanceScore) }}>{e.attendanceScore}</td>
                  <td className="px-3 py-3">{e.assignedDevice ? <span className="rounded-full bg-[#E6F1FB] px-2 py-0.5 text-[11px] font-medium text-[#2C5E8A]">{e.assignedDevice}</span> : <span className="text-[12px] text-[#9A9DA1]">—</span>}</td>
                  <td className="px-3 py-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <RowActionsMenu actions={[
                      { label: 'View profile', onClick: () => setOpenId(e.id) },
                      { label: 'Assign device', onClick: () => show('Assign device (demo)') },
                      { label: 'Edit availability', onClick: () => show('Edit availability (demo)') },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''} subtitle={open ? `${open.role} · ${open.department}` : undefined} right={open ? <StatusBadge status={open.status} /> : undefined} width={560}>
        {open ? <EmployeeDetail e={open} onAction={show} /> : null}
      </Drawer>
    </div>
  );
}

const DOCS = ['Employment contract', 'ID copy', 'Training certificate', 'Health & safety docs'];

function EmployeeDetail({ e, onAction }: { e: Employee; onAction: (m: string) => void }) {
  return (
    <div className="space-y-5">
      <Section title="Overview">
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <Field label="Role" value={e.role} />
          <Field label="Department" value={e.department} />
          <Field label="Current status" value={e.status} />
          <Field label="Current shift" value={e.shiftTime} />
          <Field label="Hours this week" value={`${e.hoursThisWeek} / ${e.contractedHours}`} color={e.hoursThisWeek > e.contractedHours ? '#854F0B' : undefined} />
          <Field label="Attendance score" value={`${e.attendanceScore}%`} color={scoreColor(e.attendanceScore)} />
          <Field label="Leave balance" value={`${e.leaveBalance} days`} />
          <Field label="Hourly rate" value={`R ${e.rate}`} />
        </div>
      </Section>

      <Section title="Skills matrix">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SKILL_NAMES.map((skill, i) => (
            <div key={skill} className="flex items-center justify-between rounded-lg bg-[#FAFAF8] px-3 py-1.5">
              <span className="text-[13px] text-[#5F6368]">{skill}</span>
              <SkillStars rating={e.skills[i] ?? 0} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Availability">
        <div className="space-y-2 text-[13px]">
          <div className="flex flex-wrap items-center gap-1.5"><span className="w-20 text-[#9A9DA1]">Available</span>{e.availableDays.map((d) => <span key={d} className="rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[12px] text-[#0F6E56]">{d}</span>)}</div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="w-20 text-[#9A9DA1]">Unavailable</span>{e.unavailableDays.length ? e.unavailableDays.map((d) => <span key={d} className="rounded-full bg-[#F0F0EC] px-2 py-0.5 text-[12px] text-[#9A9DA1]">{d}</span>) : <span className="text-[12px] text-[#9A9DA1]">—</span>}</div>
          <div className="flex items-center gap-1.5"><span className="w-20 text-[#9A9DA1]">Prefers</span><span className="text-[#1A1C1E]">{e.preferredShifts}</span></div>
        </div>
      </Section>

      <Section title="Assigned devices — WasteWatch">
        {e.devices.length ? (
          <div className="flex flex-wrap gap-1.5">{e.devices.map((d) => <span key={d} className="rounded-full bg-[#E6F1FB] px-2.5 py-0.5 text-[12px] font-medium text-[#2C5E8A]">{d}</span>)}{e.assignedDevice ? <span className="rounded-full bg-[#E1F5EE] px-2.5 py-0.5 text-[12px] font-medium text-[#0F6E56]">In use · {e.assignedDevice}</span> : null}</div>
        ) : (
          <p className="text-[13px] text-[#9A9DA1]">No device assignments yet.</p>
        )}
      </Section>

      <Section title="Documents">
        <div className="flex flex-col gap-1.5">
          {DOCS.map((d) => (
            <div key={d} className="flex items-center justify-between rounded-lg border border-[#F0F0EC] px-3 py-2 text-[13px]">
              <span className="text-[#1A1C1E]">{d}</span>
              <button type="button" onClick={() => onAction('Documents coming soon (demo)')} className="text-[12px] font-medium text-[#1F5FA8] hover:underline">Upload</button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Activity timeline">
        <div className="flex flex-col gap-3">
          {activityFor(e).map((a, i) => (
            <div key={i} className="flex gap-3 text-[13px]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F5FA8]" />
              <div className="min-w-0">
                <div className="text-[#1A1C1E]">{a.label}</div>
                <div className="text-[11px] text-[#9A9DA1]">{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#9A9DA1]">{label}</div>
      <div className="mt-1 text-[14px] font-medium" style={{ color: color ?? '#1A1C1E' }}>{value}</div>
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
