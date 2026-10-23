'use server'
import { revalidatePath } from 'next/cache'
import { keystoneClient, type KeystoneResponse } from '@/features/dashboard/lib/keystoneClient'

type ConflictTerm = { id: string; term: string; termType: string }
type ConflictMatch = { id: string; status: string; matchType: string; matchedContact?: { id: string; displayName: string } | null; matchedMatter?: { id: string; matterNumber: string; title: string } | null; matchedMatterParty?: { id: string } | null; dispositionsCount: number; latestDisposition?: Array<{ outcome: string; decidedAt: string }> | null }
export type ConflictReviewSource = { kind: 'contact' | 'matter'; id: string; label: string }

export type ConflictReviewSetup = {
  canRun: boolean
  canResolve: boolean
  total: number
  page: number
  pageCount: number
  conflictChecks: Array<{
    id: string; checkNumber: string; status: string
    intake?: { intakeNumber: string; title: string } | null
    matter?: { matterNumber: string; title: string } | null
    terms: ConflictTerm[]
    termsCount: number
    matches: ConflictMatch[]
    matchesCount: number
  }>
}
export type ConflictReviewState = { ok: boolean; message: string }

const CHECK_PAGE_SIZE = 10 // literal in ConflictReviewSetup below
const DETAIL_PAGE_SIZE = 50 // literal in ConflictReviewSetup below
const matchFields = 'id status matchType matchedContact { id displayName } matchedMatter { id matterNumber title } matchedMatterParty { id } dispositionsCount latestDisposition: dispositions(orderBy: [{ decidedAt: desc }], take: 1) { outcome decidedAt }'

// Pending checks are paged, and each check's terms and candidates carry their full counts
// with continuation, so absence from one page never reads as "no conflict".
export async function getConflictReviewSetup(requestedPage = 1) {
  const countResponse = await keystoneClient<{ conflictChecksCount: number }>(`query ConflictReviewCount { conflictChecksCount(where: { status: { in: [requested, running, review_required] } }) }`)
  if (!countResponse.success) return countResponse
  const total = countResponse.data.conflictChecksCount
  const pageCount = Math.max(1, Math.ceil(total / CHECK_PAGE_SIZE))
  const page = Math.min(Math.max(Number.isSafeInteger(requestedPage) ? requestedPage : 1, 1), pageCount)
  const response = await keystoneClient<Pick<ConflictReviewSetup, 'conflictChecks'> & { viewerCanRunConflictChecks: boolean; viewerCanResolveConflicts: boolean }>(`
    query ConflictReviewSetup($skip: Int!) {
      viewerCanRunConflictChecks viewerCanResolveConflicts
      conflictChecks(where: { status: { in: [requested, running, review_required] } }, orderBy: [{ createdAt: asc }, { id: asc }], take: 10, skip: $skip) {
        id checkNumber status intake { intakeNumber title } matter { matterNumber title }
        terms(orderBy: [{ createdAt: asc }, { id: asc }], take: 50) { id term termType }
        termsCount
        matches(orderBy: [{ createdAt: asc }, { id: asc }], take: 50) { id status matchType matchedContact { id displayName } matchedMatter { id matterNumber title } matchedMatterParty { id } dispositionsCount latestDisposition: dispositions(orderBy: [{ decidedAt: desc }], take: 1) { outcome decidedAt } }
        matchesCount
      }
    }
  `, { skip: (page - 1) * CHECK_PAGE_SIZE })
  if (!response.success) return response
  return { success: true as const, data: { conflictChecks: response.data.conflictChecks, canRun: response.data.viewerCanRunConflictChecks, canResolve: response.data.viewerCanResolveConflicts, total, page, pageCount } }
}

