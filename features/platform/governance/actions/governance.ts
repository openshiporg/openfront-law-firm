'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type GovernanceActionState = { ok: boolean; message: string }

export type RetentionPolicyRow = {
  id: string
  name: string
  code: string
  status: string
  recordClass: string
  trigger: string
  retentionDays: number
  description: string | null
  jurisdictionReference: string | null
  practiceArea: { id: string; name: string } | null
  holdsCount: number
  documentsCount: number
}

export type GovernanceSetup = {
  policies: RetentionPolicyRow[]
  practiceAreas: Array<{ id: string; name: string }>
}

export type HoldTargetKind = 'matter' | 'document' | 'contact'
export type HoldTargetOption = { value: string; label: string }

const ID = /^[A-Za-z0-9_-]{1,200}$/
const RECORD_CLASSES = ['matter', 'document', 'communication', 'billing', 'contact', 'audit', 'other']
const TRIGGERS = ['matter_closed', 'document_archived', 'record_created', 'manual']
const POLICY_TRANSITIONS: Record<string, string[]> = { draft: ['active', 'retired'], active: ['retired'], retired: [] }

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function revalidateGovernance() {
  revalidatePath('/dashboard/platform/governance')
}

export async function getGovernanceSetup(): Promise<{ success: true; data: GovernanceSetup } | { success: false; error: string }> {
  const response = await keystoneClient<GovernanceSetup>(`
    query GovernanceSetup {
      policies: retentionPolicies(orderBy: [{ name: asc }, { id: asc }], take: 100) {
        id name code status recordClass trigger retentionDays description jurisdictionReference
        practiceArea { id name } holdsCount documentsCount
      }
      practiceAreas(where: { status: { equals: active } }, orderBy: [{ name: asc }], take: 100) { id name }
    }
  `)
  if (!response.success) return { success: false, error: 'Retention policies could not be loaded. Check retention permission.' }
  return { success: true, data: { policies: response.data.policies ?? [], practiceAreas: response.data.practiceAreas ?? [] } }
}

type HoldTargetRow = { id: string; matterNumber?: string | null; title?: string | null; status?: string | null; matter?: { matterNumber?: string | null } | null; displayName?: string | null; primaryEmail?: string | null }

const targetQueries: Record<HoldTargetKind, { query: string; where: (q: string) => Record<string, unknown>; map: (row: HoldTargetRow) => HoldTargetOption }> = {
  matter: {
    query: `query HoldMatters($where: MatterWhereInput!) { rows: matters(where: $where, orderBy: [{ matterNumber: asc }, { id: asc }], take: 25) { id matterNumber title status } }`,
    where: (q) => (q ? { OR: [{ matterNumber: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }] } : {}),
    map: (row) => ({ value: row.id, label: `${row.matterNumber}${row.title ? ` · ${row.title}` : ''}${row.status ? ` · ${String(row.status).replaceAll('_', ' ')}` : ''}` }),
  },
  document: {
    query: `query HoldDocuments($where: DocumentWhereInput!) { rows: documents(where: $where, orderBy: [{ createdAt: desc }, { id: asc }], take: 25) { id title status matter { matterNumber } } }`,
    where: (q) => ({ status: { not: { equals: 'disposed' } }, ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}) }),
    map: (row) => ({ value: row.id, label: `${row.title ?? 'Document'}${row.matter?.matterNumber ? ` · ${row.matter.matterNumber}` : ''}` }),
  },
  contact: {
    query: `query HoldContacts($where: ContactWhereInput!) { rows: contacts(where: $where, orderBy: [{ lastName: asc }, { id: asc }], take: 25) { id displayName primaryEmail } }`,
    where: (q) => (q ? { OR: ['firstName', 'lastName', 'organizationName', 'preferredName', 'primaryEmail'].map((key) => ({ [key]: { contains: q, mode: 'insensitive' } })) } : {}),
    map: (row) => ({ value: row.id, label: `${row.displayName ?? 'Contact'}${row.primaryEmail ? ` · ${row.primaryEmail}` : ''}` }),
  },
}

