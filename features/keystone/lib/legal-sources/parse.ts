/* Pure parsers for official legal sources. Each turns the official text into numbered
 * paragraphs with a stable anchor derived from the source's own numbering (statute
 * subsection letters, CFR paragraph designations, the court's own ¶ numbers), so a
 * citation keeps pointing at the same words after a re-read. No network, no imports. */

export type ParsedParagraph = { anchor: string; label: string; text: string }

export type ParsedSource = {
  citation: string
  title: string
  status: string
  sourceAsOf: string | null
  paragraphs: ParsedParagraph[]
}

const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', sect: '§', para: '¶', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' }

export function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const point = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(point) && point > 0 && point < 0x110000 ? String.fromCodePoint(point) : whole
    }
    return named[code.toLowerCase()] ?? whole
  })
}

export function cleanText(html: string) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/** Gives every anchor a unique value inside one source while keeping the first use stable. */
function uniqueAnchors(paragraphs: ParsedParagraph[]) {
  const seen = new Map<string, number>()
  return paragraphs.map((paragraph) => {
    const count = (seen.get(paragraph.anchor) ?? 0) + 1
    seen.set(paragraph.anchor, count)
    return count === 1 ? paragraph : { ...paragraph, anchor: `${paragraph.anchor}-${count}` }
  })
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ─── Maine Revised Statutes (legislature.maine.gov) ────────────────────────────

export const maineStatuteReference = /^(\d{1,2}(?:-[A-Z])?)\s*(?:M\.?R\.?S\.?A?\.?)?\s*(?:§+|sec(?:tion)?\.?)?\s*(\d{1,4}(?:-[0-9A-Z]+)*)$/i

export function parseMaineStatuteReference(input: string) {
  const match = input.trim().replace(/\s+/g, ' ').match(maineStatuteReference)
  if (!match) return null
  const title = match[1].toUpperCase()
  const section = match[2].toUpperCase()
  return { title, section, reference: `${title}:${section}` }
}

export function maineStatuteUrl(title: string, section: string) {
  return `https://legislature.maine.gov/statutes/${title}/title${title}sec${section}.html`
}

/** Splits a Maine statute section page into its intro, subsections, lettered paragraphs
 * and subparagraphs. Anchors follow the official numbering: `s5`, `s5-B`, `s5-B-1`. */
export function parseMaineStatuteHtml(html: string, title: string, section: string): ParsedSource {
  const heading = cleanText(html.match(/<h3 class="heading_section">([\s\S]*?)<\/h3>/)?.[1] ?? '')
  if (!heading) throw new Error('The statute page has no section heading.')
  const start = html.indexOf('class="row section-content"')
  const end = html.indexOf('class="qhistory"', start)
  const body = html.slice(start, end > start ? end : undefined)
  const sectionClass = body.match(/class="col-sm-12 MRSSection ([a-z_]+)"/)?.[1] ?? 'status_current'
  const opens = [...body.matchAll(/<div class="mrs-text([^"]*)"/g)]
  const paragraphs: ParsedParagraph[] = []
  let subsection: string | null = null
  let letter: string | null = null
  for (let index = 0; index < opens.length; index += 1) {
    const open = opens[index]
    const segment = body.slice(open.index!, opens[index + 1]?.index ?? body.length)
    const classes = open[1]
    const withoutHistory = segment.replace(/<span class="bhistory">[\s\S]*?<\/span>/g, ' ')
    let text = cleanText(withoutHistory.replace(/^<div[^>]*>/, ''))
    if (!text) continue
    let anchor: string
    let label: string
    if (/MRSSubPara/.test(classes)) {
      const id = text.match(/^\((\d+|[a-z]{1,3})\)\s*/)
      const sub = id?.[1] ?? String(paragraphs.length + 1)
      anchor = ['s' + (subsection ?? '0'), letter, sub].filter(Boolean).join('-')
      label = `§ ${section}${subsection ? `(${subsection})` : ''}${letter ? `(${letter})` : ''}(${sub})`
    } else if (/MRSLetteredPara/.test(classes)) {
      const id = text.match(/^([A-Z](?:-\d+)?)\.\s*/)
      letter = id?.[1] ?? letter ?? 'A'
      anchor = ['s' + (subsection ?? '0'), letter].join('-')
      label = `§ ${section}${subsection ? `(${subsection})` : ''}(${letter})`
    } else if (/indpara/.test(classes)) {
      const headnote = segment.match(/<span class="headnote">\s*(\d+(?:-[A-Z])?)\.\s/)
      if (headnote) {
        subsection = headnote[1]
        letter = null
        anchor = `s${subsection}`
        label = `§ ${section}(${subsection})`
      } else if (!subsection && !letter) {
        anchor = 'intro'
        label = `§ ${section}`
      } else {
        // Unnumbered flush text after a list belongs to the enclosing subsection.
        anchor = `s${subsection ?? '0'}${letter ? `-${letter}` : ''}-text`
        label = `§ ${section}${subsection ? `(${subsection})` : ''}`
      }
    } else {
      // Inline continuation of the previous unit (e.g. a bold run inside a paragraph).
      const previous = paragraphs[paragraphs.length - 1]
      if (previous) { previous.text = `${previous.text} ${text}`; continue }
      anchor = 'intro'
      label = `§ ${section}`
    }
    text = text.replace(/\s+/g, ' ').trim()
    paragraphs.push({ anchor, label, text })
  }
  if (!paragraphs.length) {
    const flat = cleanText(body.replace(/<span class="bhistory">[\s\S]*?<\/span>/g, ' ').replace(/<h3[\s\S]*?<\/h3>/, ''))
    if (flat) paragraphs.push({ anchor: 'intro', label: `§ ${section}`, text: flat })
  }
  const asOf = html.match(/Data for this page extracted on ([0-9/]+)/)?.[1] ?? null
  const status = /REPEALED/i.test(heading) || /repealed/.test(sectionClass) ? 'repealed' : 'current'
  return {
    citation: `${title} M.R.S. § ${section}`,
    title: heading.replace(/^§\s*[^.]+\.\s*/, ''),
    status,
    sourceAsOf: asOf,
    paragraphs: uniqueAnchors(paragraphs),
  }
}

// ─── Electronic Code of Federal Regulations (ecfr.gov) ─────────────────────────

export const ecfrReference = /^(\d{1,2})\s*(?:C\.?F\.?R\.?)?\s*(?:§+|part|sec(?:tion)?\.?)?\s*(\d{1,4}\.\d{1,5}[a-z]?)$/i

export function parseEcfrReference(input: string) {
  const match = input.trim().replace(/\s+/g, ' ').match(ecfrReference)
  if (!match) return null
  return { title: match[1], section: match[2], reference: `${match[1]}:${match[2]}` }
}

const roman = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'])

/** CFR designations nest (a) → (1) → (i) → (A). A lone `(i)` after `(h)` is a letter. */
function designationLevel(id: string, previousLetter: string | null) {
  if (/^\d+$/.test(id)) return 1
  if (/^[A-Z]+$/.test(id)) return 3
  if (roman.has(id) && !(id === 'i' && previousLetter === 'h') && !(id === 'v' && previousLetter === 'u') && !(id === 'x' && previousLetter === 'w')) return 2
  return 0
}

export function parseEcfrXml(xml: string, title: string, section: string): ParsedSource {
  const head = cleanText(xml.match(/<HEAD>([\s\S]*?)<\/HEAD>/)?.[1] ?? '')
  if (!head) throw new Error('The regulation has no section heading.')
  const path: string[] = []
  const paragraphs: ParsedParagraph[] = []
  for (const match of xml.matchAll(/<P>([\s\S]*?)<\/P>/g)) {
    const text = cleanText(match[1])
    if (!text) continue
    const ids: string[] = []
    let rest = text
    const lead = rest.match(/^\(([a-z]{1,4}|\d{1,3}|[A-Z]{1,2})\)\s*/)
    if (lead) {
      ids.push(lead[1])
      rest = rest.slice(lead[0].length)
      const nested = rest.match(/^[^()]{0,160}?(?::|—|\.)\s*\(([a-z]{1,4}|\d{1,3}|[A-Z]{1,2})\)\s/)
      if (nested && designationLevel(nested[1], null) > designationLevel(ids[0], path[0] ?? null)) ids.push(nested[1])
    }
    if (!ids.length) {
      paragraphs.push({ anchor: paragraphs.length ? `text-${paragraphs.length}` : 'intro', label: `§ ${section}`, text })
      continue
    }
    for (const id of ids) {
      const level = designationLevel(id, path[0] ?? null)
      path.length = level
      path[level] = id
    }
    const designation = path.map((id) => `(${id})`).join('')
    paragraphs.push({ anchor: `p-${section}${designation}`, label: `§ ${section}${designation}`, text })
  }
  return {
    citation: `${title} C.F.R. § ${section}`,
    title: head.replace(/^§\s*\S+\s*/, ''),
    status: 'current',
    sourceAsOf: null,
    paragraphs: uniqueAnchors(paragraphs),
  }
}

// ─── Maine Supreme Judicial Court sitting as the Law Court (courts.maine.gov) ──

export const maineLawCourtReference = /^(\d{4})\s*ME\s*(\d{1,3})$/i

export function parseMaineLawCourtReference(input: string) {
  const match = input.trim().replace(/\s+/g, ' ').match(maineLawCourtReference)
  if (!match) return null
  const year = Number(match[1])
  const number = Number(match[2])
  if (year < 2006 || number < 1) return null
  return { year, number, reference: `${year}:${number}`, citation: `${year} ME ${number}` }
}

export type LawCourtIndexRow = { citation: string; caseName: string; decided: string; file: string }

/** Reads one year's published-opinion table. Rows carry the official cite and PDF file. */
export function parseLawCourtIndex(html: string): LawCourtIndexRow[] {
  const rows: LawCourtIndexRow[] = []
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1])
    if (cells.length < 2) continue
    const citation = cleanText(cells[0]).replace(/\s+/g, ' ')
    if (!maineLawCourtReference.test(citation)) continue
    const link = cells[1].match(/href="([^"]+\.pdf)"/i)
    if (!link) continue
    rows.push({ citation: citation.toUpperCase().replace(/\s*ME\s*/, ' ME '), caseName: cleanText(cells[1]), decided: cleanText(cells[2] ?? ''), file: link[1].split('/').pop()! })
  }
  return rows
}

