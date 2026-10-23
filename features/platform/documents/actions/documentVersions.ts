'use server'

import { createHash, randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import { documentDownloadUrl, documentStorageConfigured, putDocumentObject } from '../lib/documentStorage'

export type VersionUploadState = { ok: boolean; message: string; revision: number }

export type DocumentVersionRow = { id: string; versionNumber: number | null; fileName: string | null; mediaType: string | null; byteSize: number | null; createdAt: string | null; downloadUrl: string | null }

const MAX_BYTES = 9 * 1024 * 1024

export async function getDocumentVersions(documentId: string): Promise<{ storage: boolean; currentVersionId: string | null; versions: DocumentVersionRow[] } | null> {
  const response = await keystoneClient<{ document: { firm: { id: string } | null; currentVersion: { id: string } | null; versions: Array<Omit<DocumentVersionRow, 'downloadUrl'> & { objectKey: string | null }> } | null }>(`
    query DocumentVersions($id: ID!) { document(where: { id: $id }) { firm { id } currentVersion { id } versions(orderBy: [{ versionNumber: desc }], take: 25) { id versionNumber fileName mediaType byteSize createdAt objectKey } } }
  `, { id: documentId })
  if (!response.success || !response.data.document) return null
  const document = response.data.document
  const versions = await Promise.all(document.versions.map(async ({ objectKey, ...version }) => ({
    ...version,
    // Only keys this workspace wrote under the firm/document prefix are signed for download.
    downloadUrl: objectKey && document.firm && objectKey.startsWith(`firms/${document.firm.id}/documents/${documentId}/`) ? await documentDownloadUrl(objectKey, version.fileName ?? 'document').catch(() => null) : null,
  })))
  return { storage: documentStorageConfigured(), currentVersionId: document.currentVersion?.id ?? null, versions }
}

/** Upload a file to the firm bucket, then record it through the controlled version command. */
export async function uploadDocumentVersion(previous: VersionUploadState, formData: FormData): Promise<VersionUploadState> {
  const revision = previous.revision + 1
  const documentId = String(formData.get('documentId') ?? '').trim()
  const file = formData.get('file')
  if (!documentId) return { ok: false, message: 'Document is missing.', revision }
  if (!(file instanceof File) || !file.size) return { ok: false, message: 'Choose a file.', revision }
  if (file.size > MAX_BYTES) return { ok: false, message: 'Files must be 9 MB or smaller.', revision }
  if (!documentStorageConfigured()) return { ok: false, message: 'File storage is not configured for this workspace.', revision }
  const firm = await keystoneClient<{ document: { id: string; firm: { id: string } | null } | null }>(`query DocFirm($id: ID!) { document(where: { id: $id }) { id firm { id } } }`, { id: documentId })
  if (!firm.success || !firm.data.document?.firm) return { ok: false, message: 'This document is unavailable.', revision }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const checksumSha256 = createHash('sha256').update(bytes).digest('hex')
  const fileName = file.name.replace(/[\\/\u0000-\u001f\u007f]+/g, '_').slice(0, 255) || 'document'
  const extension = (fileName.match(/\.([A-Za-z0-9]{1,10})$/)?.[1] ?? 'bin').toLowerCase()
  const objectKey = `firms/${firm.data.document.firm.id}/documents/${documentId}/${checksumSha256.slice(0, 16)}-${randomUUID()}.${extension}`
  const mediaType = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/.test(file.type.toLowerCase()) ? file.type.toLowerCase() : 'application/octet-stream'
  try {
    await putDocumentObject(objectKey, bytes, mediaType)
  } catch {
    return { ok: false, message: 'The file could not be stored. Nothing was recorded.', revision }
  }
  const result = await keystoneClient<{ ingestDocumentVersion: { version: { versionNumber: number } } }>(`
    mutation RecordVersion($documentId: ID!, $idempotencyKey: String!, $fileName: String!, $objectKey: String!, $mediaType: String!, $byteSize: Int!, $checksumSha256: String!, $notes: String, $makeCurrent: Boolean) {
      ingestDocumentVersion(documentId: $documentId, idempotencyKey: $idempotencyKey, fileName: $fileName, objectKey: $objectKey, mediaType: $mediaType, byteSize: $byteSize, checksumSha256: $checksumSha256, source: upload, notes: $notes, makeCurrent: $makeCurrent) { version { versionNumber } }
    }
  `, { documentId, idempotencyKey: randomUUID(), fileName, objectKey, mediaType, byteSize: file.size, checksumSha256, notes: String(formData.get('notes') ?? '').trim().slice(0, 2000) || null, makeCurrent: formData.get('makeCurrent') === 'on' })
  if (!result.success) return { ok: false, message: 'The file was stored but the version was not recorded. Document management permission is required, and the document must not be archived or on hold.', revision }
  revalidatePath(`/dashboard/platform/documents/document/${documentId}`)
  revalidatePath('/dashboard/platform/documents')
  revalidatePath('/dashboard/platform/portal')
  return { ok: true, message: `Version ${result.data.ingestDocumentVersion.version.versionNumber} recorded.`, revision }
}
