'use client'

import { useActionState } from 'react'
import Link from 'next/link'

import { cn } from '@/lib/utils'
import { fieldClass, labelClass, pillPrimaryClass, textareaClass, trackClass } from '@/features/platform/components/ui'

import { createDeskRecord, type DeskCreateState } from './actions/createDeskRecord'
import { useKeptForm } from '../components/useKeptForm'

export function ThreadReplyDraft({ threadId, subject }: { threadId: string; subject: string }) {
  const [state, action, pending] = useActionState<DeskCreateState, FormData>(createDeskRecord, { ok: false, message: '' })
  const actionForm = useKeptForm(action, state)
  return (
    <form {...actionForm} aria-labelledby="reply-draft-heading" className="grid min-w-0 gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 id="reply-draft-heading" className="text-sm font-semibold text-foreground">Reply draft</h2>
      <input type="hidden" name="kind" value="reply" />
      <input type="hidden" name="threadId" value={threadId} />
      <label htmlFor="reply-subject" className={labelClass}>Subject<input id="reply-subject" name="subject" required maxLength={300} defaultValue={subject.startsWith('Re:') ? subject : `Re: ${subject}`} className={fieldClass} /></label>
      <label htmlFor="reply-body" className={labelClass}>Message<textarea id="reply-body" name="body" required maxLength={20000} rows={5} className={textareaClass} /></label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {state.message ? <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}{state.href ? <> <Link href={state.href} className="font-semibold underline underline-offset-4">Open</Link></> : null}</p> : <span />}
        <div className={trackClass}><button type="submit" className={pillPrimaryClass} disabled={pending}>{pending ? 'Saving…' : 'Save draft'}</button></div>
      </div>
    </form>
  )
}
