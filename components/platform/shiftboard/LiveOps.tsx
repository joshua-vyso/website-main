'use client';

import { useToast } from '@/components/platform/orderflow/ui';
import { SectionCard } from '@/components/platform/module-ui';
import { departmentSnapshots } from '@/lib/platform/shiftboard';
import { DeptBadge, StatusBadge, CoverageBadge } from './shared';
import { useShiftBoard } from './context';

const QUICK_ACTIONS = ['Assign staff', 'Reassign department', 'Mark on break', 'Mark absent', 'Add replacement'];

export function LiveOps() {
  const { node, show } = useToast();
  const sb = useShiftBoard();
  const snapshots = departmentSnapshots(sb.employees, sb.departments);
  const active = sb.employees.filter((e) => e.status === 'Working' || e.status === 'On break');

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[24px] font-bold leading-tight text-[#1A1C1E]">
            Live operations
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1F5EE] px-2 py-0.5 text-[11px] font-medium text-[#0F6E56]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0F6E56]" />Live</span>
          </h1>
          <p className="mt-0.5 text-[14px] text-[#5F6368]">Who's working right now, where they are, and what they're doing</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((a) => (
          <button key={a} type="button" onClick={() => show(`${a} (demo)`)} className="rounded-lg border border-[#D7DAD8] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1A1C1E] transition-colors hover:border-[#1E5E54]/40">{a}</button>
        ))}
      </div>

      {/* Live department map */}
      <div>
        <h2 className="mb-2 text-[15px] font-semibold text-[#1A1C1E]">Live department map</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {snapshots.map((d) => (
            <div key={d.name} className="rounded-2xl border border-[#E7E7E2] bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-[#1A1C1E]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />{d.name}</span>
                <CoverageBadge status={d.status} />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-[20px] font-bold leading-none text-[#1A1C1E]">{d.working}</span>
                <span className="text-[13px] text-[#9A9DA1]">/ {d.required} staffed</span>
                {d.status === 'short' ? <span className="ml-1 text-[12px] font-medium text-[#A32D2D]">Short by {d.required - d.working}</span> : null}
                {d.status === 'overstaffed' ? <span className="ml-1 text-[12px] font-medium text-[#0C447C]">+{d.working - d.required}</span> : null}
              </div>
              <div className="mt-3 flex flex-col gap-1.5 border-t border-[#F0F0EC] pt-3">
                {d.staff.length === 0 ? (
                  <span className="text-[12px] text-[#9A9DA1]">No one currently in this department.</span>
                ) : (
                  d.staff.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="min-w-0 truncate text-[#1A1C1E]">{e.name}</span>
                      <span className="shrink-0 text-[12px] text-[#9A9DA1]">{e.currentTask}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active staff feed */}
      <SectionCard title="Active staff feed" right={<span className="text-[12px] text-[#9A9DA1]">{active.length} on shift now</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#F0F0EC] bg-[#FBFBF9] text-[11px] uppercase tracking-wide text-[#9A9DA1]">
                {['Employee', 'Department', 'Current task', 'Shift', 'Status', 'Device'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map((e) => (
                <tr key={e.id} className="border-b border-[#F6F6F2] last:border-0">
                  <td className="px-2 py-2.5 font-medium text-[#1A1C1E]">{e.name}</td>
                  <td className="px-2 py-2.5"><DeptBadge department={e.currentDepartment ?? e.department} /></td>
                  <td className="px-2 py-2.5 text-[#5F6368]">{e.currentTask ?? '—'}{e.currentRecipe ? <span className="ml-1 text-[12px] text-[#9A9DA1]">· {e.currentRecipe}</span> : null}</td>
                  <td className="px-2 py-2.5 tabular-nums text-[#5F6368]">{e.shiftTime}</td>
                  <td className="px-2 py-2.5"><StatusBadge status={e.status} /></td>
                  <td className="px-2 py-2.5">
                    {e.assignedDevice ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F1FB] px-2 py-0.5 text-[11px] font-medium text-[#2C5E8A]">{e.assignedDevice}</span>
                    ) : (
                      <span className="text-[12px] text-[#9A9DA1]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-[#9A9DA1]">Device column links each person to the WasteWatch scale/station they&rsquo;re using — the foundation for automatic waste capture per operator.</p>
      </SectionCard>
    </div>
  );
}
