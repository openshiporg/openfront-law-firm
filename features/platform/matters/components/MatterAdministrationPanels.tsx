'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ChoiceTrack, CheckField, FormFooter, ReasonField, TextField, useCommand } from '@/features/platform/components/CommandFormParts'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import { EmptyState, Panel, StatusDot, Track, fieldClass, labelClass, statusLabel, statusTone, trackItemClass } from '@/features/platform/components/ui'
import { FormSelect } from '@/components/ui/form-select'

import { changeConfidentiality, createEthicalWall, saveMatterTeamMember, setMatterWallMember, transitionMatterWall } from '../actions/matterAdministration'
import { TEAM_ROLES, type EthicalWallEntry, type MatterTeamEntry } from '../lib/administrationTypes'

const roleLabel = (role: string) => TEAM_ROLES.find(([value]) => value === role)?.[1] ?? statusLabel(role)
const capabilities = (member: MatterTeamEntry) => [member.canEdit && 'Edit', member.canBill && 'Bill', member.canAccessRestricted && 'Restricted'].filter(Boolean).join(' · ') || 'Read only'

function Count({ title, count }: { title: string; count: number }) {
  return <h2 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-foreground"><span className="truncate">{title}</span><span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{count.toLocaleString()}</span></h2>
}

function RoleSelect({ id, defaultValue }: { id: string; defaultValue: string }) {
  return <label htmlFor={id} className={labelClass}>Team role<FormSelect id={id} name="teamRole" defaultValue={defaultValue} className={fieldClass}>{TEAM_ROLES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</FormSelect></label>
}

function TeamForm({ matterId, member, onDone }: { matterId: string; member?: MatterTeamEntry; onDone: () => void }) {
  const [state, action, pending] = useCommand(saveMatterTeamMember, onDone)
  const key = member?.id ?? 'new'
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="matterId" value={matterId} />
      {member?.user ? <input type="hidden" name="userId" value={member.user.id} /> : <div className="sm:col-span-2"><SearchableOptionSelect id={`team-user-${key}`} name="userId" label="Member" emptyLabel="Choose a member" required kind="member" options={[]} /></div>}
      <RoleSelect id={`team-role-${key}`} defaultValue={member?.teamRole ?? 'attorney'} />
      <fieldset className="grid content-start gap-0">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">Capabilities</legend>
        <CheckField name="canEdit" label="Can edit" defaultChecked={member?.canEdit ?? true} />
        <CheckField name="canBill" label="Can bill" defaultChecked={member?.canBill ?? false} />
        <CheckField name="canAccessRestricted" label="Restricted access" defaultChecked={member?.canAccessRestricted ?? false} />
      </fieldset>
      <ReasonField id={`team-reason-${key}`} className="sm:col-span-2" />
      <FormFooter state={state} pending={pending} label={member ? 'Save access' : 'Add member'} className="sm:col-span-2" />
    </form>
  )
}

function RemoveMemberForm({ matterId, member, onDone }: { matterId: string; member: MatterTeamEntry; onDone: () => void }) {
  const [state, action, pending] = useCommand(saveMatterTeamMember, onDone)
  if (!member.user) return null
  return (
    <form action={action} className="grid gap-3 border-t border-border pt-4">
      <input type="hidden" name="matterId" value={matterId} />
      <input type="hidden" name="userId" value={member.user.id} />
      <input type="hidden" name="teamRole" value={member.teamRole} />
      <input type="hidden" name="intent" value="remove" />
      <ReasonField id={`team-remove-${member.id}`} label="Reason for removal" />
      <FormFooter state={state} pending={pending} label="Remove from team" pendingLabel="Removing…" danger />
    </form>
  )
}

export function MatterTeamPanel({ matterId, team }: { matterId: string; team: MatterTeamEntry[] | null }) {
  const [open, setOpen] = useState<string | null>(null)
  const close = () => setOpen(null)
  if (!team) return <Panel title="Team access"><EmptyState title="Team access is unavailable to your role" /></Panel>
  const active = team.filter((member) => member.status === 'active')
  return (
    <Panel
      id="team-access"
      title={<Count title="Team access" count={active.length} />}
      actions={<Track><button type="button" onClick={() => setOpen(open === 'new' ? null : 'new')} aria-pressed={open === 'new'} className={trackItemClass(open === 'new')}><Plus className="size-3.5" aria-hidden="true" />Add</button></Track>}
      bodyClassName="p-0"
    >
      {open === 'new' ? <div className="border-b border-border p-4"><TeamForm matterId={matterId} onDone={close} /></div> : null}
      {team.length ? <ul className="divide-y divide-border">
        {team.map((member) => <li key={member.id}>
          <button type="button" onClick={() => setOpen(open === member.id ? null : member.id)} aria-expanded={open === member.id} className="grid w-full min-w-0 gap-0.5 px-4 py-3 text-left hover:bg-muted/40">
            <span className="flex min-w-0 items-center gap-2">
              <StatusDot tone={statusTone(member.status)} />
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">{member.user?.name || 'Identity restricted'}</span>
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{statusLabel(member.status)}</span>
            </span>
            <span className="truncate pl-4 text-xs text-muted-foreground">{roleLabel(member.teamRole)} · {member.status === 'active' ? capabilities(member) : 'No access'}</span>
          </button>
          {open === member.id && member.user ? <div className="grid gap-4 border-t border-border bg-muted/20 p-4">
            <TeamForm key={`${member.id}-${member.status}`} matterId={matterId} member={member} onDone={close} />
            {member.status === 'active' ? <RemoveMemberForm matterId={matterId} member={member} onDone={close} /> : null}
          </div> : null}
        </li>)}
      </ul> : <div className="p-4"><EmptyState title="No team members" /></div>}
    </Panel>
  )
}

