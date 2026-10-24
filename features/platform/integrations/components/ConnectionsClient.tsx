'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { FormSelect } from '@/components/ui/form-select'
import { cn } from '@/lib/utils'
import { PracticeRowAction } from '@/features/platform/components/PracticeRowAction'
import { EmptyState, Notice, Panel, StatusDot, Track, fieldClass, labelClass, pillPrimaryClass, statusLabel, statusTone, trackItemClass } from '@/features/platform/components/ui'
import { createConnectionAction } from '../actions/integrationAccess'
import type { ConnectionRow, IntegrationActionState } from '../actions/integrationAccessTypes'

function AddForm({ categories, onDone }: { categories: Array<[string, string]>; onDone: () => void }) {
  const [state, action, pending] = useActionState<IntegrationActionState, FormData>(createConnectionAction, { ok: false, message: '', revision: 0 })
  const router = useRouter()
  const handled = useRef(0)
  useEffect(() => {
    if (!state.ok || !state.revision || handled.current === state.revision) return
    handled.current = state.revision
    router.refresh()
    onDone()
  }, [state, router, onDone])
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <label className={labelClass}>Name<input name="name" required maxLength={200} className={fieldClass} /></label>
      <label className={labelClass}>Provider<input name="provider" required maxLength={120} placeholder="docusign" className={fieldClass} /></label>
      <div className="grid min-w-0 gap-1.5">
        <label htmlFor="connection-category" className="text-xs font-medium text-muted-foreground">Category</label>
        <FormSelect id="connection-category" name="category" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Select…</option>
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </FormSelect>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
        {state.message ? <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p> : <span />}
        <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Adding…' : 'Add connection'}</button></Track>
      </div>
    </form>
  )
}

export function ConnectionsClient({ connections, categories }: { connections: ConnectionRow[] | null; categories: Array<[string, string]> }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const categoryLabel = new Map(categories)
  return (
    <Panel
      id="connections"
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Connections{connections ? <span className="font-mono text-xs font-normal text-muted-foreground">{connections.length}</span> : null}</h2>}
      actions={connections ? <Track><button type="button" onClick={() => setOpen(!open)} aria-pressed={open} className={trackItemClass(open)}><Plus className="size-3.5" aria-hidden="true" />Add connection</button></Track> : null}
      bodyClassName="p-0"
    >
      {open ? <div className="border-b border-border p-4"><AddForm categories={categories} onDone={close} /></div> : null}
      {!connections ? <div className="p-4"><Notice>Connections need integration permission.</Notice></div> : connections.length ? (
        <ul className="divide-y divide-border">
          {connections.map((connection) => (
            <li key={connection.id} className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-2 text-sm font-semibold"><StatusDot tone={statusTone(connection.status)} /><span className="truncate">{connection.name}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">{statusLabel(connection.status)}</span></p>
                <p className="mt-0.5 truncate pl-4 text-xs text-muted-foreground">{connection.provider} · {categoryLabel.get(String(connection.category)) ?? statusLabel(connection.category)}</p>
              </div>
              <PracticeRowAction id={connection.id} kind="Connection" status={String(connection.status ?? '')} path="/dashboard/platform/integrations" canAct />
            </li>
          ))}
        </ul>
      ) : <div className="p-4"><EmptyState title="No connections" /></div>}
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">New connections start pending. Credentials are set separately and are never shown here.</p>
    </Panel>
  )
}
