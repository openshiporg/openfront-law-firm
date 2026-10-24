// Shared, client-safe vocabulary for fee agreements. Mirrors the RetainerAgreement
// schema and the `retainer` lifecycle in features/keystone/lib/lifecycles.ts.

export const RETAINER_STATUSES = ['draft', 'sent', 'accepted', 'active', 'completed', 'terminated'] as const
export type RetainerStatus = (typeof RETAINER_STATUSES)[number]

export const FEE_STRUCTURES: Array<[string, string]> = [
  ['hourly', 'Hourly'],
  ['flat_fee', 'Flat fee'],
  ['contingency', 'Contingency'],
  ['hybrid', 'Hybrid'],
  ['pro_bono', 'Pro bono'],
]

export const CONTINGENCY_FEES = new Set(['contingency', 'hybrid'])

export const RETAINER_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent', 'terminated'],
  sent: ['accepted', 'terminated'],
  accepted: ['active', 'terminated'],
  active: ['completed', 'terminated'],
  completed: [],
  terminated: [],
}

export const TRANSITION_LABELS: Record<string, string> = {
  sent: 'Mark sent',
  accepted: 'Record acceptance',
  active: 'Activate',
  completed: 'Complete',
  terminated: 'Terminate',
}

export function feeStructureLabel(value: string | null | undefined) {
  return FEE_STRUCTURES.find(([key]) => key === value)?.[1] ?? 'Fee structure'
}

export function basisPointsLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return 'None'
  return `${(value / 100).toLocaleString('en', { maximumFractionDigits: 2 })}%`
}
