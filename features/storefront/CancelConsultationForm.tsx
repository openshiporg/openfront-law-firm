'use client'

import { useActionState } from 'react'
import { cancelConsultation } from './actions/customer-account'

export function CancelConsultationForm({ consultationId }: { consultationId: string }) {
  const [state, action, pending] = useActionState(cancelConsultation, { error: null, done: false })
  if (state.done) return <p role="status" className="sf-notice">Consultation cancelled.</p>
  return <details className="sf-card">
    <summary className="sf-card__body cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">Cancel this consultation</summary>
    <form action={action} className="sf-form border-t border-[var(--color-rule)] p-5">
      <input type="hidden" name="consultationId" value={consultationId} />
      <label className="sf-field-label">Reason <span className="sf-field-opt">(optional)</span><textarea name="reason" maxLength={1000} className="sf-field" /></label>
      <label className="sf-check"><input type="checkbox" name="confirm" value="yes" required /><span>Cancel this consultation. The time is released.</span></label>
      {state.error ? <p role="alert" className="sf-error">{state.error}</p> : null}
      <div className="sf-track"><button className="sf-pill sf-pill--raised" disabled={pending}>{pending ? 'Cancelling…' : 'Cancel consultation'}</button></div>
    </form>
  </details>
}
