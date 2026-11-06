'use client'

import { useActionState } from 'react'
import { payConsultationFee } from './actions/customer-account'

/** Sends the client to Stripe Checkout for a consultation fee that is still due. */
export function PayConsultationForm({ consultationId, amountLabel }: { consultationId: string; amountLabel: string }) {
  const [state, action, pending] = useActionState(payConsultationFee, { error: null })
  return <form action={action} className="grid gap-3">
    <input type="hidden" name="consultationId" value={consultationId} />
    {state.error ? <p role="alert" className="sf-error">{state.error}</p> : null}
    <div className="sf-track sf-track--block"><button className="sf-pill sf-pill--primary sf-pill--lg" disabled={pending}>{pending ? 'Opening secure checkout…' : `Pay ${amountLabel} consultation fee`}</button></div>
  </form>
}