/** Splits extracted opinion text on the court's own paragraph numbers `[¶12]`. The text
 * before ¶1 is the caption; a separate opinion's paragraphs keep their printed numbers. */
export function splitOpinionParagraphs(text: string): ParsedParagraph[] {
  const normalized = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ')
  const parts = normalized.split(/\[\s*¶\s*(\d{1,4})\s*\]/)
  const paragraphs: ParsedParagraph[] = []
  const caption = parts[0].replace(/\s+/g, ' ').trim()
  if (caption) paragraphs.push({ anchor: 'caption', label: 'Caption', text: caption })
  for (let index = 1; index < parts.length; index += 2) {
    const number = parts[index]
    const body = (parts[index + 1] ?? '').replace(/-\n(?=[a-z])/g, '').replace(/\s+/g, ' ').trim()
    if (!body) continue
    paragraphs.push({ anchor: `para-${number}`, label: `¶ ${number}`, text: body })
  }
  return uniqueAnchors(paragraphs)
}

// ─── CourtListener (Free Law Project) ──────────────────────────────────────────

/** Uses the opinion's own ¶ numbers when the court printed them; otherwise each HTML
 * paragraph is numbered in order and labelled "para." so it is never read as official. */
export function parseCourtListenerOpinion(html: string, plain: string): ParsedParagraph[] {
  const source = html || ''
  const blocks = source
    ? [...source.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => cleanText(match[1])).filter(Boolean)
    : plain.split(/\n\s*\n/).map((block) => block.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const joined = blocks.join('\n')
  if (/\[\s*¶\s*1\s*\]/.test(joined)) return splitOpinionParagraphs(joined)
  return uniqueAnchors(blocks.map((text, index) => ({ anchor: `p-${index + 1}`, label: `para. ${index + 1}`, text })))
}

export function courtListenerAnchorSlug(value: string) {
  return slug(value)
}

// ─── Citations inside research notes ───────────────────────────────────────────

/** A citation token names one retrieved paragraph by its record id: `[[cite:abc123]]`. */
export const citationToken = /\[\[cite:([a-z0-9]{8,40})\]\]/g

export type NoteSentence = { text: string; citations: string[] }
export type NoteBlock = { kind: 'heading' | 'paragraph'; text: string; sentences: NoteSentence[] }

/** Breaks a note into blocks and sentences. A sentence owns the citation tokens written
 * inside it or straight after its full stop, so "… modified. [[cite:x]]" is supported. */
export function parseNoteBody(body: string): NoteBlock[] {
  const blocks: NoteBlock[] = []
  for (const raw of body.replace(/\r/g, '').split(/\n+/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^#{1,3}\s/.test(line)) {
      blocks.push({ kind: 'heading', text: line.replace(/^#{1,3}\s+/, ''), sentences: [] })
      continue
    }
    const sentences = splitSentences(line)
    blocks.push({ kind: 'paragraph', text: line, sentences })
  }
  return blocks
}

// "19-A M.R.S. § 1657", "Howard v. White" and "Id. at 3" must not end a sentence.
const abbreviation = /(?:^|[\s(])(?:M\.R\.S|U\.S\.C|C\.F\.R|Me|Id|id|v|vs|No|Nos|Stat|Pub|Inc|Co|Corp|Ltd|St|Mr|Mrs|Ms|Dr|J|JJ|C\.J|A\.\dd|P\.L|Pt|ch|c|e\.g|i\.e|cf|Cf|See|see|subd|para|sec|art|[A-Z])\.$/

/** Ends a sentence at . ! or ? followed by a space, the end, or a citation token, unless
 * the word before it is a legal abbreviation. Tokens right after the stop stay with it. */
function splitSentences(line: string): NoteSentence[] {
  const sentences: NoteSentence[] = []
  let buffer = ''
  let index = 0
  const flush = () => {
    const citations = [...buffer.matchAll(citationToken)].map((token) => token[1])
    const text = buffer.replace(citationToken, '').replace(/\s+/g, ' ').trim()
    buffer = ''
    if (text) sentences.push({ text, citations })
    else if (citations.length && sentences.length) sentences[sentences.length - 1].citations.push(...citations)
  }
  while (index < line.length) {
    const token = line.slice(index).match(/^\[\[cite:[a-z0-9]{8,40}\]\]/)
    if (token) { buffer += token[0]; index += token[0].length; continue }
    const char = line[index]
    buffer += char
    index += 1
    if (!/[.!?]/.test(char)) continue
    while (index < line.length && /[.!?)\u201d"']/.test(line[index])) { buffer += line[index]; index += 1 }
    const next = line.slice(index)
    if (next && !/^\s/.test(next) && !next.startsWith('[[')) continue
    if (char === '.' && abbreviation.test(buffer.replace(citationToken, '').trimEnd())) continue
    // Keep citation tokens written straight after the full stop with this sentence.
    for (;;) {
      const trailing = line.slice(index).match(/^\s*\[\[cite:[a-z0-9]{8,40}\]\]/)
      if (!trailing) break
      buffer += trailing[0]
      index += trailing[0].length
    }
    flush()
  }
  flush()
  return sentences
}

export function noteCitationIds(body: string) {
  return [...new Set([...body.matchAll(citationToken)].map((match) => match[1]))]
}

/** Removes tokens that do not name a retrieved paragraph on the matter. */
export function stripUnknownCitations(body: string, known: Set<string>) {
  const removed: string[] = []
  const cleaned = body.replace(citationToken, (token, id: string) => {
    if (known.has(id)) return token
    removed.push(id)
    return ''
  })
  return { body: cleaned.replace(/[ \t]{2,}/g, ' '), removed }
}

export function noteSupport(body: string) {
  let claims = 0
  let supported = 0
  for (const block of parseNoteBody(body)) {
    for (const sentence of block.sentences) {
      claims += 1
      if (sentence.citations.length) supported += 1
    }
  }
  return { claims, supported, unsupported: claims - supported }
}
