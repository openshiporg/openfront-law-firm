'use server'

import { createHash, randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'
import type { DocumentSignatureSetup, SignatureActionState, SignatureRequestRow } from './signatureTypes'

const MAX_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000
const EMAIL = /^[^\s@<>,;()"]+@[^\s@<>,;()"]+\.[^\s@<>,;()"]+$/
// The backend accepts manual cancellation only; every other outcome waits for provider ingress.
const CANCELLABLE = new Set(['draft', 'sent', 'partially_signed'])

type RawRequest = Omit<SignatureRequestRow, 'versionNumber' | 'connectionName'> & { integrationConnection: { name: string | null } | null }

export async function getDocumentSignatures(documentId: string): Promise<DocumentSignatureSetup | null> {
  const response = await keystoneClient<{ document: { status: string | null; currentVersion: { id: string; versionNumber: number | null; fileName: string | null } | null; versions: Array<{ versionNumber: number | null; signatureRequests: RawRequest[] }> } | null }>(`
    query DocumentSignatures($id: ID!) {
      document(where: { id: $id }) {
        status
        currentVersion { id versionNumber fileName }
        versions(orderBy: [{ versionNumber: desc }], take: 25) {
          versionNumber
          signatureRequests(orderBy: [{ createdAt: desc }], take: 25) {
            id title status provider expiresAt sentAt createdAt
            integrationConnection { name }
            signers(orderBy: [{ signingOrder: asc }, { id: asc }], take: 50) { id name email signingOrder status signedAt }
          }
        }
      }
    }
  `, { id: documentId })
  if (!response.success || !response.data.document) return null
  const document = response.data.document
  const requests = document.versions.flatMap((version) => version.signatureRequests.map(({ integrationConnection, ...request }) => ({ ...request, versionNumber: version.versionNumber, connectionName: integrationConnection?.name ?? null })))
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  // Connection reads need integration permission; without it the request is simply manual.
  const connections = await keystoneClient<{ integrationConnections: Array<{ id: string; name: string; provider: string }> }>(`
    query SignatureConnections { integrationConnections(where: { status: { equals: active }, category: { equals: signature } }, orderBy: [{ name: asc }], take: 25) { id name provider } }
  `)
  return { documentStatus: document.status, currentVersion: document.currentVersion, requests, connections: connections.success ? connections.data.integrationConnections ?? [] : [] }
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function refresh(documentId: string) {
  revalidatePath(`/dashboard/platform/documents/document/${documentId}`)
  revalidatePath('/dashboard/platform/documents')
}

async function loadRequest(requestId: string) {
  const response = await keystoneClient<{ signatureRequest: { id: string; status: string | null; documentVersion: { document: { id: string } | null } | null } | null }>(`
    query SignatureRequestState($id: ID!) { signatureRequest(where: { id: $id }) { id status documentVersion { document { id } } } }
  `, { id: requestId })
  return response.success ? response.data.signatureRequest : null
}

export async function prepareSignatureRequestAction(previous: SignatureActionState, formData: FormData): Promise<SignatureActionState> {
  const revision = previous.revision + 1
  const documentId = text(formData, 'documentId')
  const versionId = text(formData, 'documentVersionId')
  const title = text(formData, 'title')
  const message = text(formData, 'message')
  const expiresRaw = text(formData, 'expiresAt')
  const integrationConnectionId = text(formData, 'integrationConnectionId') || null
  if (!documentId || !versionId) return { ok: false, message: 'Upload a version before requesting signatures.', revision }
  if (!title) return { ok: false, message: 'Title is required.', revision }
  if (title.length > 300) return { ok: false, message: 'Title must be 300 characters or fewer.', revision }
  if (message.length > 5000) return { ok: false, message: 'Message must be 5,000 characters or fewer.', revision }
  let expiresAt: string | null = null
  if (expiresRaw) {
    const date = new Date(expiresRaw)
    const remaining = date.getTime() - Date.now()
    if (Number.isNaN(remaining) || remaining <= 0 || remaining > MAX_LIFETIME_MS) return { ok: false, message: 'Expiry must be in the future and within one year.', revision }
    expiresAt = date.toISOString()
  }
  const setup = await getDocumentSignatures(documentId)
  if (!setup) return { ok: false, message: 'This document is unavailable.', revision }
  if (!['draft', 'active'].includes(String(setup.documentStatus))) return { ok: false, message: 'Signatures can be requested only on draft or active documents.', revision }
  if (setup.currentVersion?.id !== versionId) return { ok: false, message: 'The current version changed. Reload and try again.', revision }
  if (integrationConnectionId && !setup.connections.some((connection) => connection.id === integrationConnectionId)) return { ok: false, message: 'Choose an active signature connection.', revision }
  const result = await keystoneClient<{ prepareSignatureRequest: { request: { id: string } } }>(`
    mutation PrepareSignatureRequest($documentVersionId: ID!, $idempotencyKey: String!, $title: String!, $message: String, $expiresAt: DateTime, $integrationConnectionId: ID) {
      prepareSignatureRequest(documentVersionId: $documentVersionId, idempotencyKey: $idempotencyKey, title: $title, message: $message, expiresAt: $expiresAt, integrationConnectionId: $integrationConnectionId) { request { id } }
    }
  `, { documentVersionId: versionId, idempotencyKey: randomUUID(), title, message: message || null, expiresAt, integrationConnectionId })
  if (!result.success) return { ok: false, message: 'The request was not prepared. Document management permission and access to the matter are required.', revision }
  refresh(documentId)
  return { ok: true, message: 'Signature request prepared. Add signers next.', revision }
}

export async function addDocumentSignerAction(previous: SignatureActionState, formData: FormData): Promise<SignatureActionState> {
  const revision = previous.revision + 1
  const documentId = text(formData, 'documentId')
  const requestId = text(formData, 'requestId')
  const contactId = text(formData, 'contactId') || null
  let name = text(formData, 'name')
  let email = text(formData, 'email')
  const signingOrder = Number(text(formData, 'signingOrder') || 1)
  if (!requestId || !documentId) return { ok: false, message: 'Signature request is missing.', revision }
  if (!Number.isInteger(signingOrder) || signingOrder < 1 || signingOrder > 1000) return { ok: false, message: 'Signing order must be a whole number from 1 to 1000.', revision }
  if (contactId && (!name || !email)) {
    const contact = await keystoneClient<{ contact: { displayName: string | null; primaryEmail: string | null } | null }>(`query SignerContact($id: ID!) { contact(where: { id: $id }) { displayName primaryEmail } }`, { id: contactId })
    if (!contact.success || !contact.data.contact) return { ok: false, message: 'That contact is unavailable.', revision }
    name ||= contact.data.contact.displayName?.trim() ?? ''
    email ||= contact.data.contact.primaryEmail?.trim() ?? ''
  }
  if (!name) return { ok: false, message: 'Signer name is required.', revision }
  if (name.length > 300) return { ok: false, message: 'Signer name must be 300 characters or fewer.', revision }
  if (!email) return { ok: false, message: contactId ? 'This contact has no primary email. Enter an email address.' : 'Signer email is required.', revision }
  if (email.length > 320 || !EMAIL.test(email)) return { ok: false, message: 'Enter one valid email address.', revision }
  const request = await loadRequest(requestId)
  if (!request || request.documentVersion?.document?.id !== documentId) return { ok: false, message: 'This signature request is unavailable.', revision }
  if (request.status !== 'draft') return { ok: false, message: 'Signers can be added only while the request is a draft.', revision }
  const result = await keystoneClient<{ addDocumentSigner: { id: string } }>(`
    mutation AddDocumentSigner($requestId: ID!, $contactId: ID, $name: String!, $email: String!, $signingOrder: Int) {
      addDocumentSigner(requestId: $requestId, contactId: $contactId, name: $name, email: $email, signingOrder: $signingOrder) { id }
    }
  `, { requestId, contactId, name, email, signingOrder })
  if (!result.success) return { ok: false, message: 'The signer was not added. Document management permission and access to the matter are required.', revision }
  refresh(documentId)
  return { ok: true, message: `${name} added.`, revision }
}

/** Manual cancellation: the provider event ID is local and the evidence is the digest of the staff note. */
export async function cancelSignatureRequestAction(previous: SignatureActionState, formData: FormData): Promise<SignatureActionState> {
  const revision = previous.revision + 1
  const documentId = text(formData, 'documentId')
  const requestId = text(formData, 'requestId')
  const note = text(formData, 'note')
  if (!requestId || !documentId) return { ok: false, message: 'Signature request is missing.', revision }
  if (note.length < 5 || note.length > 2000) return { ok: false, message: 'Enter a reason between 5 and 2,000 characters.', revision }
  const request = await loadRequest(requestId)
  if (!request || request.documentVersion?.document?.id !== documentId) return { ok: false, message: 'This signature request is unavailable.', revision }
  if (!CANCELLABLE.has(String(request.status))) return { ok: false, message: 'This request can no longer be cancelled.', revision }
  const result = await keystoneClient<{ transitionSignatureRequest: { request: { id: string } } }>(`
    mutation CancelSignatureRequest($requestId: ID!, $providerEventId: String!, $evidenceDigest: String!) {
      transitionSignatureRequest(requestId: $requestId, toStatus: "cancelled", providerEventId: $providerEventId, evidenceDigest: $evidenceDigest) { request { id } }
    }
  `, { requestId, providerEventId: `manual:${randomUUID()}`, evidenceDigest: createHash('sha256').update(note).digest('hex') })
  if (!result.success) return { ok: false, message: 'The request was not cancelled. Document management permission and access to the matter are required.', revision }
  refresh(documentId)
  return { ok: true, message: 'Signature request cancelled.', revision }
}
