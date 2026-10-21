'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type IntakeSetup = {
  offices: Array<{ id: string; name: string; code: string }>
  officesCount: number
  memberships: Array<{ user: { id: string; name: string; email: string } }>
  membershipsCount: number
  practiceAreas: Array<{ id: string; name: string }>
  practiceAreasCount: number
  decisionIntakes: Array<{ id: string; intakeNumber: string; title: string; primaryContact: { displayName: string } }>
  decisionIntakesCount: number
  decisionPage: number
  decisionPageCount: number
}

export type IntakeStartState = { ok: boolean; message: string }

const DECISION_PAGE_SIZE = 10

// Selector option lists are bounded previews with full counts; the shared searchable
// selector reaches any further active office, member or practice area. Decision-stage
// intakes page oldest first and only the visible intakes' details are fetched.
export async function getIntakeSetup(requestedDecisionPage = 1) {
  const counts = await keystoneClient<{ decisionIntakesCount: number }>(`query IntakeDecisionCount { decisionIntakesCount: intakesCount(where: { status: { equals: decision } }) }`)
  if (!counts.success) return counts
  const decisionIntakesCount = counts.data.decisionIntakesCount
  const decisionPageCount = Math.max(1, Math.ceil(decisionIntakesCount / DECISION_PAGE_SIZE))
  const decisionPage = Math.min(Math.max(Number.isSafeInteger(requestedDecisionPage) ? requestedDecisionPage : 1, 1), decisionPageCount)
  const response = await keystoneClient<Omit<IntakeSetup, 'decisionIntakesCount' | 'decisionPage' | 'decisionPageCount'>>(`
    query IntakeSetup($decisionSkip: Int!) {
      offices(where: { status: { equals: active } }, orderBy: [{ name: asc }], take: 100) { id name code }
      officesCount(where: { status: { equals: active } })
      memberships: firmMemberships(where: { status: { equals: active } }, orderBy: [{ createdAt: asc }], take: 100) {
        user { id name email }
      }
      membershipsCount: firmMembershipsCount(where: { status: { equals: active } })
      practiceAreas(where: { status: { equals: active } }, orderBy: [{ name: asc }], take: 100) { id name }
      practiceAreasCount(where: { status: { equals: active } })
      decisionIntakes: intakes(where: { status: { equals: decision } }, orderBy: [{ receivedAt: asc }, { id: asc }], take: 10, skip: $decisionSkip) {
        id intakeNumber title primaryContact { displayName }
      }
    }
  `, { decisionSkip: (decisionPage - 1) * DECISION_PAGE_SIZE })
  if (!response.success) return response
  return { success: true as const, data: { ...response.data, decisionIntakesCount, decisionPage, decisionPageCount } }
}

export async function convertIntake(_previous: IntakeStartState, formData: FormData): Promise<IntakeStartState> {
  const values = {
    intakeId: String(formData.get('intakeId') ?? '').trim(),
    matterNumber: String(formData.get('matterNumber') ?? '').trim(),
    title: String(formData.get('matterTitle') ?? '').trim(),
    responsibleAttorneyId: String(formData.get('responsibleAttorneyId') ?? '').trim(),
    officeId: String(formData.get('conversionOfficeId') ?? '').trim() || null,
    practiceAreaId: String(formData.get('practiceAreaId') ?? '').trim() || null,
    reason: String(formData.get('conversionReason') ?? '').trim(),
  }
  if (!values.intakeId || !values.matterNumber || !values.title || !values.responsibleAttorneyId || values.reason.length < 10) {
    return { ok: false, message: 'Intake, matter number, title, responsible attorney, and a 10-character reason are required.' }
  }
  const response = await keystoneClient<{ convertIntakeToMatter: { matter: { id: string; matterNumber: string; status: string }; replayed: boolean } }>(`
    mutation ConvertIntake(
      $intakeId: ID!
      $matterNumber: String!
      $title: String!
      $responsibleAttorneyId: ID!
      $officeId: ID
      $practiceAreaId: ID
      $reason: String!
    ) {
      convertIntakeToMatter(
        intakeId: $intakeId
        matterNumber: $matterNumber
        title: $title
        responsibleAttorneyId: $responsibleAttorneyId
        officeId: $officeId
        practiceAreaId: $practiceAreaId
        reason: $reason
      ) { matter { id matterNumber status } replayed }
    }
  `, values)
  if (!response.success) return { ok: false, message: response.error }
  revalidatePath('/dashboard/platform/intake')
  revalidatePath('/dashboard/platform/matters')
  revalidatePath('/dashboard')
  return { ok: true, message: `${response.data.convertIntakeToMatter.matter.matterNumber} created through the atomic conversion workflow.` }
}

export async function startIntake(_previous: IntakeStartState, formData: FormData): Promise<IntakeStartState> {
  const values = {
    contactType: String(formData.get('contactType') ?? ''),
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    organizationName: String(formData.get('organizationName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    title: String(formData.get('title') ?? ''),
    source: String(formData.get('source') ?? 'other'),
    summary: String(formData.get('summary') ?? ''),
    adversePartySummary: String(formData.get('adversePartySummary') ?? ''),
    officeId: String(formData.get('officeId') ?? '') || null,
    assignedToId: String(formData.get('assignedToId') ?? '') || null,
  }
  const response = await keystoneClient<{ startClientIntake: { intake: { id: string; intakeNumber: string }; conflictCheck: { id: string; checkNumber: string } } }>(`
    mutation StartClientIntake(
      $contactType: String!
      $firstName: String
      $lastName: String
      $organizationName: String
      $email: String
      $phone: String
      $title: String!
      $source: String
      $summary: String
      $adversePartySummary: String
      $officeId: ID
      $assignedToId: ID
    ) {
      startClientIntake(
        contactType: $contactType
        firstName: $firstName
        lastName: $lastName
        organizationName: $organizationName
        email: $email
        phone: $phone
        title: $title
        source: $source
        summary: $summary
        adversePartySummary: $adversePartySummary
        officeId: $officeId
        assignedToId: $assignedToId
      ) { intake { id intakeNumber } conflictCheck { id checkNumber } }
    }
  `, values)
  if (!response.success) return { ok: false, message: response.error }
  revalidatePath('/dashboard/platform/intake')
  revalidatePath('/dashboard')
  return {
    ok: true,
    message: `${response.data.startClientIntake.intake.intakeNumber} created with conflict check ${response.data.startClientIntake.conflictCheck.checkNumber}.`,
  }
}
