/** Allowlisted display projection. Never forward raw provider errors. */
export function webhookDispatchState(status: string, lastError?: string | null) {
  if (status === 'processing') return { status: 'in_flight', guidance: 'Sending, or interrupted before the result was recorded. Retry if it stays here.' }
  if (status === 'dead_letter') return { status, guidance: 'Retries used up. Staff can retry once more.' }
  if (status === 'failed') return { status, guidance: lastError ? `Last attempt failed (${lastError.replace(/[^a-z0-9_:]/gi, '').slice(0, 60)}). Staff can retry.` : 'Last attempt failed. Staff can retry.' }
  return { status, guidance: '' }
}
