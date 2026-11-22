/* Retrieval from official, free legal sources. Every source returned here was read from
 * its publisher at the moment of the call; nothing is typed in by hand or recalled by a
 * model. A failed read is an error, never a partial or guessed record. */
import { createHash } from 'node:crypto'

import {
  parseCourtListenerOpinion,
  parseEcfrReference,
  parseEcfrXml,
  parseLawCourtIndex,
  parseMaineLawCourtReference,
  parseMaineStatuteHtml,
  parseMaineStatuteReference,
  maineStatuteUrl,
  splitOpinionParagraphs,
  type ParsedParagraph,
} from './parse'

export type LegalSourceProvider = 'maine_statutes' | 'ecfr' | 'maine_law_court' | 'courtlistener'
export type LegalSourceKind = 'statute' | 'regulation' | 'judgment'

export type RetrievedSource = {
  provider: LegalSourceProvider
  kind: LegalSourceKind
  externalId: string
  jurisdiction: string
  citation: string
  title: string
  court: string | null
  decidedOn: string | null
  sourceAsOf: string | null
  officialUrl: string
  status: string
  paragraphs: ParsedParagraph[]
  contentSha256: string
}

export type SourceCandidate = {
  provider: LegalSourceProvider
  kind: LegalSourceKind
  reference: string
  citation: string
  title: string
  detail: string
  officialUrl: string
}

const userAgent = 'OpenfrontLawFirm/1.0 (legal research retrieval; https://law-firm.openship.org)'
const maxBytes = 8 * 1024 * 1024

export const courtListenerConfigured = () => Boolean(process.env.COURTLISTENER_API_TOKEN?.trim())

async function officialFetch(url: string, init: RequestInit & { accept?: string } = {}) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) throw new Error('Only official legal sources can be read.')
  const headers: Record<string, string> = { 'User-Agent': userAgent, Accept: init.accept ?? '*/*', 'Accept-Encoding': 'gzip, deflate, br' }
  if (parsed.hostname === 'www.courtlistener.com') {
    const token = process.env.COURTLISTENER_API_TOKEN?.trim()
    if (!token) throw new Error('CourtListener needs an API token on the service (COURTLISTENER_API_TOKEN).')
    headers.Authorization = `Token ${token}`
  }
  const response = await fetch(url, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(25_000) })
  if (response.status === 404) throw new Error('The official source has no such record.')
  if (!response.ok) throw new Error(`The official source answered ${response.status}. Try again shortly.`)
  const finalHost = new URL(response.url || url).hostname
  if (!allowedHosts.has(finalHost)) throw new Error('The official source redirected somewhere unofficial.')
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > maxBytes) throw new Error('The official document is too large to read.')
  const chunks: Uint8Array[] = []
  let bytes = 0
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The official source returned no document.')
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('The official document is too large to read.') }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  const buffer = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength }
  return { buffer, contentType: response.headers.get('content-type') ?? '' }
}

const allowedHosts = new Set([
  'legislature.maine.gov',
  'www.ecfr.gov',
  'www.courts.maine.gov',
  'courts.maine.gov',
  'www.courtlistener.com',
  'storage.courtlistener.com',
])

const text = (buffer: Uint8Array) => new TextDecoder('utf-8').decode(buffer)

export function paragraphsDigest(paragraphs: ParsedParagraph[]) {
  const hash = createHash('sha256')
  for (const paragraph of paragraphs) hash.update(`${paragraph.anchor}\u0000${paragraph.text}\u0001`)
  return hash.digest('hex')
}

function finish(source: Omit<RetrievedSource, 'contentSha256'>): RetrievedSource {
  if (!source.paragraphs.length) throw new Error('The official source returned no readable text.')
  return { ...source, contentSha256: paragraphsDigest(source.paragraphs) }
}

// ─── Maine Revised Statutes ────────────────────────────────────────────────────

async function retrieveMaineStatute(reference: string) {
  const parsed = parseMaineStatuteReference(reference.replace(':', ' § '))
  if (!parsed) throw new Error('Write a Maine statute as title and section, e.g. 19-A M.R.S. § 1657.')
  const url = maineStatuteUrl(parsed.title, parsed.section)
  const { buffer } = await officialFetch(url, { accept: 'text/html' })
  const result = parseMaineStatuteHtml(text(buffer), parsed.title, parsed.section)
  return finish({
    provider: 'maine_statutes', kind: 'statute', externalId: parsed.reference, jurisdiction: 'Maine',
    citation: result.citation, title: result.title, court: null, decidedOn: null,
    sourceAsOf: result.sourceAsOf, officialUrl: url, status: result.status, paragraphs: result.paragraphs,
  })
}

