'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { FormSelect } from '@/components/ui/form-select'
import { Search } from 'lucide-react'

import { SearchableOptionSelect } from '@/features/platform/components/SearchableOptionSelect'
import {
  EmptyState,
  Notice,
  Pager,
  Panel,
  RowList,
  SectionHeader,
  StatusText,
  TitleLine,
  Track,
  fieldClass,
  labelClass,
  pillClass,
  pillPrimaryClass,
  trackItemClass,
} from '@/features/platform/components/ui'
import {
  addStandardRoles,
  changeStaffAccess,
  inviteStaff,
  resendStaffSetupLink,
  type MemberAccessState,
  type StandardRolesState,
  type StaffInviteState,
  type TeamSetup,
} from '../actions/inviteStaff'
import { useKeptForm } from '../../components/useKeptForm'

export function StaffInvitationPanel({ setup }: { setup: TeamSetup }) {
  const initial: StaffInviteState = {
    message: null,
    success: null,
    // Role starts unselected: inviting someone always requires a deliberate role choice.
    values: { name: '', email: '', roleId: '', officeId: '' },
  }
  const [state, action, pending] = useActionState(inviteStaff, initial)
  const actionForm = useKeptForm(action, state)

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <aside className="min-w-0 xl:sticky xl:top-20 xl:order-last">
        <Panel title="Invite staff member">
          <form {...actionForm} className="space-y-4">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Field id="name" label="Name" defaultValue={state.values.name} autoComplete="name" />
              <Field id="email" label="Work email" defaultValue={state.values.email} type="email" autoComplete="email" />
              <SearchableOptionSelect key={`role-${state.success ?? ''}`} id="roleId" name="roleId" label="Role" emptyLabel="Select a role" required kind="role" total={setup.rolesCount} options={setup.roles.map((role) => ({ value: role.id, label: role.name }))} />
              <SearchableOptionSelect key={`office-${state.success ?? ''}`} id="officeId" name="officeId" label="Primary office" emptyLabel="No primary office" kind="office" total={setup.officesCount} options={setup.offices.map((office) => ({ value: office.id, label: `${office.name} · ${office.code}` }))} />
            </div>

            {!setup.roles.length ? <Notice>No roles yet. Add the standard roles below.</Notice> : null}
            {state.message ? (
              <p role="alert" className="rounded-[4px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{state.message}</p>
            ) : state.success ? (
              <p role="status" className="rounded-[4px] border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{state.success}</p>
            ) : null}

            <Track>
              <button type="submit" className={pillPrimaryClass} disabled={pending || !setup.roles.length}>{pending ? 'Creating invitation…' : 'Create invitation'}</button>
            </Track>
          </form>
          <StandardRolesControl missing={setup.missingStandardRoles ?? []} />
        </Panel>
      </aside>

      <section aria-labelledby="firm-members-heading" className="min-w-0 scroll-mt-20 space-y-3">
        <SectionHeader id="firm-members-heading" title="Firm memberships" count={setup.membershipsCount} />
        <form method="get" action="/dashboard/platform/team" role="search" aria-label="Find a firm member" className="flex min-w-0 flex-wrap items-center gap-2">
          <input name="memberQ" type="search" defaultValue={setup.memberQuery} maxLength={100} aria-label="Member name" placeholder="Search by name" className={`${fieldClass} max-w-sm flex-1 basis-48`} />
          <Track>
            <button type="submit" className={pillClass}><Search className="size-4" aria-hidden="true" />Search</button>
            {setup.memberQuery ? <Link href="/dashboard/platform/team" className={trackItemClass(false)}>Clear</Link> : null}
          </Track>
        </form>

        {setup.memberships.length ? (
          <RowList label="Firm memberships">
            {setup.memberships.map((membership) => (
              <li key={membership.id} className="min-w-0 px-4 py-3">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1 basis-56">
                    <TitleLine as="h3" status={membership.status} headingClassName="text-sm">{membership.user.name}</TitleLine>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{membership.user.email}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{membership.role.name}{membership.office ? ` · ${membership.office.name}` : ''}</p>
                  </div>
                  {membership.user.status !== membership.status ? <StatusText status={membership.user.status} className="pt-0.5" /> : null}
                </div>
                {membership.status === 'invited' && membership.user.status === 'invited' ? <ResendSetupLink membershipId={membership.id} /> : null}
                <MembershipControl membership={membership} setup={setup} />
              </li>
            ))}
          </RowList>
        ) : (
          <EmptyState title={setup.memberQuery ? 'No firm member matches that name.' : 'No firm memberships are visible.'} />
        )}

        {setup.memberPageCount > 1 ? (
          <Pager
            label="Firm membership pages"
            summary={`Page ${setup.memberPage} of ${setup.memberPageCount}`}
            previous={setup.memberPage > 1 ? memberPageHref(setup, setup.memberPage - 1) : null}
            next={setup.memberPage < setup.memberPageCount ? memberPageHref(setup, setup.memberPage + 1) : null}
          />
        ) : null}
      </section>
    </div>
  )
}

