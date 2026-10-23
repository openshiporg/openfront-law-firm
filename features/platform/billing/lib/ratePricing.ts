// Hourly rate resolution for time entries. Pure: callers load the active rate rules
// (as the signed-in viewer) and pass them in, so access control decides which rules exist.

export type HourlyRateRule = {
  id: string
  amountMinor: number
  currencyCode: string
  priority: number | null
  effectiveFrom: string | null
  effectiveTo: string | null
  matter: { id: string } | null
  user: { id: string; name?: string | null } | null
  practiceArea: { id: string; name?: string | null } | null
  rateCard: {
    id: string
    name: string
    status: string
    matter: { id: string } | null
    effectiveFrom: string | null
    effectiveTo: string | null
  } | null
}

export type RateTarget = {
  matterId: string
  userId: string | null
  practiceAreaId: string | null
  workDate: string | Date
}

function within(at: number, from: string | null, to: string | null) {
  if (from && new Date(from).getTime() > at) return false
  if (to && new Date(to).getTime() < at) return false
  return true
}

// Most specific rule wins: a rule naming this matter beats one naming this timekeeper,
// which beats one naming the matter's practice area, which beats a default rule; a
// matter-scoped card beats the firm card at equal specificity. Rules naming another
// matter, timekeeper or practice area never apply. Lower priority numbers win ties.
export function resolveHourlyRate(rules: HourlyRateRule[], target: RateTarget): HourlyRateRule | null {
  const at = new Date(target.workDate).getTime()
  if (Number.isNaN(at)) return null
  let best: { rule: HourlyRateRule; score: number } | null = null
  for (const rule of rules) {
    const card = rule.rateCard
    if (!card || card.status !== 'active') continue
    if (card.matter && card.matter.id !== target.matterId) continue
    if (rule.matter && rule.matter.id !== target.matterId) continue
    if (rule.user && rule.user.id !== target.userId) continue
    if (rule.practiceArea && rule.practiceArea.id !== target.practiceAreaId) continue
    if (!within(at, card.effectiveFrom, card.effectiveTo) || !within(at, rule.effectiveFrom, rule.effectiveTo)) continue
    if (!Number.isSafeInteger(rule.amountMinor) || rule.amountMinor < 0) continue
    const score = (rule.matter ? 8 : 0) + (rule.user ? 4 : 0) + (rule.practiceArea ? 2 : 0) + (card.matter ? 1 : 0)
    if (
      !best ||
      score > best.score ||
      (score === best.score && (rule.priority ?? 100) < (best.rule.priority ?? 100))
    ) best = { rule, score }
  }
  return best?.rule ?? null
}

/** Amount for a duration at an hourly rate, rounded to the nearest minor unit. */
export function priceMinutes(rateMinor: number, minutes: number) {
  return Math.round((rateMinor * minutes) / 60)
}
