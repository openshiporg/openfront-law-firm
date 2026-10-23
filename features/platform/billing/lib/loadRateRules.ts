import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

import { priceMinutes, resolveHourlyRate, type HourlyRateRule } from './ratePricing'

export const RATE_RULE_LIMIT = 500

const ruleFields = `
  id amountMinor currencyCode priority effectiveFrom effectiveTo
  matter { id } user { id name } practiceArea { id name }
  rateCard { id name status matter { id } effectiveFrom effectiveTo }
`

/** Active hourly rules the viewer can read, across firm and matter rate cards. */
export async function loadActiveHourlyRules() {
  return keystoneClient<{ rateRules: HourlyRateRule[] }>(`
    query ActiveHourlyRateRules($take: Int!) {
      rateRules(
        where: { rateType: { equals: hourly }, rateCard: { status: { equals: active } } }
        orderBy: [{ priority: asc }, { id: asc }]
        take: $take
      ) { ${ruleFields} }
    }
  `, { take: RATE_RULE_LIMIT })
}

type PricingEntry = {
  id: string
  durationMinutes: number
  workDate: string
  user: { id: string } | null
  matter: { id: string; practiceArea: { id: string } | null } | null
}

/** Rate and amount for each entry that an active rule covers; uncovered entries are omitted. */
export function priceEntries(rules: HourlyRateRule[], entries: PricingEntry[]) {
  const priced = new Map<string, { rule: HourlyRateRule; rateMinor: number; amountMinor: number }>()
  for (const entry of entries) {
    if (!entry.matter) continue
    const rule = resolveHourlyRate(rules, {
      matterId: entry.matter.id,
      userId: entry.user?.id ?? null,
      practiceAreaId: entry.matter.practiceArea?.id ?? null,
      workDate: entry.workDate,
    })
    if (rule) priced.set(entry.id, { rule, rateMinor: rule.amountMinor, amountMinor: priceMinutes(rule.amountMinor, entry.durationMinutes) })
  }
  return priced
}