// ─── eCFR ──────────────────────────────────────────────────────────────────────

async function ecfrCurrentDate(title: string) {
  const { buffer } = await officialFetch('https://www.ecfr.gov/api/versioner/v1/titles.json', { accept: 'application/json' })
  const titles = JSON.parse(text(buffer)).titles as Array<{ number: number; up_to_date_as_of: string }>
  const entry = titles.find((item) => String(item.number) === title)
  if (!entry?.up_to_date_as_of) throw new Error('The eCFR has no such title.')
  return entry.up_to_date_as_of
}

async function retrieveEcfr(reference: string) {
  const parsed = parseEcfrReference(reference.replace(':', ' CFR '))
  if (!parsed) throw new Error('Write a regulation as title and section, e.g. 45 CFR 309.105.')
  const date = await ecfrCurrentDate(parsed.title)
  const api = `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-${parsed.title}.xml?section=${encodeURIComponent(parsed.section)}`
  const { buffer } = await officialFetch(api, { accept: 'application/xml' })
  const result = parseEcfrXml(text(buffer), parsed.title, parsed.section)
  return finish({
    provider: 'ecfr', kind: 'regulation', externalId: parsed.reference, jurisdiction: 'United States (federal)',
    citation: result.citation, title: result.title, court: null, decidedOn: null, sourceAsOf: date,
    officialUrl: `https://www.ecfr.gov/current/title-${parsed.title}/section-${parsed.section}`, status: 'current', paragraphs: result.paragraphs,
  })
}

async function searchEcfr(query: string): Promise<SourceCandidate[]> {
  const { buffer } = await officialFetch(`https://www.ecfr.gov/api/search/v1/results?query=${encodeURIComponent(query)}&per_page=6`, { accept: 'application/json' })
  const results = (JSON.parse(text(buffer)).results ?? []) as Array<{ type: string; hierarchy: { title: string; section: string | null }; headings?: { section?: string }; hierarchy_headings?: { section?: string }; full_text_excerpt?: string }>
  return results
    .filter((item) => item.type === 'Section' && item.hierarchy?.section)
    .map((item) => {
      const title = item.hierarchy.title
      const section = item.hierarchy.section!
      return {
        provider: 'ecfr' as const, kind: 'regulation' as const, reference: `${title}:${section}`,
        citation: `${title} C.F.R. § ${section}`,
        title: stripTags(item.headings?.section ?? '') || stripTags(item.hierarchy_headings?.section ?? ''),
        detail: stripTags(item.full_text_excerpt ?? '').slice(0, 220),
        officialUrl: `https://www.ecfr.gov/current/title-${title}/section-${section}`,
      }
    })
}

const stripTags = (value: string) => value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

// ─── Maine Law Court ───────────────────────────────────────────────────────────

const lawCourtIndexUrl = (year: number) => `https://www.courts.maine.gov/courts/sjc/lawcourt/${year}/index.html`

async function lawCourtIndex(year: number) {
  const { buffer } = await officialFetch(lawCourtIndexUrl(year), { accept: 'text/html' })
  return parseLawCourtIndex(text(buffer))
}

/** Reads the opinion PDF and keeps body text only: footnotes and running page numbers
 * are printed smaller than the body, so the dominant font size marks the opinion text. */
async function opinionTextFromPdf(buffer: Uint8Array) {
  const { getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(buffer)
  const pages: Array<Array<{ str: string; size: number; eol: boolean }>> = []
  const weight = new Map<number, number>()
  for (let number = 1; number <= Math.min(pdf.numPages, 200); number += 1) {
    const page = await pdf.getPage(number)
    const content = await page.getTextContent()
    const items = (content.items as Array<{ str?: string; transform?: number[]; hasEOL?: boolean }>).map((item) => ({
      str: item.str ?? '', size: Math.round(Math.abs(item.transform?.[3] ?? 0)), eol: Boolean(item.hasEOL),
    }))
    for (const item of items) if (item.str.trim()) weight.set(item.size, (weight.get(item.size) ?? 0) + item.str.length)
    pages.push(items)
  }
  const body = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!body) throw new Error('The opinion PDF has no readable text.')
  let output = ''
  for (const items of pages) {
    for (const item of items) {
      if (Math.abs(item.size - body) > 1) { if (item.eol) output += '\n'; continue }
      output += item.str
      if (item.eol) output += '\n'
    }
    output += '\n'
  }
  // A lone page number line between pages is not opinion text.
  return output.replace(/\n\s*\d{1,3}\s*\n/g, '\n')
}

