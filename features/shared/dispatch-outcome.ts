/** Allowlisted display projection. Never forward raw provider metadata/errors. */
export function communicationDispatchState(status: string, errorCode?: string | null) {
  if (errorCode === 'smtp_outcome_unknown') return { status: 'unknown', guidance: 'Unknown — do not resend until reconciled.' }
  if (errorCode === 'smtp_not_dispatched') return { status: 'not_dispatched', guidance: 'Not dispatched. Review the original intent and authority; no automatic retry.' }
  if (errorCode === 'smtp_send_admitted') return { status: 'in_flight', guidance: 'Admitted; acceptance is not yet confirmed. Do not resend.' }
  if (status === 'sent') return { status: 'relay_accepted', guidance: 'Accepted by the relay; final delivery is not confirmed.' }
  return { status, guidance: status === 'pending' ? 'Queued; no final delivery outcome.' : '' }
}

export function webhookDispatchState(status: string, lastError?: string | null) {
  if (lastError?.startsWith('outcome_unknown:')) return { status: 'unknown', guidance: 'Unknown — do not resend until reconciled.' }
  if (lastError?.startsWith('not_dispatched:')) return { status: 'not_dispatched', guidance: 'Not dispatched. Review the original intent and authority before any new admission.' }
  if (lastError === 'admitted:awaiting_observation') return { status: 'in_flight', guidance: 'Admitted; remote outcome is not confirmed. Do not resend.' }
  if (lastError === 'claimed:not_admitted') return { status: 'claimed', guidance: 'Claimed, but not admitted for transport.' }
  return { status, guidance: '' }
}
