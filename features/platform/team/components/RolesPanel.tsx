'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ErrorBanner, Panel, StatusDot, Track, fieldClass, labelClass, pillDangerClass, pillPrimaryClass, pillClass, trackItemClass } from '@/features/platform/components/ui'

import { createRole, saveRolePermissions, setRoleStatus } from '../actions/roles'
import { PERMISSION_GROUPS, initialRoleActionState, type RoleActionState, type RoleDirectory, type RoleRow } from '../lib/rolePermissions'

function Result({ state }: { state: RoleActionState }) {
  if (!state.message) return <span />
  return <p role={state.ok ? 'status' : 'alert'} className={cn('min-w-0 text-sm', state.ok ? 'text-foreground' : 'text-destructive')}>{state.message}</p>
}

function useRefreshOnSuccess(state: RoleActionState, onDone?: () => void) {
  const router = useRouter()
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })
  useEffect(() => {
    if (state.ok && state.revision) {
      router.refresh()
      done.current?.()
    }
  }, [state.ok, state.revision, router])
}

function PermissionToggles({ granted, disabled }: { granted: readonly string[]; disabled?: boolean }) {
  const set = new Set(granted)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.id} disabled={disabled} className="min-w-0 rounded-lg border border-border bg-background p-3">
          <legend className="px-1 text-xs font-semibold text-foreground">{group.title}</legend>
          <div className="grid gap-1">
            {group.items.map((item) => (
              <label key={item.key} className="flex min-h-9 cursor-pointer items-center justify-between gap-3 text-sm">
                <span className="min-w-0">{item.label}</span>
                <input type="checkbox" name="permission" value={item.key} defaultChecked={set.has(item.key)} className="peer sr-only" />
                <span aria-hidden="true" className="relative h-5 w-9 shrink-0 rounded-full bg-muted shadow-[inset_0_1px_2px_rgb(0_0_0/0.15)] transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:bg-emerald-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 peer-disabled:opacity-60" />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

function RoleEditor({ role, canManage, isOwn, onDone }: { role: RoleRow; canManage: boolean; isOwn: boolean; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveRolePermissions, initialRoleActionState)
  const [statusState, statusAction, statusPending] = useActionState(setRoleStatus, initialRoleActionState)
  useRefreshOnSuccess(state)
  useRefreshOnSuccess(statusState, onDone)
  const archived = role.status === 'archived'
  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-4">
        <input type="hidden" name="roleId" value={role.id} />
        <input type="hidden" name="status" value={role.status} />
        <PermissionToggles granted={role.granted} disabled={!canManage || archived} />
        {canManage && !archived ? (
          <>
            <label className={labelClass}>Reason<input name="reason" required minLength={3} maxLength={2000} className={fieldClass} /></label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Result state={state} />
              <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Saving…' : 'Save permissions'}</button></Track>
            </div>
          </>
        ) : null}
      </form>
      {canManage && !isOwn ? (
        <form action={statusAction} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <input type="hidden" name="roleId" value={role.id} />
          <input type="hidden" name="status" value={archived ? 'active' : 'archived'} />
          {role.granted.map((key) => <input key={key} type="hidden" name="permission" value={key} />)}
          <label className={labelClass}>{archived ? 'Reason to restore' : 'Reason to archive'}<input name="reason" required minLength={3} maxLength={2000} className={fieldClass} /></label>
          <Track><button type="submit" disabled={statusPending} className={archived ? pillClass : pillDangerClass}>{statusPending ? 'Saving…' : archived ? 'Restore role' : 'Archive role'}</button></Track>
          {statusState.message ? <div className="sm:col-span-2"><Result state={statusState} /></div> : null}
        </form>
      ) : null}
    </div>
  )
}

function NewRoleForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(createRole, initialRoleActionState)
  useRefreshOnSuccess(state, onDone)
  return (
    <form action={action} className="grid gap-4">
      <label className={labelClass}>Name<input name="name" required maxLength={80} className={fieldClass} /></label>
      <PermissionToggles granted={['canAccessDashboard']} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Result state={state} />
        <Track><button type="submit" disabled={pending} className={pillPrimaryClass}>{pending ? 'Creating…' : 'Create role'}</button></Track>
      </div>
    </form>
  )
}

export function RolesPanel({ directory }: { directory: RoleDirectory }) {
  const [open, setOpen] = useState<string | null>(null)
  const close = () => setOpen(null)
  if (directory.status !== 'loaded') return <ErrorBanner title="Roles unavailable">{directory.message}</ErrorBanner>
  const { roles, canManage, ownRoleId } = directory
  const active = roles.filter((role) => role.status === 'active').length
  return (
    <Panel
      id="roles"
      title={<h2 className="flex items-baseline gap-2 text-sm font-semibold">Roles<span className="font-mono text-xs font-normal text-muted-foreground">{active} active · {roles.length}</span></h2>}
      actions={canManage ? <Track><button type="button" onClick={() => setOpen(open === 'new' ? null : 'new')} aria-pressed={open === 'new'} className={trackItemClass(open === 'new')}><Plus className="size-3.5" aria-hidden="true" />New role</button></Track> : undefined}
      bodyClassName="p-0"
    >
      {open === 'new' ? <div className="border-b border-border bg-muted/20 p-4"><NewRoleForm onDone={close} /></div> : null}
      {roles.length ? (
        <ul className="divide-y divide-border">
          {roles.map((role) => (
            <li key={role.id} className="min-w-0">
              <button type="button" onClick={() => setOpen(open === role.id ? null : role.id)} aria-expanded={open === role.id} className="flex w-full min-w-0 items-center gap-2 px-4 py-3 text-left hover:bg-muted/40">
                <StatusDot tone={role.status === 'active' ? 'emerald' : 'zinc'} />
                <span className="min-w-0 truncate text-sm font-semibold">{role.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{role.status === 'active' ? 'Active' : 'Archived'}{role.id === ownRoleId ? ' · Your role' : ''}</span>
                <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}<span className="hidden sm:inline"> · {role.granted.length} permissions</span></span>
              </button>
              {open === role.id ? <div className="border-t border-border bg-muted/20 p-4"><RoleEditor role={role} canManage={canManage} isOwn={role.id === ownRoleId} onDone={close} /></div> : null}
            </li>
          ))}
        </ul>
      ) : open !== 'new' ? <p role="status" className="px-4 py-6 text-sm text-muted-foreground">No roles</p> : null}
    </Panel>
  )
}