async function retrieveLawCourt(reference: string) {
  const parsed = parseMaineLawCourtReference(reference.replace(':', ' ME '))
  if (!parsed) throw new Error('Write a Law Court decision by its official cite, e.g. 2024 ME 9.')
  const rows = await lawCourtIndex(parsed.year)
  const row = rows.find((item) => item.citation === parsed.citation)
  if (!row) throw new Error(`${parsed.citation} is not on the court's ${parsed.year} published-opinion list.`)
  const officialUrl = `https://www.courts.maine.gov/courts/sjc/lawcourt/${parsed.year}/${row.file}`
  const { buffer, contentType } = await officialFetch(officialUrl, { accept: 'application/pdf' })
  if (!/pdf/i.test(contentType)) throw new Error('The court did not return the opinion PDF.')
  const paragraphs = splitOpinionParagraphs(await opinionTextFromPdf(buffer))
  if (!paragraphs.some((paragraph) => paragraph.anchor === 'para-1')) throw new Error('The opinion text has no numbered paragraphs to cite.')
  return finish({
    provider: 'maine_law_court', kind: 'judgment', externalId: parsed.reference, jurisdiction: 'Maine',
    citation: `${row.caseName}, ${parsed.citation}`, title: row.caseName, court: 'Maine Supreme Judicial Court',
    decidedOn: row.decided ? toIsoDate(row.decided) : null, sourceAsOf: null, officialUrl, status: 'published', paragraphs,
  })
}