function CreateWallForm({ matterId, onDone }: { matterId: string; onDone: () => void }) {
  const [state, action, pending] = useCommand(createEthicalWall, onDone)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="matterId" value={matterId} />
      <TextField id="wall-name" name="name" label="Name" required minLength={2} maxLength={200} />
      <TextField id="wall-policy" name="policyReference" label="Policy reference" maxLength={200} />
      <ReasonField id="wall-reason" className="sm:col-span-2" />
      <FormFooter state={state} pending={pending} label="Create draft wall" pendingLabel="Creating…" className="sm:col-span-2" />
    </form>
  )
}

function WallTransitionForm({ matterId, wall }: { matterId: string; wall: EthicalWallEntry }) {
  const [state, action, pending] = useCommand(transitionMatterWall)
  const toStatus = wall.status === 'draft' ? 'active' : 'lifted'
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="matterId" value={matterId} />
      <input type="hidden" name="wallId" value={wall.id} />
      <input type="hidden" name="toStatus" value={toStatus} />
      <ReasonField id={`wall-transition-${wall.id}`} label={toStatus === 'active' ? 'Reason for activating' : 'Reason for lifting'} />
      <FormFooter state={state} pending={pending} label={toStatus === 'active' ? 'Activate wall' : 'Lift wall'} danger={toStatus === 'lifted'} />
    </form>
  )
}

function WallMemberForm({ matterId, wallId }: { matterId: string; wallId: string }) {
  const [state, action, pending] = useCommand(setMatterWallMember)
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="matterId" value={matterId} />
      <input type="hidden" name="wallId" value={wallId} />
      <div className="sm:col-span-2"><SearchableOptionSelect id={`wall-user-${wallId}`} name="userId" label="Member" emptyLabel="Choose a member" required kind="member" options={[]} /></div>
      <ChoiceTrack name="decision" label="Decision" defaultValue="blocked" options={[['blocked', 'Blocked'], ['allowed', 'Allowed']]} className="sm:col-span-2" />
      <ReasonField id={`wall-member-reason-${wallId}`} className="sm:col-span-2" />
      <FormFooter state={state} pending={pending} label="Save decision" className="sm:col-span-2" />
    </form>
  )
}

function RevokeWallMemberForm({ matterId, wallId, member }: { matterId: string; wallId: string; member: EthicalWallEntry['members'][number] }) {
  const [state, action, pending] = useCommand(setMatterWallMember)
  if (!member.user) return null
  return (
    <form action={action} className="grid gap-3 pt-3">
      <input type="hidden" name="matterId" value={matterId} />
      <input type="hidden" name="wallId" value={wallId} />
      <input type="hidden" name="userId" value={member.user.id} />
      <input type="hidden" name="decision" value={member.decision} />
      <input type="hidden" name="intent" value="revoke" />
      <ReasonField id={`wall-revoke-${member.id}`} label="Reason for revoking" />
      <FormFooter state={state} pending={pending} label="Revoke" pendingLabel="Revoking…" danger />
    </form>
  )
}

