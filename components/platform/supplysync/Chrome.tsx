'use client';

import type { ReactNode } from 'react';
import { ModuleHeader, PrimaryAction } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { SubNav } from '@/components/platform/SubNav';
import { useSupplySync } from './context';
import { SupplierProfileDrawer } from './SupplierProfileDrawer';
import { CompareDrawer, CompareBar } from './CompareDrawer';
import { AddSupplierWizard } from './AddSupplierWizard';

const M = MODULE_META.supplysync;

const TABS = [
  { label: 'Overview', href: '/app/suppliers' },
  { label: 'Suppliers', href: '/app/suppliers/list' },
  { label: 'Performance', href: '/app/suppliers/performance' },
  { label: 'Pricing Intelligence', href: '/app/suppliers/pricing' },
  { label: 'Risk & Compliance', href: '/app/suppliers/risk' },
  { label: 'Relationship History', href: '/app/suppliers/history' },
];

/**
 * SupplySync chrome: module header + underline sub-nav shared across every tab,
 * plus the cross-tab overlays (supplier profile, compare, add-supplier wizard)
 * that any tab can open via the SupplySync context.
 */
export function SupplySyncChrome({ children }: { children: ReactNode }) {
  const ss = useSupplySync();

  return (
    <>
      <ModuleHeader
        icon={M.icon}
        title={M.name}
        description={M.description}
        actions={<PrimaryAction onClick={ss.openAdd}>+ Add supplier</PrimaryAction>}
      />
      <div className="mt-5">
        <SubNav tabs={TABS} rootHref="/app/suppliers" />
      </div>
      <div className="mt-6">{children}</div>

      {/* Cross-tab overlays */}
      <SupplierProfileDrawer />
      <CompareDrawer />
      <CompareBar />
      <AddSupplierWizard />
    </>
  );
}
