'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { ArrowRight, LoaderCircle } from 'lucide-react'

import { acceptPortalInvite } from './actions'
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--portal-accent,var(--foreground))] px-5 text-sm font-semibold text-white outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
      {pending ? 'Opening portal…' : 'Open client portal'}
    </button>
  )
}

export function PortalAcceptForm({ token = '' }: { token?: string }) {
  const [state, formAction] = useActionState(acceptPortalInvite, { error: null, inviteToken: token, revision: 0 })
  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div>
        <label htmlFor="inviteToken" className="text-sm font-semibold text-foreground">Invitation token</label>
        <input
          key={`${state.revision}:${state.inviteToken}`}
          id="inviteToken"
          name="inviteToken"
          defaultValue={state.inviteToken}
          autoComplete="off"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "portal-invitation-error" : "portal-invitation-help"}
          required
          className="mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p id="portal-invitation-help" className="mt-2 text-xs leading-5 text-muted-foreground">Invitation tokens are one-time credentials provided by your firm.</p>
      </div>
      {state.error ? <p id="portal-invitation-error" role="alert" aria-live="polite" className="text-sm leading-6 text-destructive">{state.error}</p> : null}
      <SubmitButton />
    </form>
  )
}