// Bounded, viewer-authorized lookups for a hold target. Unlike the shared practice
// pickers, matters in every status are included: closed matters are common hold targets.
export async function searchHoldTargets(kind: HoldTargetKind, query: string): Promise<{ success: true; data: HoldTargetOption[] } | { success: false; error: string }> {
  const definition = Object.hasOwn(targetQueries, kind) ? targetQueries[kind] : null
  if (!definition) return { success: false, error: 'Unsupported target.' }
  const q = String(query ?? '').trim().slice(0, 100)
  const response = await keystoneClient<{ rows: HoldTargetRow[] }>(definition.query, { where: definition.where(q) })
  if (!response.success) return { success: false, error: 'Search failed. Check your access.' }
  return { success: true, data: (response.data.rows ?? []).map(definition.map).filter((option) => option.value) }
}

export async function createRetentionPolicy(_previous: GovernanceActionState, formData: FormData): Promise<GovernanceActionState> {
  try {
    const name = field(formData, 'name')
    const code = field(formData, 'code')
    const recordClass = field(formData, 'recordClass')
    const trigger = field(formData, 'trigger')
    const retentionDaysText = field(formData, 'retentionDays')
    const practiceAreaId = field(formData, 'practiceAreaId')
    const description = field(formData, 'description')
    const jurisdictionReference = field(formData, 'jurisdictionReference')
    if (name.length < 2 || name.length > 200) return { ok: false, message: 'Name must be between 2 and 200 characters.' }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(code)) return { ok: false, message: 'Code must be 1–64 letters, digits, dots, underscores or hyphens.' }
    if (!RECORD_CLASSES.includes(recordClass)) return { ok: false, message: 'Choose a record class.' }
    if (!TRIGGERS.includes(trigger)) return { ok: false, message: 'Choose a trigger.' }
    if (!/^\d{1,6}$/.test(retentionDaysText)) return { ok: false, message: 'Retention days must be a whole number from 0 to 999,999.' }
    if (practiceAreaId && !ID.test(practiceAreaId)) return { ok: false, message: 'Choose a valid practice area.' }
    if (description.length > 4000) return { ok: false, message: 'Description must be 4,000 characters or fewer.' }
    if (jurisdictionReference.length > 1000) return { ok: false, message: 'Jurisdiction reference must be 1,000 characters or fewer.' }

    const duplicate = await keystoneClient<{ count: number }>(`query PolicyCodeTaken($code: String!) { count: retentionPoliciesCount(where: { code: { equals: $code } }) }`, { code })
    if (duplicate.success && duplicate.data.count > 0) return { ok: false, message: `Code ${code} is already used by another policy.` }

    const response = await keystoneClient<{ createRetentionPolicy: { id: string; name: string } }>(`
      mutation CreateRetentionPolicy($data: RetentionPolicyCreateInput!) { createRetentionPolicy(data: $data) { id name } }
    `, {
      data: {
        name,
        code,
        recordClass,
        trigger,
        retentionDays: Number(retentionDaysText),
        description,
        jurisdictionReference,
        ...(practiceAreaId ? { practiceArea: { connect: { id: practiceAreaId } } } : {}),
      },
    })
    if (!response.success) return { ok: false, message: 'The policy was not created. Check retention permission.' }
    revalidateGovernance()
    return { ok: true, message: `Draft policy ${name} created.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The policy was not created.' }
  }
}

export async function transitionPolicy(_previous: GovernanceActionState, formData: FormData): Promise<GovernanceActionState> {
  try {
    const policyId = field(formData, 'policyId')
    const toStatus = field(formData, 'toStatus')
    const reason = field(formData, 'reason')
    if (!ID.test(policyId)) return { ok: false, message: 'Reload the page and try again.' }
    if (toStatus !== 'active' && toStatus !== 'retired') return { ok: false, message: 'Choose activate or retire.' }
    if (reason.length < 5 || reason.length > 2000) return { ok: false, message: 'Reason must be between 5 and 2,000 characters.' }
    const loaded = await keystoneClient<{ retentionPolicy: { name: string; status: string } | null }>(`query PolicyStatus($id: ID!) { retentionPolicy(where: { id: $id }) { name status } }`, { id: policyId })
    if (!loaded.success || !loaded.data.retentionPolicy) return { ok: false, message: 'Policy was not found.' }
    const policy = loaded.data.retentionPolicy
    if (!(POLICY_TRANSITIONS[policy.status] ?? []).includes(toStatus)) return { ok: false, message: `A ${policy.status} policy cannot become ${toStatus}. Reload the page.` }
    const response = await keystoneClient<{ transitionRetentionPolicy: { id: string; status: string } }>(`
      mutation TransitionRetentionPolicy($policyId: ID!, $toStatus: String!, $reason: String!) {
        transitionRetentionPolicy(policyId: $policyId, toStatus: $toStatus, reason: $reason) { id status }
      }
    `, { policyId, toStatus, reason })
    if (!response.success) return { ok: false, message: 'The policy status was not changed. Check retention permission.' }
    revalidateGovernance()
    return { ok: true, message: `${policy.name} is now ${toStatus}.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The policy status was not changed.' }
  }
}

