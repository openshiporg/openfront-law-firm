'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, UserPlus, X } from 'lucide-react'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { EmptyState, Notice, Panel, StatusDot, StatusText, Track, fieldClass, labelClass, pillDangerClass, pillPrimaryClass, statusTone, textareaClass, trackItemClass } from '@/features/platform/components/ui'
import { addDocumentSignerAction, cancelSignatureRequestAction, prepareSignatureRequestAction } from '../actions/signatureRequests'
import type { DocumentSignatureSetup, SignatureActionState, SignatureRequestRow } from '../actions/signatureTypes'

const initial: SignatureActionState = { ok: false, message: '', revision: 0 }
const CANCELLABLE = new Set(['draft', 'sent', 'partially_signed'])

function useSignatureAction(action: (previous: SignatureActionState, formData: FormData) => Promise<SignatureActionState>, onDone?: () => void) {
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

function Message({ state }: { state: SignatureActionState }) {
  return state.message ? <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p> : <span />
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null
}

function RequestForm({ documentId, setup, onDone }: { documentId: string; setup: DocumentSignatureSetup; onDone: () => void }) {
  const [state, action, pending] = useSignatureAction(prepareSignatureRequestAction, onDone)
  const [expiry, setExpiry] = useState('')
  // The expiry day ends at 23:59 in the viewer's own time zone.
  const expiresAt = expiry ? new Date(`${expiry}T23:59:59`).toISOString() : ''
  const version = setup.currentVersion
  if (!version) return <Notice>Upload a version before requesting signatures.</Notice>
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="documentVersionId" value={version.id} />
      <input type="hidden" name="expiresAt" value={expiresAt} />
      <div className="grid gap-1.5 sm:col-span-2">
        <p className="text-xs font-medium text-muted-foreground">Version</p>
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium"><StatusDot tone="emerald" /><span className="truncate">v{version.versionNumber ?? '?'} · {version.fileName ?? 'File'}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">Current</span></p>
      </div>
      <label className={cn(labelClass, 'sm:col-span-2')}>Title<input name="title" required maxLength={300} className={fieldClass} /></label>
      <label className={cn(labelClass, 'sm:col-span-2')}>Message to signers<textarea name="message" rows={3} maxLength={5000} className={textareaClass} /></label>
      <label className={labelClass}>Expires<input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} className={fieldClass} /></label>
      {setup.connections.length ? (
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor="signature-connection" className="text-xs font-medium text-muted-foreground">Signature connection</label>
          <FormSelect id="signature-connection" name="integrationConnectionId" defaultValue="" className={fieldClass}>
            <option value="">None (manual)</option>
            {setup.connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.name} · {connection.provider}</option>)}
          </FormSelect>
        </div>
      ) : <div className="grid gap-1.5"><p className="text-xs font-medium text-muted-foreground">Signature connection</p><p className="flex min-h-10 items-center text-sm text-muted-foreground">None active (manual)</p></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <Message state={state} />
        <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Preparing…' : 'Prepare request'}</button></Track>
      </div>
    </form>
  )
}

function SignerForm({ documentId, request, onDone }: { documentId: string; request: SignatureRequestRow; onDone: () => void }) {
  const [state, action, pending] = useSignatureAction(addDocumentSignerAction, onDone)
  const nextOrder = Math.max(0, ...request.signers.map((signer) => signer.signingOrder ?? 0)) + 1
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="requestId" value={request.id} />
      <div className="sm:col-span-2"><SearchableOptionSelect id={`signer-contact-${request.id}`} name="contactId" label="Contact (optional)" kind="contact" options={[]} emptyLabel="No contact" /></div>
      <label className={labelClass}>Name<input name="name" maxLength={300} placeholder="From contact if blank" className={fieldClass} /></label>
      <label className={labelClass}>Email<input name="email" type="email" maxLength={320} placeholder="From contact if blank" className={fieldClass} /></label>
      <label className={labelClass}>Signing order<input name="signingOrder" type="number" min={1} max={1000} step={1} defaultValue={nextOrder} className={fieldClass} /></label>
      <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2">
        <Message state={state} />
        <Track><button type="submit" disabled={pending} className={pillPrimaryClass}><UserPlus className="size-3.5" aria-hidden="true" />{pending ? 'Adding…' : 'Add signer'}</button></Track>
      </div>
    </form>
  )
}

