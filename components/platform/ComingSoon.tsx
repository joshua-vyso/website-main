import { MODULE_BY_KEY } from '@/lib/platform/modules';
import type { FeatureKey } from '@/lib/platform/types';

/**
 * Placeholder shown for modules that exist in the registry but aren't yet
 * switched on for the workspace. Server component (no client interactivity).
 */
export function ComingSoon({ moduleKey }: { moduleKey: FeatureKey }) {
  const mod = MODULE_BY_KEY[moduleKey];

  return (
    <div className="px-8 py-7">
      <div className="mx-auto mt-24 max-w-md rounded-2xl border border-[#EAEDF2] bg-white p-8 text-center">
        <span className="inline-flex items-center rounded-full bg-[#ECECEA] px-3 py-1 text-[12px] font-medium text-[#6B6F68]">
          Coming soon
        </span>
        <h1 className="mt-4 text-2xl font-bold text-[#171A17]">{mod.label}</h1>
        <p className="mt-2 text-[14px] text-[#6B6F68]">{mod.description}</p>
        <p className="mt-4 text-[14px] text-[#6B6F68]">
          This module isn&apos;t switched on for your workspace yet.
        </p>
      </div>
    </div>
  );
}
