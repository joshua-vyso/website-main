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
  const sel = 'h-11 rounded-[12px] border border-[#E4E9F0] bg-white px-3.5 text-[14px] text-[#3E4A57] outline-none focus:border-[#3E7BC4]';

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">People</h1>
          <p className="mt-1.5 text-[14px] text-[#8A8E86]">Profiles, skills, availability and device history</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={dept} onChange={(e) => setDept(e.target.value)} className={sel}><option value="all">All departments</option>{sb.departments.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}</select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" className="h-11 min-w-[180px] rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                {['Name', 'Department', 'Status', 'Next shift', 'Hours / wk', 'Attendance', 'Device', ''].map((h) => (
                  <th key={h} className={`px-3 py-2.5 font-medium ${h === 'Hours / wk' || h === 'Attendance' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} onClick={() => setOpenId(e.id)} className="cursor-pointer border-b border-[#F5F9FE] last:border-0 hover:bg-[#F5F9FE]">
                  <td className="px-3 py-3"><span className="font-semibold text-[#171A17]">{e.name}</span><span className="ml-1.5 text-[12px] text-[#A0A49C]">{e.role}</span></td>
                  <td className="px-3 py-3"><DeptBadge department={e.department} /></td>
                  <td className="px-3 py-3"><StatusBadge status={e.status} /></td>
                  <td className="of-num px-3 py-3 text-[#6B6F68]">{e.nextShift}</td>
                  <td className="of-num px-3 py-3 text-right text-[#6B6F68]">{e.hoursThisWeek}</td>
                  <td className="of-num px-3 py-3 text-right font-semibold" style={{ color: scoreColor(e.attendanceScore) }}>{e.attendanceScore}</td>
                  <td className="px-3 py-3">{e.assignedDevice ? <span className="inline-flex items-center rounded-full bg-[#E6F1FB] px-2.5 py-1 text-[11px] font-medium text-[#0C447C]">{e.assignedDevice}</span> : <span className="text-[12px] text-[#A0A49C]">—</span>}</td>
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
            <div key={skill} className="flex items-center justify-between rounded-[10px] bg-[#F5F9FE] px-3 py-2">
              <span className="text-[13px] text-[#6B6F68]">{skill}</span>
              <SkillStars rating={e.skills[i] ?? 0} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Availability">
        <div className="space-y-2 text-[13px]">
          <div className="flex flex-wrap items-center gap-1.5"><span className="w-20 text-[#8A8E86]">Available</span>{e.availableDays.map((d) => <span key={d} className="rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[12px] text-[#0F6E56]">{d}</span>)}</div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="w-20 text-[#8A8E86]">Unavailable</span>{e.unavailableDays.length ? e.unavailableDays.map((d) => <span key={d} className="rounded-full bg-[#EEF1F5] px-2 py-0.5 text-[12px] text-[#8A8E86]">{d}</span>) : <span className="text-[12px] text-[#8A8E86]">—</span>}</div>
          <div className="flex items-center gap-1.5"><span className="w-20 text-[#A0A49C]">Prefers</span><span className="text-[#171A17]">{e.preferredShifts}</span></div>
        </div>
      </Section>

      <Section title="Assigned devices — WasteWatch">
        {e.devices.length ? (
          <div className="flex flex-wrap gap-1.5">{e.devices.map((d) => <span key={d} className="rounded-full bg-[#E6F1FB] px-2.5 py-0.5 text-[12px] font-medium text-[#2C5E8A]">{d}</span>)}{e.assignedDevice ? <span className="rounded-full bg-[#E1F5EE] px-2.5 py-0.5 text-[12px] font-medium text-[#0F6E56]">In use · {e.assignedDevice}</span> : null}</div>
        ) : (
          <p className="text-[13px] text-[#8A8E86]">No device assignments yet.</p>
        )}
      </Section>

      <Section title="Documents">
        <div className="flex flex-col gap-1.5">
          {DOCS.map((d) => (
            <div key={d} className="flex items-center justify-between rounded-[10px] border border-[#EEF1F5] px-3 py-2.5 text-[13px]">
              <span className="text-[#171A17]">{d}</span>
              <button type="button" onClick={() => onAction('Documents coming soon (demo)')} className="text-[12px] font-semibold text-[#1F5FA8] hover:underline">Upload</button>
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
                <div className="text-[#171A17]">{a.label}</div>
                <div className="of-num text-[11px] text-[#A0A49C]">{a.time}</div>
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
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">{label}</div>
      <div className="mt-1 text-[14px] font-semibold" style={{ color: color ?? '#171A17' }}>{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="of-display mb-2 text-[14px] font-semibold text-[#171A17]">{title}</h3>
      {children}
    </div>
  );
}