function CancelForm({ documentId, request, onDone }: { documentId: string; request: SignatureRequestRow; onDone: () => void }) {
  const [state, action, pending] = useSignatureAction(cancelSignatureRequestAction, onDone)
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="requestId" value={request.id} />
      <label className={labelClass}>Reason for cancelling<textarea name="note" required minLength={5} maxLength={2000} rows={2} className={textareaClass} /></label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Message state={state} />
        <Track><button type="submit" disabled={pending} className={pillDangerClass}>{pending ? 'Cancelling…' : 'Cancel request'}</button></Track>
      </div>
    </form>
  )
}

function RequestItem({ documentId, request }: { documentId: string; request: SignatureRequestRow }) {
  const [open, setOpen] = useState<'signer' | 'cancel' | null>(null)
  const close = () => setOpen(null)
  const status = String(request.status ?? 'draft')
  const canAddSigner = status === 'draft'
  const canCancel = CANCELLABLE.has(status)
  const expires = date(request.expiresAt)
  return (
    <li className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2 text-sm font-semibold"><StatusDot tone={statusTone(status)} /><Link href={`/dashboard/platform/documents/signature-request/${encodeURIComponent(request.id)}`} className="truncate underline-offset-4 hover:underline">{request.title ?? 'Signature request'}</Link><StatusText status={status} className="ml-0" /></p>
          <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">v{request.versionNumber ?? '?'} · {request.connectionName ?? (request.provider || 'Manual')}{expires ? ` · Expires ${expires}` : ''} · {request.signers.length} {request.signers.length === 1 ? 'signer' : 'signers'}</p>
        </div>
        {canAddSigner || canCancel ? (
          <Track>
            {canAddSigner ? <button type="button" onClick={() => setOpen(open === 'signer' ? null : 'signer')} aria-pressed={open === 'signer'} className={trackItemClass(open === 'signer')}><UserPlus className="size-3.5" aria-hidden="true" />Signer</button> : null}
            {canCancel ? <button type="button" onClick={() => setOpen(open === 'cancel' ? null : 'cancel')} aria-pressed={open === 'cancel'} className={trackItemClass(open === 'cancel')}><X className="size-3.5" aria-hidden="true" />Cancel</button> : null}
          </Track>
        ) : null}
      </div>
      {request.signers.length ? (
        <ul className="grid gap-1 px-4 pb-3 pl-8">
          {request.signers.map((signer) => (
            <li key={signer.id} className="flex min-w-0 items-center gap-2 text-sm">
              <StatusDot tone={statusTone(signer.status)} />
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{signer.signingOrder ?? '?'}.</span>
              <span className="min-w-0 truncate">{signer.name ?? 'Signer'}<span className="text-muted-foreground"> · {signer.email ?? 'no email'}</span></span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{String(signer.status ?? 'pending').replaceAll('_', ' ')}</span>
            </li>
          ))}
        </ul>
      ) : canAddSigner ? <p className="px-4 pb-3 pl-8 text-xs text-muted-foreground">No signers yet</p> : null}
      {open === 'signer' ? <div className="border-t border-border bg-muted/20 p-4"><SignerForm documentId={documentId} request={request} onDone={close} /></div> : null}
      {open === 'cancel' ? <div className="border-t border-border bg-muted/20 p-4"><CancelForm documentId={documentId} request={request} onDone={close} /></div> : null}
    </li>
  )
}

export function SignatureRequestsPanel({ documentId, setup }: { documentId: string; setup: DocumentSignatureSetup }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const canRequest = ['draft', 'active'].includes(String(setup.documentStatus))
  return (
    <Panel
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Signatures<span className="font-mono text-xs font-normal text-muted-foreground">{setup.requests.length}</span></h2>}
      actions={canRequest ? <Track><button type="button" onClick={() => setOpen(!open)} aria-pressed={open} className={trackItemClass(open)}><Plus className="size-3.5" aria-hidden="true" />Request signatures</button></Track> : null}
      bodyClassName="p-0"
    >
      {open ? <div className="border-b border-border p-4"><RequestForm documentId={documentId} setup={setup} onDone={close} /></div> : null}
      {setup.requests.length ? (
        <ul className="divide-y divide-border">{setup.requests.map((request) => <RequestItem key={request.id} documentId={documentId} request={request} />)}</ul>
      ) : <div className="p-4"><EmptyState title="No signature requests" /></div>}
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Signing outcomes are recorded only by a configured signature provider. Requests can be cancelled here.</p>
    </Panel>
  )
}
