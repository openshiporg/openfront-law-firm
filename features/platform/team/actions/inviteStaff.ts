'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { standardFirmRoles, standardRolePermissionData } from '@/features/keystone/mutations/roleWorkflows'

export type StaffInviteState = {
  message: string | null
  success: string | null
  values: { name: string; email: string; roleId: string; officeId: string }
}

export type MemberAccessState = { message: string | null; success: string | null }

export type TeamSetup = {
  /** Standard role names the firm does not have yet (by name, any status). */
  missingStandardRoles?: string[]
  roles: Array<{ id: string; name: string; status: string }>
  rolesCount: number
  offices: Array<{ id: string; name: string; code: string; status: string }>
  officesCount: number
  memberships: Array<{
    id: string
    status: string
    user: { id: string; name: string; email: string; status: string }
    role: { id: string; name: string }
    office?: { id: string; name: string } | null
  }>
  membershipsCount: number
  memberPage: number
  memberPageCount: number
  memberQuery: string
}

const MEMBER_PAGE_SIZE = 25

// The membership directory is searched by name and paged with a full count, so the
// oldest member stays reachable; role and office selectors carry counts for search.
export async function getTeamSetup(requestedPage = 1, query = '') {
  const memberQuery = String(query ?? '').trim().slice(0, 100)
  const where = memberQuery ? { user: { name: { contains: memberQuery, mode: 'insensitive' } } } : {}
  const counts = await keystoneClient<{ membershipsCount: number }>(`query TeamMemberCount($where: FirmMembershipWhereInput!) { membershipsCount: firmMembershipsCount(where: $where) }`, { where })
  if (!counts.success) return counts
  const membershipsCount = counts.data.membershipsCount
  const memberPageCount = Math.max(1, Math.ceil(membershipsCount / MEMBER_PAGE_SIZE))
  const memberPage = Math.min(Math.max(Number.isSafeInteger(requestedPage) ? requestedPage : 1, 1), memberPageCount)
  const response = await keystoneClient<Omit<TeamSetup, 'membershipsCount' | 'memberPage' | 'memberPageCount' | 'memberQuery' | 'missingStandardRoles'> & { allRoleNames: Array<{ name: string }> }>(`
    query TeamSetup($where: FirmMembershipWhereInput!, $skip: Int!) {
      roles(where: { status: { equals: active } }, orderBy: [{ name: asc }], take: 100) { id name status }
      allRoleNames: roles(take: 100) { name }
      rolesCount(where: { status: { equals: active } })
      offices(where: { status: { equals: active } }, orderBy: [{ name: asc }], take: 100) { id name code status }
      officesCount(where: { status: { equals: active } })
      memberships: firmMemberships(where: $where, orderBy: [{ createdAt: desc }, { id: asc }], take: 25, skip: $skip) {
        id status
        user { id name email status }
        role { id name }
        office: primaryOffice { id name }
      }
    }
  `, { where, skip: (memberPage - 1) * MEMBER_PAGE_SIZE })
  if (!response.success) return response
  const { allRoleNames, ...setup } = response.data
  const names = new Set(allRoleNames.map((role) => role.name.trim().toLowerCase()))
  const missingStandardRoles = standardFirmRoles.filter((role) => !names.has(role.name.toLowerCase())).map((role) => role.name)
  return { success: true as const, data: { ...setup, missingStandardRoles, membershipsCount, memberPage, memberPageCount, memberQuery } }
}

// Re-sends the single-use setup link to the invited member's existing email. The
// membership must be visible to the viewer and still pending; no account is created and
// the address cannot be changed here.
export async function resendStaffSetupLink(_previous: MemberAccessState, formData: FormData): Promise<MemberAccessState> {
  const membershipId = String(formData.get('membershipId') ?? '').trim()
  if (!membershipId || membershipId.length > 200) return { message: 'Membership is required.', success: null }
  const membership = await keystoneClient<{ firmMembership: { status: string; user: { email: string; status: string } | null } | null }>(`
    query PendingStaffMember($id: ID!) { firmMembership(where: { id: $id }) { status user { email status } } }
  `, { id: membershipId })
  if (!membership.success) return { message: membership.error, success: null }
  const pending = membership.data.firmMembership
  if (!pending?.user?.email || pending.status !== 'invited' || pending.user.status !== 'invited') {
    return { message: 'Only a pending invitation can receive a new setup link.', success: null }
  }
  const delivery = await keystoneClient<{ sendUserPasswordResetLink: boolean | null }>(`
    mutation ResendStaffSetupLink($email: String!) {
      sendUserPasswordResetLink(email: $email)
    }
  `, { email: pending.user.email })
  if (!delivery.success || delivery.data?.sendUserPasswordResetLink !== true) {
    return { message: 'The setup link could not be sent. Check outbound mail configuration and try again.', success: null }
  }
  return { message: null, success: `A new single-use setup link was sent to ${pending.user.email}; earlier links no longer work.` }
}

