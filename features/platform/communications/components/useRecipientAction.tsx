'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'
import type { RecipientActionState } from '../actions/recipientTypes'

const initial: RecipientActionState = { ok: false, message: '', revision: 0 }

/** Runs a recipient action, refreshes the drill-in once per success and then closes the form. */
export function useRecipientAction(action: (previous: RecipientActionState, formData: FormData) => Promise<RecipientActionState>, onDone?: () => void) {
  const [state, formAction, pending] = useActionState(action, initial)
  const router = useRouter()
  const handled = useRef(0)
  useEffect(() => {
    if (!state.ok || !state.revision || handled.current === state.revision) return
    handled.current = state.revision
    router.refresh()
    onDone?.()
  }, [state, router, onDone])
  return [state, formAction, pending] as const
}

export function ActionMessage({ state }: { state: RecipientActionState }) {
  return state.message ? <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p> : <span />
}
