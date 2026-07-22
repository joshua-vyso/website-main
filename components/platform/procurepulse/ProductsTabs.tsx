'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from './ui';
import { ProductsOverview } from './ProductsOverview';
import { ProductMatching } from './ProductMatching';
import { ProductThresholds } from './ProductThresholds';
import { ProductUnits } from './ProductUnits';
import type { ProductUnit, StockItem, StockThreshold } from '@/lib/platform/types';
import type { MatchCandidate } from '@/lib/platform/procurepulse/matching';

type Tab = 'overview' | 'thresholds' | 'units';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Products' },
  { key: 'thresholds', label: 'Thresholds' },
  { key: 'units', label: 'Units' },
];

export function ProductsTabs({
  items,
  units,
  candidates,
  aiEnabled,
  thresholds,
  productUnits,
}: {
  items: StockItem[];
  units: string[];
  candidates: MatchCandidate[];
  aiEnabled: boolean;
  thresholds: StockThreshold[];
  productUnits: ProductUnit[];
}) {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div>
      <PageHead
        title="Products"
        subtitle="Your stock catalogue — live values, thresholds and units"
        right={
          <Link
            href="/app/orderflow/orders"
            className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
          >
            Create order in OrderFlow
            <span aria-hidden>→</span>
          </Link>
        }
      />

      <div className="mt-5 inline-flex rounded-[11px] bg-[#ECECE8] p-[3px]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? 'rounded-[9px] bg-white px-4 py-1.5 text-[13px] font-semibold text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.06)]'
                : 'px-4 py-1.5 text-[13px] font-medium text-[#6B6F68] transition-colors hover:text-[#171A17]'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'overview' ? (
          <>
            <ProductsOverview items={items} thresholds={thresholds} />
            <div className="mt-8">
              <ProductMatching candidates={candidates} aiEnabled={aiEnabled} />
            </div>
          </>
        ) : tab === 'thresholds' ? (
          <ProductThresholds items={items} thresholds={thresholds} />
        ) : (
          <ProductUnits items={items} units={units} productUnits={productUnits} />
        )}
      </div>
    </div>
  );
}
