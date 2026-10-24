'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, KeyRound, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { EmptyState, Notice, Panel, StatusDot, Track, fieldClass, labelClass, pillClass, pillDangerClass, pillPrimaryClass, statusLabel, statusTone, textareaClass, trackItemClass } from '@/features/platform/components/ui'
import { issueApiKeyAction, revokeApiKeyAction } from '../actions/integrationAccess'
import type { ApiKeyRow, IntegrationActionState, IssueApiKeyState } from '../actions/integrationAccessTypes'

type Revealed = { name: string; prefix: string | null; secret: string }

function Message({ state }: { state: IntegrationActionState }) {
  return state.message ? <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p> : <span />
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null
}

function keyStatus(key: ApiKeyRow) {
  if (key.status === 'active' && key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) return 'expired'
  return key.status ?? 'active'
}

function IssueForm({ scopes, onIssued }: { scopes: string[]; onIssued: (revealed: Revealed) => void }) {
  const [state, action, pending] = useActionState<IssueApiKeyState, FormData>(issueApiKeyAction, { ok: false, message: '', revision: 0 })
  const router = useRouter()
  const handled = useRef(0)
  const [expiry, setExpiry] = useState('')
  useEffect(() => {
    if (!state.ok || !state.secret || handled.current === state.revision) return
    handled.current = state.revision
    onIssued({ name: state.name ?? 'API key', prefix: state.prefix ?? null, secret: state.secret })
    router.refresh()
  }, [state, router, onIssued])
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="expiresAt" value={expiry ? new Date(`${expiry}T23:59:59`).toISOString() : ''} />
      <label className={labelClass}>Name<input name="name" required maxLength={120} className={fieldClass} /></label>
      <label className={labelClass}>Expires<input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} className={fieldClass} /></label>
      <fieldset className="grid gap-1.5 sm:col-span-2">
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Scopes</legend>
        <div className="flex flex-wrap gap-2">
          {scopes.map((scope) => <label key={scope} className="relative"><input type="checkbox" name="scopes" value={scope} className="peer sr-only" /><span className="inline-flex h-8 cursor-pointer items-center rounded-full bg-muted px-3 font-mono text-xs text-muted-foreground shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-checked:ring-1 peer-checked:ring-black/10 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50">{scope}</span></label>)}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <Message state={state} />
        <Track><button type="submit" disabled={pending} className={pillPrimaryClass}><KeyRound className="size-3.5" aria-hidden="true" />{pending ? 'Issuing…' : 'Issue key'}</button></Track>
      </div>
    </form>
  )
}

function SecretReveal({ revealed, onDone }: { revealed: Revealed; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(revealed.secret); setCopied(true) } catch { setCopied(false) }
  }
  return (
    <div className="grid gap-3">
      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold"><StatusDot tone="emerald" /><span className="truncate">{revealed.name}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">Issued</span></p>
      <label className={labelClass}>Secret<input readOnly value={revealed.secret} onFocus={(event) => event.currentTarget.select()} className={cn(fieldClass, 'font-mono text-xs')} autoComplete="off" spellCheck={false} /></label>
      <Notice>This secret is shown once. Store it now; it cannot be shown again.</Notice>
      <div className="flex justify-end">
        <Track>
          <button type="button" onClick={copy} className={pillClass}>{copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}{copied ? 'Copied' : 'Copy'}</button>
          <button type="button" onClick={onDone} className={pillPrimaryClass}>Done</button>
        </Track>
      </div>
    </div>
  )
}

function RevokeForm({ apiKey, onDone }: { apiKey: ApiKeyRow; onDone: () => void }) {
  const [state, action, pending] = useActionState<IntegrationActionState, FormData>(revokeApiKeyAction, { ok: false, message: '', revision: 0 })
  const router = useRouter()
  const handled = useRef(0)
  useEffect(() => {
    if (!state.ok || !state.revision || handled.current === state.revision) return
    handled.current = state.revision
    router.refresh()
    onDone()
  }, [state, router, onDone])
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={apiKey.id} />
      <label className={labelClass}>Reason for revoking {apiKey.name}<textarea name="reason" required minLength={3} maxLength={1000} rows={2} className={textareaClass} /></label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Message state={state} />
        <Track><button type="submit" disabled={pending} className={pillDangerClass}>{pending ? 'Revoking…' : 'Revoke key'}</button></Track>
      </div>
    </form>
  )
}

export function ApiKeysClient({ keys, scopes }: { keys: ApiKeyRow[] | null; scopes: string[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Revealed | null>(null)
  const close = () => setOpen(null)
  const issued = (value: Revealed) => { setRevealed(value); setOpen(null) }
  const active = keys?.filter((key) => keyStatus(key) === 'active').length ?? 0
  return (
    <Panel
      id="api-keys"
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">API keys{keys ? <span className="font-mono text-xs font-normal text-muted-foreground">{active} active · {keys.length}</span> : null}</h2>}
      actions={keys ? <Track><button type="button" onClick={() => { setRevealed(null); setOpen(open === 'new' ? null : 'new') }} aria-pressed={open === 'new'} className={trackItemClass(open === 'new')}><Plus className="size-3.5" aria-hidden="true" />Issue API key</button></Track> : null}
      bodyClassName="p-0"
    >
      {revealed ? <div className="border-b border-border p-4"><SecretReveal revealed={revealed} onDone={() => setRevealed(null)} /></div> : null}
      {open === 'new' ? <div className="border-b border-border p-4"><IssueForm scopes={scopes} onIssued={issued} /></div> : null}
      {!keys ? <div className="p-4"><Notice>API keys need credential management permission.</Notice></div> : keys.length ? (
        <ul className="divide-y divide-border">
          {keys.map((key) => {
            const status = keyStatus(key)
            const expires = date(key.expiresAt)
            const lastUsed = date(key.lastUsedAt)
            return (
              <li key={key.id} className="min-w-0">
                <div className="flex min-w-0 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2 text-sm font-semibold"><StatusDot tone={statusTone(status)} /><span className="truncate">{key.name}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">{statusLabel(status)}</span></p>
                    <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground"><span className="font-mono">{key.prefix ?? '—'}</span> · {key.owner?.name || key.owner?.email || 'Owner unknown'} · {expires ? `Expires ${expires}` : 'No expiry'} · {lastUsed ? `Used ${lastUsed}` : 'Never used'}</p>
                    <p className="mt-0.5 truncate pl-4 font-mono text-xs text-muted-foreground">{key.scopes.join(' ') || 'No scopes'}</p>
                  </div>
                  {status === 'active' ? <Track><button type="button" onClick={() => setOpen(open === key.id ? null : key.id)} aria-pressed={open === key.id} aria-label={`Revoke ${key.name}`} className={trackItemClass(open === key.id)}>Revoke</button></Track> : null}
                </div>
                {open === key.id ? <div className="border-t border-border bg-muted/20 p-4"><RevokeForm apiKey={key} onDone={close} /></div> : null}
              </li>
            )
          })}
        </ul>
      ) : <div className="p-4"><EmptyState title="No API keys" /></div>}
    </Panel>
  )
}
