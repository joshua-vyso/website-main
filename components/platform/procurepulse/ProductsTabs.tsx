'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from './ui';
import { ProductsManager } from './ProductsManager';
import { ProductMatching } from './ProductMatching';
import { ProductThresholds } from './ProductThresholds';
import { ProductUnits } from './ProductUnits';
import type { ProductUnit, StockItem, StockThreshold } from '@/lib/platform/types';
import type { MatchCandidate } from '@/lib/platform/procurepulse/matching';

type Tab = 'live' | 'thresholds' | 'units';

const TABS: { key: Tab; label: string }[] = [
  { key: 'live', label: 'Live Stock' },
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
  const [tab, setTab] = useState<Tab>('live');

  return (
    <div>
      <PageHead
        title="Products"
        subtitle="Your stock catalogue — live values, thresholds and units"
        right={
          <Link
            href="/app/orderflow/orders"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7DAD8] bg-white px-3.5 py-2.5 text-[14px] font-medium text-[#5F6368] transition-colors hover:border-[#1E5E54]/30"
          >
            Create order in OrderFlow
            <span aria-hidden>→</span>
          </Link>
        }
      />

      <div className="mt-5 inline-flex rounded-lg bg-[#ECECE8] p-[3px]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? 'rounded-md bg-white px-4 py-1.5 text-[13px] font-medium text-[#1A1C1E] shadow-sm'
                : 'px-4 py-1.5 text-[13px] font-medium text-[#5F6368]'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'live' ? (
          <>
            <ProductsManager items={items} units={units} embedded />
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
