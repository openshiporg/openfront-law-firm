'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { redeemCustomerPasswordReset, requestCustomerPasswordReset } from './actions/customer-reset'

const control = 'min-h-11 w-full rounded-md border border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function CustomerResetRequestForm() {
  const [state, action, pending] = useActionState(requestCustomerPasswordReset, { sent: false, error: null })
  if (state.sent) return <div className="grid max-w-md gap-4"><p role="status">If an account exists for that email, a reset link is on its way. It works once and expires soon.</p><Link className="sf-link inline-flex min-h-11 items-center" href="/account/signin">Back to sign in</Link></div>
  return <form action={action} className="grid max-w-md gap-5">
    <label className="grid gap-2 text-sm">Email<input className={control} name="email" type="email" required maxLength={320} autoComplete="email" /></label>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <button className="sf-btn min-h-11" disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</button>
  </form>
}

export function CustomerResetRedeemForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(redeemCustomerPasswordReset, { error: null, revision: 0 })
  return <form key={state.revision} action={action} className="grid max-w-md gap-5">
    <input type="hidden" name="token" value={token} />
    <label className="grid gap-2 text-sm">Email<input className={control} name="email" type="email" required maxLength={320} autoComplete="email" /></label>
    <label className="grid gap-2 text-sm">New password<input className={control} name="password" type="password" required minLength={12} maxLength={1000} autoComplete="new-password" /></label>
    <label className="grid gap-2 text-sm">Confirm new password<input className={control} name="confirmPassword" type="password" required minLength={12} maxLength={1000} autoComplete="new-password" /></label>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error} <Link className="sf-link" href="/account/reset">Request a new link</Link></p>}
    <button className="sf-btn min-h-11" disabled={pending}>{pending ? 'Saving…' : 'Set new password'}</button>
  </form>
}