function StandardRolesControl({ missing }: { missing: string[] }) {
  const [state, action, pending] = useActionState(addStandardRoles, { message: null, success: null } as StandardRolesState)
  const actionForm = useKeptForm(action, state)
  if (!missing.length && !state.success) return null
  return (
    <form {...actionForm} className="mt-4 space-y-2 border-t border-border pt-4">
      {missing.length ? <>
        <p className="text-xs text-muted-foreground">Missing standard roles: {missing.join(', ')}</p>
        <Track><button type="submit" className={pillClass} disabled={pending}>{pending ? 'Adding roles…' : 'Add standard roles'}</button></Track>
      </> : null}
      {state.message ? <p role="alert" className="text-xs text-destructive">{state.message}</p> : null}
      {state.success ? <p role="status" className="text-xs text-foreground">{state.success}</p> : null}
    </form>
  )
}

function memberPageHref(setup: TeamSetup, page: number) {
  const params = new URLSearchParams({ memberPage: String(page) })
  if (setup.memberQuery) params.set('memberQ', setup.memberQuery)
  return `/dashboard/platform/team?${params.toString()}#firm-members-heading`
}

function ResendSetupLink({ membershipId }: { membershipId: string }) {
  const [state, action, pending] = useActionState(resendStaffSetupLink, { message: null, success: null } as MemberAccessState)
  const actionForm = useKeptForm(action, state)
  return (
    <form {...actionForm} className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
      <input type="hidden" name="membershipId" value={membershipId} />
      <Track><button type="submit" className={pillClass} disabled={pending}>{pending ? 'Sending…' : 'Resend setup link'}</button></Track>
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
  const actionForm = useKeptForm(action, state)
  const [officeValue, setOfficeValue] = useState('__unchanged__')
  return (
    <details className="group mt-3">
      <summary className="inline-flex cursor-pointer list-none items-center text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Change access</span><span className="hidden group-open:inline">Close access change</span>
      </summary>
      <form {...actionForm} className="mt-3 grid min-w-0 gap-3 rounded-[4px] border border-border bg-muted/30 p-3 sm:grid-cols-2 2xl:grid-cols-4 2xl:items-end">
        <input type="hidden" name="membershipId" value={membership.id} />
        <SearchableOptionSelect id={`role-${membership.id}`} name="roleId" label="New role" emptyLabel="Keep current role" kind="role" total={setup.rolesCount} options={setup.roles.map((role) => ({ value: role.id, label: role.name }))} />
        <SearchableOptionSelect id={`office-${membership.id}`} name="officeId" label="New primary office" kind="office" emptyLabel="No primary office" value={officeValue} onValueChange={setOfficeValue} total={setup.officesCount + 2} options={[{ value: '__unchanged__', label: membership.office ? `Keep current office · ${membership.office.name}` : 'Keep current · no primary office' }, ...(membership.office ? [{ value: membership.office.id, label: `${membership.office.name} · current office` }] : []), ...setup.offices.map((office) => ({ value: office.id, label: `${office.name} · ${office.code}` }))]} />
        <MiniSelect id={`status-${membership.id}`} name="toStatus" label="New status" defaultValue="" options={[{ value: '', label: 'Keep current status' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'ended', label: 'Ended' }]} />
        <label htmlFor={`reason-${membership.id}`} className={labelClass}>
          Reason
          <input id={`reason-${membership.id}`} name="reason" className={fieldClass} minLength={3} maxLength={2000} required placeholder="Access change reason" />
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:col-span-2 2xl:col-span-4">
          <Track><button type="submit" className={pillPrimaryClass} disabled={pending}>{pending ? 'Updating…' : 'Update access'}</button></Track>
          {state.message ? <p role="alert" className="text-xs text-destructive">{state.message}</p> : null}
          {state.success ? <p role="status" className="text-xs text-foreground">{state.success}</p> : null}
        </div>
      </form>
    </details>
  )
}

function MiniSelect({ id, name, label, defaultValue, options }: { id: string; name: string; label: string; defaultValue: string; options: Array<{ value: string; label: string }> }) {
  return (
    <div className={labelClass}>
      <label htmlFor={id}>{label}</label>
      <FormSelect id={id} name={name} defaultValue={defaultValue} className={fieldClass}>
        {options.map((option) => <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>)}
      </FormSelect>
    </div>
  )
}

function Field({ id, label, defaultValue, type = 'text', autoComplete }: { id: string; label: string; defaultValue: string; type?: string; autoComplete?: string }) {
  return (
    <label htmlFor={id} className={labelClass}>
      {label}
      <input id={id} name={id} type={type} className={fieldClass} defaultValue={defaultValue} autoComplete={autoComplete} required />
    </label>
  )
}
