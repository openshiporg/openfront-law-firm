'use server'

import { revalidatePath } from 'next/cache'

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient'

export type ResearchParagraph = { id: string; anchor: string; label: string; text: string; position: number }

export type ResearchSource = {
  id: string
  provider: string
  kind: string
  jurisdiction: string
  citation: string
  title: string
  court: string
  decidedOn: string
  sourceAsOf: string
  officialUrl: string
  sourceStatus: string
  contentSha256: string
  paragraphCount: number
  retrievedAt: string
  retrievedBy?: { name?: string | null } | null
  paragraphs: ResearchParagraph[]
}

export type ResearchNoteRecord = {
  id: string
  title: string
  body: string
  claimCount: number
  supportedCount: number
  revision: number
  removedCitations: string[] | null
  updatedAt: string
  author?: { name?: string | null } | null
}

export type ResearchCandidate = { provider: string; kind: string; reference: string; citation: string; title: string; detail: string; officialUrl: string }

type Result<T> = { success: true; data: T } | { success: false; error: string }

export async function getMatterResearch(matterId: string): Promise<Result<{ sources: ResearchSource[]; notes: ResearchNoteRecord[] }>> {
  const response = await keystoneClient<{ legalSources: ResearchSource[]; researchNotes: ResearchNoteRecord[] }>(`
    query MatterResearch($id: ID!) {
      legalSources(where: { matter: { id: { equals: $id } } }, orderBy: [{ kind: asc }, { retrievedAt: asc }], take: 50) {
        id provider kind jurisdiction citation title court decidedOn sourceAsOf officialUrl sourceStatus contentSha256 paragraphCount retrievedAt
        retrievedBy { name }
        paragraphs(orderBy: { position: asc }, take: 1000) { id anchor label text position }
      }
      researchNotes(where: { matter: { id: { equals: $id } } }, orderBy: [{ updatedAt: desc }], take: 50) {
        id title body claimCount supportedCount revision removedCitations updatedAt
        author { name }
      }
    }
  `, { id: matterId })
  if (!response.success) return { success: false, error: response.error }
  return { success: true, data: { sources: response.data.legalSources, notes: response.data.researchNotes } }
}

export type SearchState = { query: string; candidates: ResearchCandidate[]; notices: string[]; error?: string }

export async function searchAuthority(_previous: SearchState, formData: FormData): Promise<SearchState> {
  const query = String(formData.get('q') ?? '').trim().slice(0, 120)
  if (query.length < 2) return { query, candidates: [], notices: ['Type a citation, e.g. 19-A M.R.S. § 1657 or 2024 ME 9, or case-name words.'] }
  const response = await keystoneClient<{ searchLegalAuthority: { candidates: ResearchCandidate[]; notices: string[] } }>(`
    query SearchLegalAuthority($query: String!) {
      searchLegalAuthority(query: $query) { candidates { provider kind reference citation title detail officialUrl } notices }
    }
  `, { query })
  if (!response.success) return { query, candidates: [], notices: [], error: response.error }
  return { query, ...response.data.searchLegalAuthority }
}

export type AttachState = { ok: boolean; message: string; reference?: string }

export async function attachAuthority(_previous: AttachState, formData: FormData): Promise<AttachState> {
  const matterId = String(formData.get('matterId') ?? '')
  const provider = String(formData.get('provider') ?? '')
  const reference = String(formData.get('reference') ?? '')
  const response = await keystoneClient<{ attachLegalSource: { id: string; status: string; paragraphCount: number; citation: string } }>(`
    mutation AttachLegalSource($matterId: ID!, $provider: String!, $reference: String!) {
      attachLegalSource(matterId: $matterId, provider: $provider, reference: $reference) { id status paragraphCount citation }
    }
  `, { matterId, provider, reference })
  if (!response.success) return { ok: false, message: response.error, reference }
  const result = response.data.attachLegalSource
  revalidatePath(`/dashboard/platform/ai/matters/${matterId}`)
  const verb = result.status === 'attached' ? 'Retrieved' : result.status === 'refreshed' ? 'Re-read; the official text changed and is updated:' : 'Re-read; the official text is unchanged:'
  return { ok: true, message: `${verb} ${result.citation}, ${result.paragraphCount} paragraphs.`, reference }
}

export type NoteState = { ok: boolean; message: string; noteId?: string }

export async function saveNote(_previous: NoteState, formData: FormData): Promise<NoteState> {
  const matterId = String(formData.get('matterId') ?? '')
  const noteId = String(formData.get('noteId') ?? '') || null
  const title = String(formData.get('title') ?? '')
  const body = String(formData.get('body') ?? '')
  const response = await keystoneClient<{ saveResearchNote: { id: string; revision: number; claimCount: number; supportedCount: number; removedCitations: string[] } }>(`
    mutation SaveResearchNote($matterId: ID!, $noteId: ID, $title: String!, $body: String!) {
      saveResearchNote(matterId: $matterId, noteId: $noteId, title: $title, body: $body) { id revision claimCount supportedCount removedCitations }
    }
  `, { matterId, noteId, title, body })
  if (!response.success) return { ok: false, message: response.error, noteId: noteId ?? undefined }
  const result = response.data.saveResearchNote
  revalidatePath(`/dashboard/platform/ai/matters/${matterId}`)
  const unsupported = result.claimCount - result.supportedCount
  const parts = [`Saved. ${result.supportedCount} of ${result.claimCount} statements cite a retrieved paragraph.`]
  if (unsupported) parts.push(`${unsupported} ${unsupported === 1 ? 'is' : 'are'} marked unsupported.`)
  if (result.removedCitations.length) parts.push(`${result.removedCitations.length} citation${result.removedCitations.length === 1 ? '' : 's'} named no paragraph on this matter and ${result.removedCitations.length === 1 ? 'was' : 'were'} removed.`)
  return { ok: true, message: parts.join(' '), noteId: result.id }
}
