/**
 * Central Vyso module metadata — one source of truth describing every module's
 * identity, route, accent and role. The desktop registry (`modules.ts`) still
 * drives the sidebar/feature flags; this richer metadata is what the future
 * MOBILE COMPANION will read to generate home widgets, upload destinations,
 * module shortcuts and AI context. Friendly `VysoModuleKey`s map to the internal
 * `FeatureKey`s used by the existing system.
 */

import { MODULE_BY_KEY } from './modules';
import type { AppIconKey, FeatureKey } from './types';

export type VysoModuleKey =
  | 'docu'
  | 'procurepulse'
  | 'pricepilot'
  | 'planwise'
  | 'wastewatch'
  | 'shiftboard'
  | 'supplysync'
  | 'insightgen'
  | 'orderflow';

export type MobileCompanionRole = 'snapshot' | 'capture' | 'approval' | 'action' | 'analysis';

export interface VysoModuleMeta {
  key: VysoModuleKey;
  /** Internal registry / feature-flag key. */
  featureKey: FeatureKey;
  name: string;
  description: string;
  route: string;
  icon: AppIconKey;
  accent: { bg: string; fg: string };
  /** What the module is for on the desktop "brain". */
  desktopRole: string;
  /** How the module is expected to surface on the mobile companion. */
  mobileCompanionRole: MobileCompanionRole;
}

const FEATURE: Record<VysoModuleKey, FeatureKey> = {
  docu: 'docu',
  procurepulse: 'procurepulse',
  pricepilot: 'pricepilot',
  planwise: 'marginview',
  wastewatch: 'wastelog',
  shiftboard: 'shiftboard',
  supplysync: 'suppliers',
  insightgen: 'reportgen',
  orderflow: 'orderflow',
};

const ACCENT: Record<VysoModuleKey, { bg: string; fg: string }> = {
  docu: { bg: '#E3F0ED', fg: '#1E5E54' },
  procurepulse: { bg: '#E6F1FB', fg: '#2C5E8A' },
  pricepilot: { bg: '#E1F5EE', fg: '#2E7D67' },
  planwise: { bg: '#E1F5EE', fg: '#1E5E54' },
  wastewatch: { bg: '#FBEFDD', fg: '#9A6314' },
  shiftboard: { bg: '#ECEAFB', fg: '#5B53C0' },
  supplysync: { bg: '#FBE9EE', fg: '#B0466A' },
  insightgen: { bg: '#EAECF8', fg: '#3A4DB0' },
  orderflow: { bg: '#EDEFF1', fg: '#5F6368' },
};

const DESCRIPTION: Record<VysoModuleKey, string> = {
  docu: 'Capture, scan and extract documents that feed the rest of Vyso.',
  procurepulse: 'Procurement, buying plans and stock intelligence.',
  pricepilot: 'Selling prices, margins and AI pricing recommendations.',
  planwise: 'Budget, forecast and plan around your operational goals.',
  wastewatch: 'Track waste, identify patterns and reduce preventable losses.',
  shiftboard: 'Plan shifts, manage staff availability and keep labour visible.',
  supplysync: 'Supplier records, scorecards, risk and relationship history.',
  insightgen: 'Turn operational data into reports, alerts and AI-generated insight.',
  orderflow: 'Customer orders, invoicing, payments and lightweight CRM.',
};

const DESKTOP_ROLE: Record<VysoModuleKey, string> = {
  docu: 'Document intake & extraction',
  procurepulse: 'Procurement & stock intelligence',
  pricepilot: 'Pricing & margin recommendations',
  planwise: 'Budgeting & forecasting',
  wastewatch: 'Waste tracking & prevention',
  shiftboard: 'Staff scheduling & labour',
  supplysync: 'Supplier intelligence & relationships',
  insightgen: 'Cross-module AI insight & reporting',
  orderflow: 'Order management & invoicing CRM',
};

const MOBILE_ROLE: Record<VysoModuleKey, MobileCompanionRole> = {
  docu: 'capture',
  procurepulse: 'snapshot',
  pricepilot: 'analysis',
  planwise: 'snapshot',
  wastewatch: 'capture',
  shiftboard: 'action',
  supplysync: 'snapshot',
  insightgen: 'analysis',
  orderflow: 'capture',
};

export const VYSO_MODULE_KEYS = Object.keys(FEATURE) as VysoModuleKey[];

export const MODULE_META: Record<VysoModuleKey, VysoModuleMeta> = Object.fromEntries(
  VYSO_MODULE_KEYS.map((k) => {
    const def = MODULE_BY_KEY[FEATURE[k]];
    return [
      k,
      {
        key: k,
        featureKey: FEATURE[k],
        name: def.label,
        description: DESCRIPTION[k],
        route: def.screens.desktop,
        icon: def.icon,
        accent: ACCENT[k],
        desktopRole: DESKTOP_ROLE[k],
        mobileCompanionRole: MOBILE_ROLE[k],
      } satisfies VysoModuleMeta,
    ];
  }),
) as Record<VysoModuleKey, VysoModuleMeta>;

/** The modules activated from "soon" in this pass. */
export const ACTIVATED_MODULE_KEYS: VysoModuleKey[] = ['planwise', 'wastewatch', 'shiftboard', 'supplysync', 'insightgen'];
