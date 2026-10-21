import { practiceAreas } from '@/features/storefront/content'

export class PublicIntakeValidationError extends Error {}

function bounded(value: unknown, label: string, maximum: number, required = true) {
  const result = typeof value === 'string' ? value.trim() : ''
  if ((required && !result) || result.length > maximum) throw new PublicIntakeValidationError(`${label} ${required ? 'is required and ' : ''}must be ${maximum} characters or fewer.`)
  return result
}

export function validateConsultationRequest(input: Record<string, unknown>, allowedPracticeAreas: readonly string[] = practiceAreas.map((item) => item.slug)) {
  const idempotencyKey = bounded(input.idempotencyKey, 'Request reference', 80)
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(idempotencyKey)) throw new PublicIntakeValidationError('Request reference is invalid. Refresh and try again.')
  const firstName = bounded(input.firstName, 'First name', 120)
  const lastName = bounded(input.lastName, 'Last name', 120)
  const email = bounded(input.email, 'Email', 320).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PublicIntakeValidationError('Enter a valid email address.')
  const phone = bounded(input.phone, 'Phone', 80, false)
  const practiceArea = bounded(input.practiceArea, 'Practice area', 80)
  if (!allowedPracticeAreas.includes(practiceArea)) throw new PublicIntakeValidationError('Select an available practice area.')
  const jurisdiction = bounded(input.jurisdiction, 'State or jurisdiction', 120)
  const opposingParties = bounded(input.opposingParties, 'Opposing-party names', 500)
  const keyDeadline = bounded(input.keyDeadline, 'Known deadline', 120, false)
  const summary = bounded(input.summary, 'Short summary', 800)
  const referralSource = bounded(input.referralSource, 'Referral source', 120, false)
  if (input.acknowledgment !== 'yes') throw new PublicIntakeValidationError('Acknowledge the intake and no-relationship notice before submitting.')
  return { idempotencyKey, firstName, lastName, email, phone, practiceArea, jurisdiction, opposingParties, keyDeadline, summary, referralSource }
}