export async function loadConflictCheckDetail(checkId: string, part: 'terms' | 'matches', skip: number): Promise<{ success: true; terms?: ConflictTerm[]; matches?: ConflictMatch[] } | { success: false; error: string }> {
  const id = String(checkId ?? '').trim()
  const offset = Number.isSafeInteger(skip) && skip >= 0 ? skip : 0
  if (!id || id.length > 200) return { success: false, error: 'Conflict check is required.' }
  const selection = part === 'terms'
    ? `terms(orderBy: [{ createdAt: asc }, { id: asc }], take: ${DETAIL_PAGE_SIZE}, skip: $skip) { id term termType }`
    : `matches(orderBy: [{ createdAt: asc }, { id: asc }], take: ${DETAIL_PAGE_SIZE}, skip: $skip) { ${matchFields} }`
  const response = await keystoneClient<{ conflictCheck: { terms?: ConflictTerm[]; matches?: ConflictMatch[] } | null }>(`query ConflictCheckDetail($id: ID!, $skip: Int!) { conflictCheck(where: { id: $id }) { ${selection} } }`, { id, skip: offset })
  if (!response.success) return { success: false, error: response.error }
  if (!response.data.conflictCheck) return { success: false, error: 'This conflict check is unavailable.' }
  return { success: true, ...response.data.conflictCheck }
}

// Candidate sources are found by search instead of a fixed first-100 directory. Each
// directory stays a separately authorized, session-aware list read.
export async function searchConflictSources(query: string): Promise<{ success: true; data: ConflictReviewSource[] } | { success: false; error: string }> {
  const q = String(query ?? '').trim().slice(0, 100)
  if (!q) return { success: true, data: [] }
  const contains = { contains: q, mode: 'insensitive' }
  const [contacts, matters] = await Promise.all([
    keystoneClient<{ contacts: Array<{ id: string; displayName: string }> }>('query ConflictContactSearch($where: ContactWhereInput!) { contacts(where: $where, orderBy: [{ lastName: asc }, { id: asc }], take: 25) { id displayName } }', { where: { OR: [{ firstName: contains }, { lastName: contains }, { organizationName: contains }, { preferredName: contains }] } }),
    keystoneClient<{ matters: Array<{ id: string; matterNumber: string; title: string }> }>('query ConflictMatterSearch($where: MatterWhereInput!) { matters(where: $where, orderBy: [{ matterNumber: asc }, { id: asc }], take: 25) { id matterNumber title } }', { where: { OR: [{ matterNumber: contains }, { title: contains }] } }),
  ])
  if (!contacts.success && !matters.success) return { success: false, error: contacts.error }
  return {
    success: true,
    data: [
      ...(contacts.success ? contacts.data.contacts.map((row) => ({ kind: 'contact' as const, id: row.id, label: row.displayName })) : []),
      ...(matters.success ? matters.data.matters.map((row) => ({ kind: 'matter' as const, id: row.id, label: `${row.matterNumber} · ${row.title}` })) : []),
    ],
  }
}
function normalize(value: string) { return value.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim() }

/** Compose existing controlled native commands; no direct DB writer or invented
 * search-engine/provider/representation authority. Sources are live foreign keys. */
