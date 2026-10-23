'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

type ContactImportRow = {
  sourceId?: string
  contactType?: string
  firstName?: string
  lastName?: string
  organizationName?: string
  email?: string
  phone?: string
  status?: string
}

type ContactImportPreview = {
  valid: boolean
  rowCount: number
  errorCount: number
  digest: string
  rows: Array<{
    rowNumber: number
    valid: boolean
    errors: string[]
    normalized: Required<ContactImportRow>
  }>
}

type ContactImportResult = {
  importedCount: number
  contactIds: string[]
  replayed: boolean
}

type PracticeExportResult = {
  scope: string
  rowCount: number
  digest: string
  contacts: Array<Record<string, string | number | null>>
  matters: Array<Record<string, string | number | null>>
  timeEntries: Array<Record<string, string | number | boolean | null>>
  invoices: Array<Record<string, string | number | null>>
  auditEvents: Array<Record<string, string | null>>
  replayed: boolean
}

export type DataTransferState = {
  ok: boolean
  message: string
  result?: ContactImportPreview | ContactImportResult | PracticeExportResult
}

const previewMutation = `
  query PreviewContactImport($rows: [ContactImportRowInput!]!) {
    previewContactImport(rows: $rows) {
      valid rowCount errorCount digest
      rows {
        rowNumber valid errors
        normalized { sourceId contactType firstName lastName organizationName email phone status }
      }
    }
  }
`
const applyMutation = `
  mutation ApplyContactImport($connectionId: ID!, $idempotencyKey: String!, $rows: [ContactImportRowInput!]!) {
    applyContactImport(connectionId: $connectionId, idempotencyKey: $idempotencyKey, rows: $rows) {
      importedCount contactIds replayed
    }
  }
`
const exportMutation = `
  mutation PreparePracticeExport($scope: String!, $idempotencyKey: String!, $limit: Int) {
    preparePracticeExport(scope: $scope, idempotencyKey: $idempotencyKey, limit: $limit) {
      scope rowCount digest replayed
      contacts { id contactType status firstName lastName organizationName primaryEmail primaryPhone updatedAt }
      matters { id matterNumber title status confidentiality clientId officeId practiceAreaId responsibleAttorneyId openedAt closedAt updatedAt }
      timeEntries { id matterId userId status workDate durationMinutes description isBillable rateMinor amountMinor currencyCode }
      invoices { id matterId clientId invoiceNumber status currencyCode subtotalMinor discountMinor taxMinor totalMinor paidMinor balanceDueMinor issuedAt dueAt updatedAt }
      auditEvents { eventId eventType category outcome actorType matterId occurredAt }
    }
  }
`

function parseRows(value: FormDataEntryValue | null): ContactImportRow[] {
  const source = String(value ?? '')
  if (!source || source.length > 750_000) throw new Error('Import JSON is required and must be 750 KB or smaller.')
  const parsed: unknown = JSON.parse(source)
  if (!Array.isArray(parsed)) throw new Error('Import JSON must be an array of contact rows.')
  const fields = ['sourceId', 'contactType', 'firstName', 'lastName', 'organizationName', 'email', 'phone', 'status'] as const
  return parsed.map((candidate) => {
    const sourceRow = candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : {}
    return Object.fromEntries(fields.flatMap((field) =>
      typeof sourceRow[field] === 'string' ? [[field, sourceRow[field]]] : [],
    )) as ContactImportRow
  })
}

export async function runDataTransfer(
  _previous: DataTransferState,
  formData: FormData,
): Promise<DataTransferState> {
  try {
    const operation = String(formData.get('operation') ?? '')
    if (operation === 'preview' || operation === 'apply') {
      const rows = parseRows(formData.get('rows'))
      const variables: Record<string, unknown> = { rows }
      const query = operation === 'preview' ? previewMutation : applyMutation
      if (operation === 'apply') {
        const connectionId = String(formData.get('connectionId') ?? '').trim()
        const idempotencyKey = String(formData.get('idempotencyKey') ?? '').trim()
        if (!connectionId) throw new Error('An active import connection ID is required.')
        if (idempotencyKey.length < 12 || idempotencyKey.length > 160) throw new Error('Idempotency key must be 12–160 characters.')
        Object.assign(variables, { connectionId, idempotencyKey })
      }
      const response = await keystoneClient<{
        previewContactImport?: ContactImportPreview
        applyContactImport?: ContactImportResult
      }>(query, variables)
      if (!response.success) return { ok: false, message: response.error.split('\n')[0].slice(0, 500) }
      if (operation === 'apply') revalidatePath('/dashboard/platform/data')
      const result = operation === 'preview'
        ? response.data.previewContactImport
        : response.data.applyContactImport
      if (!result) throw new Error('The data-transfer result was incomplete.')
      return { ok: true, message: operation === 'preview' ? 'Preview completed without writing records.' : 'Import applied through the controlled transaction.', result }
    }

    if (operation === 'export') {
      const scope = String(formData.get('scope') ?? '').trim()
      const idempotencyKey = String(formData.get('idempotencyKey') ?? '').trim()
      const limit = Number(formData.get('limit') ?? 100)
      if (!['contacts', 'matters', 'time_entries', 'invoices', 'audit'].includes(scope)) throw new Error('Unsupported export scope.')
      if (idempotencyKey.length < 12 || idempotencyKey.length > 160) throw new Error('Idempotency key must be 12–160 characters.')
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error('Export limit must be 1–500.')
      const response = await keystoneClient<{
        preparePracticeExport: PracticeExportResult
      }>(exportMutation, { scope, idempotencyKey, limit })
      if (!response.success) return { ok: false, message: response.error.split('\n')[0].slice(0, 500) }
      revalidatePath('/dashboard/platform/data')
      if (response.data.preparePracticeExport.replayed) {
        return { ok: true, message: 'This export key already completed. The audit digest was replayed, but confidential rows are not retained in audit metadata; use a new key for a new snapshot.' }
      }
      return { ok: true, message: 'Export ready. It was logged in the activity log.', result: response.data.preparePracticeExport }
    }

    throw new Error('Unsupported data-transfer operation.')
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Data transfer failed.' }
  }
}