export async function changeStaffAccess(
  _previous: MemberAccessState,
  formData: FormData,
): Promise<MemberAccessState> {
  const membershipId = String(formData.get('membershipId') ?? '').trim()
  const roleId = String(formData.get('roleId') ?? '').trim()
  const officeId = String(formData.get('officeId') ?? '').trim()
  const changeOffice = officeId !== '__unchanged__'
  const toStatus = String(formData.get('toStatus') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim()
  if (!membershipId || !reason) return { message: 'Membership and reason are required.', success: null }

  const response = await keystoneClient<{ changeFirmMemberAccess: { id: string; status: string } }>(`
    mutation ChangeFirmMemberAccess(
      $membershipId: ID!
      $roleId: ID
      $officeId: ID
      $changeOffice: Boolean!
      $toStatus: String
      $reason: String!
    ) {
      changeFirmMemberAccess(
        membershipId: $membershipId
        roleId: $roleId
        officeId: $officeId
        changeOffice: $changeOffice
        toStatus: $toStatus
        reason: $reason
      ) { id status }
    }
  `, {
    membershipId,
    roleId: roleId || null,
    officeId: changeOffice ? officeId || null : null,
    changeOffice,
    toStatus: toStatus || null,
    reason,
  })
  if (!response.success) return { message: response.error, success: null }
  revalidatePath('/dashboard/platform/team')
  return { message: null, success: 'Membership access updated.' }
}

export async function inviteStaff(_previous: StaffInviteState, formData: FormData): Promise<StaffInviteState> {
  const values = {
    name: String(formData.get('name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    roleId: String(formData.get('roleId') ?? '').trim(),
    officeId: String(formData.get('officeId') ?? '').trim(),
  }
  if (!values.name || !values.email || !values.roleId) {
    return { message: 'Name, email, and role are required.', success: null, values }
  }

  const invitation = await keystoneClient<{ inviteFirmMember: { userId: string; email: string } }>(`
    mutation InviteFirmMember($name: String!, $email: String!, $roleId: ID!, $officeId: ID) {
      inviteFirmMember(name: $name, email: $email, roleId: $roleId, officeId: $officeId) {
        userId email
        membership { id status }
      }
    }
  `, { ...values, officeId: values.officeId || null })
  if (!invitation.success) return { message: invitation.error, success: null, values }

  revalidatePath('/dashboard/platform/team')

  const delivery = await keystoneClient<{ sendUserPasswordResetLink: boolean | null }>(`
    mutation SendStaffSetupLink($email: String!) {
      sendUserPasswordResetLink(email: $email)
    }
  `, { email: values.email })

  if (!delivery.success || delivery.data?.sendUserPasswordResetLink !== true) {
    return {
      message: 'The invited account and membership were created, but setup-link delivery failed. Use “Resend setup link” on the pending membership below once outbound mail works; do not create a duplicate account.',
      success: null,
      values: { name: '', email: '', roleId: '', officeId: '' },
    }
  }

  // The next invitation starts without a role so a privileged choice is never inherited.
  return {
    message: null,
    success: `Invitation created for ${values.email}. Access activates only after the single-use password setup link is redeemed.`,
    values: { name: '', email: '', roleId: '', officeId: '' },
  }
}

export type StandardRolesState = { message: string | null; success: string | null }

// Creates whichever standard roles (Attorney, Paralegal, Billing, Intake coordinator) the
// active firm lacks, through the Role list (role-management access and the firm-binding
// hook apply). Existing roles with the same name, active or archived, are left alone.
export async function addStandardRoles(_previous: StandardRolesState, _formData: FormData): Promise<StandardRolesState> {
  const existing = await keystoneClient<{ roles: Array<{ name: string }> }>(`
    query FirmRoleNames { roles(take: 100) { name } }
  `)
  if (!existing.success) return { message: 'Roles could not be loaded. Adding roles requires role-management access.', success: null }
  const names = new Set(existing.data.roles.map((role) => role.name.trim().toLowerCase()))
  const missing = standardFirmRoles.filter((role) => !names.has(role.name.toLowerCase()))
  if (!missing.length) return { message: null, success: 'All standard roles are already set up.' }
  const created = await keystoneClient<{ createRoles: Array<{ id: string }> | null }>(`
    mutation AddStandardRoles($data: [RoleCreateInput!]!) { createRoles(data: $data) { id } }
  `, { data: missing.map((role) => ({ name: role.name, status: 'active', ...standardRolePermissionData(role) })) })
  if (!created.success || !created.data.createRoles?.length) {
    return { message: 'The roles could not be added. Adding roles requires role-management access.', success: null }
  }
  revalidatePath('/dashboard/platform/team')
  return { message: null, success: `Added ${missing.map((role) => role.name).join(', ')}.` }
}
