'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { redeemCustomerPasswordReset, requestCustomerPasswordReset } from './actions/customer-reset'

export function CustomerResetRequestForm() {
  const [state, action, pending] = useActionState(requestCustomerPasswordReset, { sent: false, error: null })
  if (state.sent) return <div className="grid gap-5"><p role="status" className="sf-notice">If an account exists for that email, a one-time reset link is on its way.</p><div className="sf-track"><Link className="sf-pill sf-pill--raised" href="/account/signin">Back to sign in</Link></div></div>
  return <form action={action} className="sf-form">
    <label className="sf-field-label">Email<input className="sf-field" name="email" type="email" required maxLength={320} autoComplete="email" /></label>
    {state.error && <p role="alert" className="sf-error">{state.error}</p>}
    <div className="sf-track sf-track--block"><button className="sf-pill sf-pill--primary sf-pill--lg" disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</button></div>
  </form>
}

export function CustomerResetRedeemForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(redeemCustomerPasswordReset, { error: null, revision: 0 })
  return <form key={state.revision} action={action} className="sf-form">
    <input type="hidden" name="token" value={token} />
    <label className="sf-field-label">Email<input className="sf-field" name="email" type="email" required maxLength={320} autoComplete="email" /></label>
    <label className="sf-field-label">New password<input className="sf-field" name="password" type="password" required minLength={12} maxLength={1000} autoComplete="new-password" /></label>
    <label className="sf-field-label">Confirm new password<input className="sf-field" name="confirmPassword" type="password" required minLength={12} maxLength={1000} autoComplete="new-password" /></label>
    {state.error && <p role="alert" className="sf-error">{state.error} <Link className="sf-link" href="/account/reset">Request a new link</Link></p>}
    <div className="sf-track sf-track--block"><button className="sf-pill sf-pill--primary sf-pill--lg" disabled={pending}>{pending ? 'Saving…' : 'Set new password'}</button></div>
  </form>
}
