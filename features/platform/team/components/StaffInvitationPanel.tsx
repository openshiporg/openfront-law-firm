/* Hallmark · pre-emit critique: P5 H4 E4 S5 R5 V4 · audience: firm administrators · use: issue controlled staff invitations · tone: technical/austere · genre: modern-minimal · macrostructure: Operator ledger · theme: Quiet */
'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { FormSelect } from '@/components/ui/form-select'
import { CheckCircle2, MailWarning, Search, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PracticeStatus } from '@/features/platform/components/PracticeSurface'
import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import {
  changeStaffAccess,
  inviteStaff,
  resendStaffSetupLink,
  type MemberAccessState,
  type StaffInviteState,
  type TeamSetup,
} from '../actions/inviteStaff'

export function StaffInvitationPanel({ setup }: { setup: TeamSetup }) {
  const initial: StaffInviteState = {
    message: null,
    success: null,
    // Role starts unselected: inviting someone always requires a deliberate role choice.
    values: { name: '', email: '', roleId: '', officeId: '' },
  }
  const [state, action, pending] = useActionState(inviteStaff, initial)

  return (
    <div className="space-y-8">
      <form action={action} className="border-y border-border py-5">
        <div className="flex items-start gap-3">
          <UserPlus className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold text-foreground">Invite a staff member</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Name" defaultValue={state.values.name} autoComplete="name" />
          <Field id="email" label="Work email" defaultValue={state.values.email} type="email" autoComplete="email" />
          <SearchableOptionSelect key={`role-${state.success ?? ''}`} id="roleId" name="roleId" label="Role" emptyLabel="Select a role" required kind="role" total={setup.rolesCount} options={setup.roles.map((role) => ({ value: role.id, label: role.name }))} />
          <SearchableOptionSelect key={`office-${state.success ?? ''}`} id="officeId" name="officeId" label="Primary office" emptyLabel="No primary office" kind="office" total={setup.officesCount} options={setup.offices.map((office) => ({ value: office.id, label: `${office.name} · ${office.code}` }))} />
        </div>

        <div className="mt-4 min-h-12">
          {state.message ? (
            <div role="alert" className="flex items-start gap-2 border-y border-destructive/30 px-2 py-3 text-sm text-destructive">
              <MailWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {state.message}
            </div>
          ) : state.success ? (
            <div role="status" className="flex items-start gap-2 border-y border-border bg-muted/20 px-2 py-3 text-sm text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {state.success}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="submit" className="min-h-11 whitespace-nowrap" disabled={pending || !setup.roles.length}>{pending ? 'Creating invitation…' : 'Create invitation'}</Button>
        </div>
      </form>

      <section aria-labelledby="firm-members-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="firm-members-heading" className="text-base font-bold text-foreground">Firm memberships</h2>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{setup.membershipsCount.toLocaleString()}{setup.memberQuery ? ' matching' : ''}</span>
        </div>
        <form method="get" action="/dashboard/platform/team" role="search" aria-label="Find a firm member" className="mt-3 flex max-w-xl gap-2">
          <Input name="memberQ" type="search" defaultValue={setup.memberQuery} maxLength={100} aria-label="Member name" placeholder="Search by name" className="min-h-11" />
          <Button type="submit" variant="outline" className="min-h-11"><Search className="h-4 w-4" aria-hidden="true" />Search</Button>
          {setup.memberQuery ? <Link href="/dashboard/platform/team" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-semibold">Clear</Link> : null}
        </form>
        <div className="mt-4 divide-y divide-border border-y border-border">
          {setup.memberships.map((membership) => (
            <article key={membership.id} className="min-w-0 px-2 py-4">
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-foreground">{membership.user.name}</h3>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{membership.user.email} · {membership.role.name}{membership.office ? ` · ${membership.office.name}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-2"><PracticeStatus status={membership.status} /><PracticeStatus status={membership.user.status} /></div>
              </div>
              <MembershipControl membership={membership} setup={setup} />
              {membership.status === 'invited' && membership.user.status === 'invited' ? <ResendSetupLink membershipId={membership.id} /> : null}
            </article>
          ))}
          {!setup.memberships.length ? <p className="px-2 py-8 text-sm text-muted-foreground">{setup.memberQuery ? 'No firm member matches that name.' : 'No firm memberships are visible.'}</p> : null}
        </div>
        {setup.memberPageCount > 1 ? (
          <nav aria-label="Firm membership pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Page {setup.memberPage} of {setup.memberPageCount}</p>
            <div className="flex gap-2">
              {setup.memberPage > 1 ? <Link href={memberPageHref(setup, setup.memberPage - 1)} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-semibold">Previous</Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">Previous</span>}
              {setup.memberPage < setup.memberPageCount ? <Link href={memberPageHref(setup, setup.memberPage + 1)} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs font-semibold">Next</Link> : <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">Next</span>}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  )
}

function memberPageHref(setup: TeamSetup, page: number) {
  const params = new URLSearchParams({ memberPage: String(page) })
  if (setup.memberQuery) params.set('memberQ', setup.memberQuery)
  return `/dashboard/platform/team?${params.toString()}#firm-members-heading`
}

function ResendSetupLink({ membershipId }: { membershipId: string }) {
  const [state, action, pending] = useActionState(resendStaffSetupLink, { message: null, success: null } as MemberAccessState)
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="membershipId" value={membershipId} />
      <Button type="submit" variant="outline" className="min-h-11" disabled={pending}>{pending ? 'Sending…' : 'Resend setup link'}</Button>
      {state.message ? <p role="alert" className="text-xs text-destructive">{state.message}</p> : null}
      {state.success ? <p role="status" className="text-xs text-foreground">{state.success}</p> : null}
    </form>
  )
}

function MembershipControl({
  membership,
  setup,
}: {
  membership: TeamSetup['memberships'][number]
  setup: TeamSetup
}) {
  const initial: MemberAccessState = { message: null, success: null }
  const [state, action, pending] = useActionState(changeStaffAccess, initial)
  const [officeValue, setOfficeValue] = useState('__unchanged__')
  return (
    <form action={action} className="mt-4 grid min-w-0 gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,1.4fr)_auto] xl:items-end">
      <input type="hidden" name="membershipId" value={membership.id} />
      <SearchableOptionSelect id={`role-${membership.id}`} name="roleId" label="New role" emptyLabel="Keep current role" kind="role" total={setup.rolesCount} options={setup.roles.map((role) => ({ value: role.id, label: role.name }))} />
      <SearchableOptionSelect id={`office-${membership.id}`} name="officeId" label="New primary office" kind="office" emptyLabel="No primary office" value={officeValue} onValueChange={setOfficeValue} total={setup.officesCount + 2} options={[{ value: '__unchanged__', label: membership.office ? `Keep current office · ${membership.office.name}` : 'Keep current · no primary office' }, ...(membership.office ? [{ value: membership.office.id, label: `${membership.office.name} · current office` }] : []), ...setup.offices.map((office) => ({ value: office.id, label: `${office.name} · ${office.code}` }))]} />
      <MiniSelect id={`status-${membership.id}`} name="toStatus" label="New status" defaultValue="" options={[{ value: '', label: 'Keep current status' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'ended', label: 'Ended' }]} />
      <div className="space-y-2">
        <Label htmlFor={`reason-${membership.id}`}>Reason</Label>
        <Input id={`reason-${membership.id}`} name="reason" className="min-h-11" minLength={3} maxLength={2000} required placeholder="Access change reason" />
      </div>
      <Button type="submit" variant="outline" className="min-h-11 whitespace-nowrap" disabled={pending}>{pending ? 'Updating…' : 'Update access'}</Button>
      <div className="min-h-6 text-xs sm:col-span-2 xl:col-span-5">
        {state.message ? <p role="alert" className="text-destructive">{state.message}</p> : null}
        {state.success ? <p role="status" className="text-foreground">{state.success}</p> : null}
      </div>
    </form>
  )
}

function MiniSelect({ id, name, label, defaultValue, options }: { id: string; name: string; label: string; defaultValue: string; options: Array<{ value: string; label: string }> }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <FormSelect id={id} name={name} defaultValue={defaultValue} className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50">
        {options.map((option) => <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>)}
      </FormSelect>
    </div>
  )
}

function Field({ id, label, defaultValue, type = 'text', autoComplete }: { id: string; label: string; defaultValue: string; type?: string; autoComplete?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} className="min-h-11" defaultValue={defaultValue} autoComplete={autoComplete} required />
    </div>
  )
}