export async function placeHold(_previous: GovernanceActionState, formData: FormData): Promise<GovernanceActionState> {
  try {
    const targetKind = field(formData, 'targetKind') as HoldTargetKind
    const targetId = field(formData, 'targetId')
    const policyId = field(formData, 'policyId')
    const name = field(formData, 'name')
    const reason = field(formData, 'reason')
    const authorityReference = field(formData, 'authorityReference')
    if (!['matter', 'document', 'contact'].includes(targetKind)) return { ok: false, message: 'Choose what the hold covers.' }
    if (!ID.test(targetId)) return { ok: false, message: `Choose the ${targetKind} to hold.` }
    if (policyId && !ID.test(policyId)) return { ok: false, message: 'Choose a valid policy.' }
    if (name.length < 3 || name.length > 300) return { ok: false, message: 'Hold name must be between 3 and 300 characters.' }
    if (reason.length < 10 || reason.length > 4000) return { ok: false, message: 'Hold reason must be between 10 and 4,000 characters.' }
    if (authorityReference.length > 1000) return { ok: false, message: 'Authority reference must be 1,000 characters or fewer.' }

    if (targetKind === 'document') {
      const doc = await keystoneClient<{ document: { status: string } | null }>(`query HoldDocument($id: ID!) { document(where: { id: $id }) { status } }`, { id: targetId })
      if (!doc.success || !doc.data.document) return { ok: false, message: 'Choose a document you can access.' }
      if (doc.data.document.status === 'disposed') return { ok: false, message: 'A hold cannot be placed on a disposed document.' }
    }

    const response = await keystoneClient<{ placeRetentionHold: { hold: { id: string; status: string } } }>(`
      mutation PlaceRetentionHold($policyId: ID, $matterId: ID, $documentId: ID, $contactId: ID, $name: String!, $reason: String!, $authorityReference: String) {
        placeRetentionHold(policyId: $policyId, matterId: $matterId, documentId: $documentId, contactId: $contactId, name: $name, reason: $reason, authorityReference: $authorityReference) {
          hold { id status }
        }
      }
    `, {
      policyId: policyId || null,
      matterId: targetKind === 'matter' ? targetId : null,
      documentId: targetKind === 'document' ? targetId : null,
      contactId: targetKind === 'contact' ? targetId : null,
      name,
      reason,
      authorityReference: authorityReference || null,
    })
    if (!response.success) return { ok: false, message: 'The hold was not placed. Check retention permission and access to the target.' }
    revalidateGovernance()
    return { ok: true, message: `Legal hold "${name}" placed.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The hold was not placed.' }
  }
}