function toIsoDate(value: string) {
  const date = new Date(`${value} 12:00 UTC`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

async function searchLawCourt(query: string): Promise<SourceCandidate[]> {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 2)
  if (!words.length) return []
  const thisYear = new Date().getUTCFullYear()
  const years = Array.from({ length: 4 }, (_, index) => thisYear - index)
  const indexes = await Promise.allSettled(years.map((year) => lawCourtIndex(year).then((rows) => rows.map((row) => ({ ...row, year })))))
  const rows = indexes.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  return rows
    .filter((row) => words.every((word) => row.caseName.toLowerCase().includes(word)))
    .slice(0, 6)
    .map((row) => {
      const ref = parseMaineLawCourtReference(row.citation)!
      return {
        provider: 'maine_law_court' as const, kind: 'judgment' as const, reference: ref.reference,
        citation: `${row.caseName}, ${row.citation}`, title: row.caseName, detail: `Maine Supreme Judicial Court · decided ${row.decided}`,
        officialUrl: `https://www.courts.maine.gov/courts/sjc/lawcourt/${row.year}/${row.file}`,
      }
    })
}

// ─── CourtListener ─────────────────────────────────────────────────────────────

const courtListenerBase = 'https://www.courtlistener.com/api/rest/v4'

async function courtListenerJson(path: string) {
  if (!/^\/(?:search\/\?|clusters\/\d+\/|opinions\/\d+\/|dockets\/\d+\/)/.test(path)) throw new Error('Unsupported CourtListener resource.')
  const { buffer } = await officialFetch(`${courtListenerBase}${path}`, { accept: 'application/json' })
  return JSON.parse(text(buffer))
}

async function searchCourtListener(query: string): Promise<SourceCandidate[]> {
  const data = await courtListenerJson(`/search/?type=o&order_by=score%20desc&q=${encodeURIComponent(query)}`)
  return ((data.results ?? []) as Array<any>).slice(0, 6).map((item) => ({
    provider: 'courtlistener' as const, kind: 'judgment' as const, reference: String(item.cluster_id),
    citation: [item.caseName, (item.citation ?? [])[0]].filter(Boolean).join(', '),
    title: item.caseName ?? 'Opinion', detail: [item.court, item.dateFiled].filter(Boolean).join(' · '),
    officialUrl: `https://www.courtlistener.com${item.absolute_url}`,
  }))
}

async function retrieveCourtListener(reference: string) {
  if (!/^\d{1,12}$/.test(reference)) throw new Error('A CourtListener opinion is chosen from search results.')
  const cluster = await courtListenerJson(`/clusters/${reference}/`)
  const opinionUrl = (cluster.sub_opinions ?? [])[0] as string | undefined
  if (!opinionUrl) throw new Error('This CourtListener record has no opinion text.')
  const opinionId = opinionUrl.match(/opinions\/(\d+)/)?.[1]
  if (!opinionId) throw new Error('This CourtListener record has no opinion text.')
  const opinion = await courtListenerJson(`/opinions/${opinionId}/`)
  const html = opinion.html_with_citations || opinion.html_lawbox || opinion.html_columbia || opinion.html || opinion.xml_harvard || ''
  const paragraphs = parseCourtListenerOpinion(html, opinion.plain_text ?? '')
  const citations = ((cluster.citations ?? []) as Array<{ volume: number; reporter: string; page: string }>).map((cite) => `${cite.volume} ${cite.reporter} ${cite.page}`)
  const docketId = String(cluster.docket ?? '').match(/\/dockets\/(\d+)\/?$/)?.[1]
  const docket = docketId ? await courtListenerJson(`/dockets/${docketId}/`).catch(() => null) : null
  const caseName = cluster.case_name || cluster.case_name_full || 'Opinion'
  return finish({
    provider: 'courtlistener', kind: 'judgment', externalId: String(reference), jurisdiction: docket?.court_id ?? 'United States',
    citation: [caseName, citations[0]].filter(Boolean).join(', '), title: caseName,
    court: docket?.court ?? docket?.court_id ?? null, decidedOn: cluster.date_filed ?? null, sourceAsOf: null,
    officialUrl: `https://www.courtlistener.com${cluster.absolute_url}`, status: cluster.precedential_status ?? 'published', paragraphs,
  })
}

// ─── Entry points ──────────────────────────────────────────────────────────────

export async function retrieveLegalSource(provider: LegalSourceProvider, reference: string): Promise<RetrievedSource> {
  const value = reference.trim().slice(0, 120)
  if (provider === 'maine_statutes') return retrieveMaineStatute(value)
  if (provider === 'ecfr') return retrieveEcfr(value)
  if (provider === 'maine_law_court') return retrieveLawCourt(value)
  if (provider === 'courtlistener') return retrieveCourtListener(value)
  throw new Error('Unsupported legal source.')
}

/** One search box. An exact citation resolves straight to its official record; other
 * words search the official indexes that support it. */
export async function searchLegalSources(query: string): Promise<{ candidates: SourceCandidate[]; notices: string[] }> {
  const q = query.trim().replace(/\s+/g, ' ').slice(0, 120)
  if (q.length < 2) return { candidates: [], notices: ['Type a citation or at least two letters.'] }
  const notices: string[] = []
  const candidates: SourceCandidate[] = []
  const statute = parseMaineStatuteReference(q)
  if (statute) {
    candidates.push({ provider: 'maine_statutes', kind: 'statute', reference: statute.reference, citation: `${statute.title} M.R.S. § ${statute.section}`, title: 'Maine Revised Statutes', detail: 'Read from the Maine Legislature when attached', officialUrl: maineStatuteUrl(statute.title, statute.section) })
  }
  const regulation = parseEcfrReference(q)
  if (regulation) {
    candidates.push({ provider: 'ecfr', kind: 'regulation', reference: regulation.reference, citation: `${regulation.title} C.F.R. § ${regulation.section}`, title: 'Code of Federal Regulations', detail: 'Read from the eCFR when attached', officialUrl: `https://www.ecfr.gov/current/title-${regulation.title}/section-${regulation.section}` })
  }
  const lawCourt = parseMaineLawCourtReference(q)
  if (lawCourt) {
    const rows = await lawCourtIndex(lawCourt.year).catch(() => [])
    const row = rows.find((item) => item.citation === lawCourt.citation)
    if (row) candidates.push({ provider: 'maine_law_court', kind: 'judgment', reference: lawCourt.reference, citation: `${row.caseName}, ${row.citation}`, title: row.caseName, detail: `Maine Supreme Judicial Court · decided ${row.decided}`, officialUrl: `https://www.courts.maine.gov/courts/sjc/lawcourt/${lawCourt.year}/${row.file}` })
    else notices.push(`${lawCourt.citation} is not on the court's published-opinion list.`)
  }
  if (candidates.length) return { candidates, notices }

  const searches: Array<[string, Promise<SourceCandidate[]>]> = [
    ['Maine Law Court case names', searchLawCourt(q)],
    ['eCFR', searchEcfr(q)],
  ]
  if (courtListenerConfigured()) searches.push(['CourtListener', searchCourtListener(q)])
  else notices.push('CourtListener case-law search turns on when the firm adds its CourtListener API token.')
  const settled = await Promise.allSettled(searches.map(([, promise]) => promise))
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') candidates.push(...result.value)
    else notices.push(`${searches[index][0]} could not be searched just now.`)
  })
  if (!candidates.length) notices.push('Nothing matched. Maine statutes are found by citation, e.g. 19-A M.R.S. § 1657.')
  return { candidates, notices }
}
