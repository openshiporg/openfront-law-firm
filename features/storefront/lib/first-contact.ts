/**
 * Single first-contact contract shared by the booking form and the
 * authoritative booking command (client-safe; no server imports).
 *
 * Live firms show their own published first-contact notice (PublicSitePolicy),
 * versioned per publication. The offline fixture uses the fixed notice below.
 * The acknowledgment sentence is the existing repository copy; final wording
 * for a real firm is the firm's own (published) notice.
 */
export const FIXTURE_FIRST_CONTACT_NOTICE =
  'Fictional local appointment. No legal advice or attorney-client relationship. Share only what is reasonably necessary to assess fit. Do not send documents, account numbers, medical records, or unnecessary confidential details.'

export const FIRST_CONTACT_ACKNOWLEDGMENT =
  'I understand that submitting this request does not create an attorney-client relationship, the firm has not agreed to represent me, and I should not rely on this form for emergencies or deadlines.'

/** Version string the client echoes back; the server recomputes it at commit. */
export function firstContactVersion(mode: 'fixture' | 'live', liveVersion = 0) {
  return mode === 'fixture' ? 'fixture-v1' : `live-v${liveVersion}`
}

export class FirstContactValidationError extends Error {}

function bounded(value: unknown, label: string, maximum: number, required = true) {
  const result = typeof value === 'string' ? value.trim() : ''
  if (required && !result) throw new FirstContactValidationError(`${label} is required.`)
  if (result.length > maximum) throw new FirstContactValidationError(`${label} must be ${maximum} characters or fewer.`)
  return result
}

/** Minimum conflict/fit fields collected after the notice and before any substantive narrative. */
export function validateFirstContact(input: { summary?: unknown; jurisdiction?: unknown; opposingParties?: unknown; keyDeadline?: unknown }) {
  return {
    jurisdiction: bounded(input.jurisdiction, 'State or jurisdiction', 120),
    opposingParties: bounded(input.opposingParties, 'Opposing or related parties', 500),
    keyDeadline: bounded(input.keyDeadline, 'Known deadline', 120, false),
    summary: bounded(input.summary, 'Brief description', 800, false),
  }
}

export function hasNamedOpposingParty(opposingParties: string) {
  return !/^none(?: known)?\.?$/i.test(opposingParties.trim())
}