function WallRow({ matterId, wall }: { matterId: string; wall: EthicalWallEntry }) {
  const [open, setOpen] = useState<'transition' | 'member' | string | null>(null)
  const editable = wall.status !== 'lifted'
  const activeMembers = wall.members.filter((member) => member.status === 'active')
  return (
    <li className="grid gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot tone={statusTone(wall.status)} />
            <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">{wall.name}</h3>
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{statusLabel(wall.status)}</span>
          </div>
          <p className="truncate pl-4 text-xs text-muted-foreground">{activeMembers.filter((member) => member.decision === 'blocked').length} blocked · {activeMembers.filter((member) => member.decision === 'allowed').length} allowed{wall.policyReference ? ` · ${wall.policyReference}` : ''}</p>
        </div>
        {editable ? <Track label={`${wall.name} actions`}>
          <button type="button" onClick={() => setOpen(open === 'member' ? null : 'member')} aria-pressed={open === 'member'} className={trackItemClass(open === 'member')}><Plus className="size-3.5" aria-hidden="true" />Member</button>
          <button type="button" onClick={() => setOpen(open === 'transition' ? null : 'transition')} aria-pressed={open === 'transition'} className={trackItemClass(open === 'transition')}>{wall.status === 'draft' ? 'Activate' : 'Lift'}</button>
        </Track> : null}
      </div>
      {wall.reason ? <p className="pl-4 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{wall.reason}</p> : null}
      {open === 'transition' && editable ? <div className="rounded-lg bg-muted/30 p-3"><WallTransitionForm matterId={matterId} wall={wall} /></div> : null}
      {open === 'member' && editable ? <div className="rounded-lg bg-muted/30 p-3"><WallMemberForm matterId={matterId} wallId={wall.id} /></div> : null}
      {wall.members.length ? <ul className="ml-4 divide-y divide-border rounded-lg border border-border">
        {wall.members.map((member) => <li key={member.id} className="px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot tone={member.status !== 'active' ? 'zinc' : member.decision === 'blocked' ? 'rose' : 'emerald'} />
            <span className="min-w-0 truncate text-sm font-medium text-foreground">{member.user?.name || 'Identity restricted'}</span>
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{member.status === 'active' ? statusLabel(member.decision) : 'Revoked'}</span>
            {editable && member.status === 'active' && member.user ? <Track className="ml-auto"><button type="button" onClick={() => setOpen(open === member.id ? null : member.id)} aria-expanded={open === member.id} className={cn(trackItemClass(open === member.id), 'h-7 px-3 text-xs')}>Revoke</button></Track> : null}
          </div>
          {open === member.id ? <RevokeWallMemberForm matterId={matterId} wallId={wall.id} member={member} /> : null}
        </li>)}
      </ul> : null}
    </li>
  )
}

export function EthicalWallsPanel({ matterId, walls }: { matterId: string; walls: EthicalWallEntry[] | null }) {
  const [creating, setCreating] = useState(false)
  if (!walls) return <Panel title="Ethical walls"><EmptyState title="Ethical walls are unavailable to your role" /></Panel>
  return (
    <Panel
      id="ethical-walls"
      title={<Count title="Ethical walls" count={walls.filter((wall) => wall.status !== 'lifted').length} />}
      actions={<Track><button type="button" onClick={() => setCreating(!creating)} aria-pressed={creating} className={trackItemClass(creating)}><Plus className="size-3.5" aria-hidden="true" />New wall</button></Track>}
      bodyClassName="p-0"
    >
      {creating ? <div className="border-b border-border p-4"><CreateWallForm matterId={matterId} onDone={() => setCreating(false)} /></div> : null}
      {walls.length ? <ul className="divide-y divide-border">{walls.map((wall) => <WallRow key={wall.id} matterId={matterId} wall={wall} />)}</ul> : <div className="p-4"><EmptyState title="No ethical walls" /></div>}
    </Panel>
  )
}

export function ConfidentialityPanel({ matterId, confidentiality }: { matterId: string; confidentiality: string }) {
  const [state, action, pending] = useCommand(changeConfidentiality)
  const target = confidentiality === 'restricted' ? 'standard' : 'restricted'
  return (
    <Panel id="confidentiality" title={<div className="flex min-w-0 items-center gap-2"><StatusDot tone={confidentiality === 'restricted' ? 'amber' : 'emerald'} /><h2 className="text-sm font-semibold text-foreground">Confidentiality</h2><span className="text-xs text-muted-foreground">{statusLabel(confidentiality)}</span></div>}>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="matterId" value={matterId} />
        <ChoiceTrack key={confidentiality} name="confidentiality" label="Level" defaultValue={target} options={[['standard', 'Standard'], ['restricted', 'Restricted']]} />
        <ReasonField id="confidentiality-reason" minLength={10} />
        <FormFooter state={state} pending={pending} label="Change confidentiality" />
      </form>
    </Panel>
  )
}

export function StatusHistoryList({ history, timeZone }: { history: Array<{ id: string; fromStatus: string | null; toStatus: string; action: string | null; reason: string | null; occurredAt: string | null; actorUser: { name: string | null } | null }> | null; timeZone: string }) {
  const format = (value: string | null) => {
    if (!value) return 'No date'
    try { return new Intl.DateTimeFormat('en', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) } catch { return value }
  }
  return (
    <Panel id="status-history" title={<Count title="Status history" count={history?.length ?? 0} />} bodyClassName="p-0">
      {!history ? <div className="p-4"><EmptyState title="Status history is unavailable to your role" /></div> : history.length ? (
        <ol className="divide-y divide-border">
          {history.map((event) => <li key={event.id} className="grid gap-0.5 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <StatusDot tone={statusTone(event.toStatus)} />
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">{event.fromStatus ? `${statusLabel(event.fromStatus)} → ` : ''}{statusLabel(event.toStatus)}</span>
              <span className="ml-auto shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">{format(event.occurredAt)}</span>
            </div>
            <p className={cn('pl-4 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]')}>{[event.actorUser?.name, event.action ? statusLabel(event.action) : null, event.reason].filter(Boolean).join(' · ') || 'System'}</p>
          </li>)}
        </ol>
      ) : <div className="p-4"><EmptyState title="No status changes yet" /></div>}
    </Panel>
  )
}