export async function manageConflictReview(_previous: ConflictReviewState, formData: FormData): Promise<ConflictReviewState> {
  const operation = String(formData.get('operation') ?? '')
  const checkId = String(formData.get('checkId') ?? '').trim()
  if (!checkId) return { ok: false, message: 'Conflict check is required.' }
  let response: KeystoneResponse<unknown>
  let message = 'Review updated'
  if (operation === 'term') {
    const term = String(formData.get('term') ?? '').trim(), termType = String(formData.get('termType') ?? 'other')
    if (!term) return { ok: false, message: 'Search term is required.' }
    message = 'Term added'
    response = await keystoneClient(`mutation AddManualConflictTerm($checkId: ID!, $term: String!, $normalized: String!, $termType: String!) { addConflictSearchTerm(checkId: $checkId, term: $term, normalizedTerm: $normalized, termType: $termType, includeAliases: true) { id } }`, { checkId, term, normalized: normalize(term), termType })
  } else if (operation === 'match') {
    const [kind, id, ...extra] = String(formData.get('source') ?? '').split(':')
    if (!['contact', 'matter'].includes(kind) || !id || id.length > 100 || extra.length) return { ok: false, message: 'Choose one current source record.' }
    const matchType = kind === 'matter' ? 'matter_text' : String(formData.get('matchType') ?? 'manual')
    message = 'Candidate linked'
    response = await keystoneClient(`mutation LinkConflictSource($checkId: ID!, $matchType: String!, $contact: ID, $matter: ID) { addConflictMatch(checkId: $checkId, matchType: $matchType, matchedContactId: $contact, matchedMatterId: $matter) { id } }`, { checkId, matchType, contact: kind === 'contact' ? id : null, matter: kind === 'matter' ? id : null })
  } else if (operation === 'transition') {
    const toStatus = String(formData.get('toStatus') ?? ''), summary = String(formData.get('summary') ?? '').trim()
    if (!['running', 'review_required', 'cancelled'].includes(toStatus) || toStatus === 'review_required' && summary.length < 10) return { ok: false, message: 'A review state and completed review summary are required.' }
    message = toStatus === 'running' ? 'Manual review started' : toStatus === 'review_required' ? 'Sent to final review' : 'Check cancelled'
    response = await keystoneClient(`mutation MoveConflictReview($checkId: ID!, $status: ConflictCheckCommandTarget!, $summary: String) { transitionConflictCheck(checkId: $checkId, toStatus: $status, summary: $summary) { check { id status } replayed } }`, { checkId, status: toStatus, summary })
  } else if (operation === 'finalize') {
    const outcome = String(formData.get('outcome') ?? ''), summary = String(formData.get('summary') ?? '').trim()
    if (!['cleared', 'conflict_found'].includes(outcome)) return { ok: false, message: 'Choose an outcome.' }
    if (summary.length < 10) return { ok: false, message: 'Final summary must be at least 10 characters.' }
    message = outcome === 'cleared' ? 'Cleared' : 'Conflict found recorded'
    response = await keystoneClient(`mutation FinishConflictReview($checkId: ID!, $outcome: String!, $summary: String!) { finalizeConflictCheck(checkId: $checkId, outcome: $outcome, summary: $summary) { check { id status } replayed } }`, { checkId, outcome, summary })
  } else if (operation === 'disposition') {
    const matchId = String(formData.get('matchId') ?? '').trim(), outcome = String(formData.get('outcome') ?? ''), rationale = String(formData.get('rationale') ?? '').trim()
    if (!matchId || rationale.length < 10) return { ok: false, message: 'Candidate, outcome, and a 10-character rationale are required.' }
    message = 'Disposition recorded'
    response = await keystoneClient(`mutation RecordConflictDecision($checkId: ID!, $matchId: ID!, $outcome: String!, $rationale: String!) { recordConflictDisposition(checkId: $checkId, matchId: $matchId, outcome: $outcome, rationale: $rationale) { id outcome } }`, { checkId, matchId, outcome, rationale })
  } else return { ok: false, message: 'Unsupported conflict-review operation.' }
  if (!response.success) return { ok: false, message: response.error }
  if (operation === 'finalize' && String(formData.get('outcome')) === 'cleared') {
    const after = await keystoneClient<{ conflictCheck: { intake: { status: string } | null } | null }>(`query ClearedConflictIntake($id: ID!) { conflictCheck(where: { id: $id }) { intake { status } } }`, { id: checkId })
    const intakeStatus = after.success ? after.data.conflictCheck?.intake?.status : undefined
    if (intakeStatus === 'decision') message = 'Cleared · intake ready to open'
  }
  revalidatePath('/dashboard/platform/intake')
  revalidatePath('/dashboard')
  return { ok: true, message }
}
