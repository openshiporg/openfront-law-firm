'use client'

import { useActionState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { createDeskRecord, type DeskCreateState } from './actions/createDeskRecord'

export function ThreadReplyDraft({ threadId, subject }: { threadId: string; subject: string }) {
  const [state, action, pending] = useActionState<DeskCreateState, FormData>(createDeskRecord, { ok: false, message: '' })
  return (
    <form action={action} aria-labelledby="reply-draft-heading" className="grid gap-3 border-y border-border py-4">
      <h2 id="reply-draft-heading" className="text-base font-bold text-foreground">Draft a reply</h2>
      <input type="hidden" name="kind" value="reply" />
      <input type="hidden" name="threadId" value={threadId} />
      <div className="space-y-2"><Label htmlFor="reply-subject">Subject</Label><Input id="reply-subject" name="subject" required maxLength={300} defaultValue={subject.startsWith('Re:') ? subject : `Re: ${subject}`} className="min-h-11" /></div>
      <div className="space-y-2"><Label htmlFor="reply-body">Message</Label><textarea id="reply-body" name="body" required maxLength={20000} rows={5} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" /></div>
      <Button type="submit" className="min-h-11 justify-self-start" disabled={pending}>{pending ? 'Saving…' : 'Save reply draft'}</Button>
      {state.message ? <p role={state.ok ? 'status' : 'alert'} className={`text-sm ${state.ok ? 'text-foreground' : 'text-destructive'}`}>{state.message}{state.href ? <> <Link href={state.href} className="font-semibold underline">Open it</Link></> : null}</p> : null}
    </form>
  )
}
