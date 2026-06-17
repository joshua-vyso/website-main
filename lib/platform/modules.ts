/**
 * The MODULES registry — the single source of truth that drives BOTH the
 * desktop sidebar nav and the mobile Modules switcher. Mirrored into each app's
 * lib folder. A module is reachable only when `status === 'active'` AND the org
 * has the feature enabled; everything else renders a "Coming soon" state.
 */
import type { AppIconKey, FeatureKey, ModuleStatus } from './types';

export interface ModuleDefinition {
  key: FeatureKey;
  label: string;
  description: string;
  /** Maps to an AppIcon master (`/assets/icons/{icon}.svg`). */
  icon: AppIconKey;
  status: ModuleStatus;
  /** Platform-specific entry points. */
  screens: {
    /** expo-router href under the `(platform)` group. */
    mobile: string;
    /** Next.js route. */
    desktop: string;
  };
}

export const MODULES: readonly ModuleDefinition[] = [
  {
    key: 'docu',
    label: 'Doc-U',
    description: 'Document ingestion & extraction',
    icon: 'docu',
    status: 'active',
    screens: { mobile: '/docu/hub', desktop: '/app/docu' },
  },
  {
    key: 'procurepulse',
    label: 'ProcurePulse',
    description: 'Purchase orders & supplier pricing',
    icon: 'proc',
    status: 'soon',
    screens: { mobile: '/procurepulse', desktop: '/app/procurepulse' },
  },
  {
    key: 'marginview',
    label: 'MarginView',
    description: 'Margins & profitability',
    icon: 'margin',
    status: 'soon',
    screens: { mobile: '/marginview', desktop: '/app/marginview' },
  },
  {
    key: 'wastelog',
    label: 'WasteLog',
    description: 'Track shrink & wastage',
    icon: 'waste',
    status: 'soon',
    screens: { mobile: '/wastelog', desktop: '/app/wastelog' },
  },
  {
    key: 'shiftboard',
    label: 'ShiftBoard',
    description: 'Staff shifts & rostering',
    icon: 'shift',
    status: 'soon',
    screens: { mobile: '/shiftboard', desktop: '/app/shiftboard' },
  },
  {
    key: 'suppliers',
    label: 'SupplierHub',
    description: 'Supplier directory, terms & contacts',
    icon: 'supplier',
    status: 'soon',
    screens: { mobile: '/suppliers', desktop: '/app/suppliers' },
  },
  {
    key: 'reportgen',
    label: 'ReportGen',
    description: 'Automated reports & exports',
    icon: 'dash',
    status: 'soon',
    screens: { mobile: '/reportgen', desktop: '/app/reportgen' },
  },
  {
    key: 'orderflow',
    label: 'OrderFlow',
    description: 'Order management & fulfilment',
    icon: 'dash',
    status: 'soon',
    screens: { mobile: '/orderflow', desktop: '/app/orderflow' },
  },
] as const;

export const MODULE_BY_KEY: Record<FeatureKey, ModuleDefinition> = Object.fromEntries(
  MODULES.map((m) => [m.key, m]),
) as Record<FeatureKey, ModuleDefinition>;

/** All feature keys, in registry order. */
export const FEATURE_KEYS: readonly FeatureKey[] = MODULES.map((m) => m.key);
