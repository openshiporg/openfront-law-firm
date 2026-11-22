const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../features/keystone/lib/legal-sources/parse.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const mod = { exports: {} }
new Function('exports', 'module', 'require', js)(mod.exports, mod, require)
const p = mod.exports
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures/legal-sources', name), 'utf8')

test('a Maine statute reference is read in the forms lawyers type', () => {
  assert.deepEqual(p.parseMaineStatuteReference('19-A M.R.S. § 1657'), { title: '19-A', section: '1657', reference: '19-A:1657' })
  assert.deepEqual(p.parseMaineStatuteReference('18-c §3-401'), { title: '18-C', section: '3-401', reference: '18-C:3-401' })
  assert.equal(p.parseMaineStatuteReference('custody relocation'), null)
  assert.equal(p.maineStatuteUrl('19-A', '1657'), 'https://legislature.maine.gov/statutes/19-A/title19-Asec1657.html')
})

test('19-A M.R.S. § 1657 splits on its own subsections and lettered paragraphs', () => {
  const parsed = p.parseMaineStatuteHtml(fixture('me-19-A-1657.html'), '19-A', '1657')
  assert.equal(parsed.citation, '19-A M.R.S. § 1657')
  assert.equal(parsed.title, 'Modification or termination of orders for parental rights and responsibilities')
  const anchors = parsed.paragraphs.map((x) => x.anchor)
  assert.deepEqual(anchors.slice(0, 3), ['s1', 's1-A', 's1-B'])
  assert.ok(anchors.includes('s2-A-1'))
  assert.ok(anchors.includes('s3'))
  assert.equal(new Set(anchors).size, anchors.length)
  const a1 = parsed.paragraphs.find((x) => x.anchor === 's2-A-1')
  assert.equal(a1.label, '§ 1657(2)(A-1)')
  assert.match(a1.text, /more than 60 miles/)
  assert.ok(parsed.paragraphs.every((x) => !/PL 1995/.test(x.text)), 'history notes stay out of the text')
})

test('19-A M.R.S. § 2001(5)(B) keeps its official label', () => {
  const parsed = p.parseMaineStatuteHtml(fixture('me-19-A-2001.html'), '19-A', '2001')
  const b = parsed.paragraphs.find((x) => x.anchor === 's5-B')
  assert.equal(b.label, '§ 2001(5)(B)')
  assert.match(b.text, /in-kind payments/)
})

test('an eCFR section keeps its nested designations', () => {
  const parsed = p.parseEcfrXml(fixture('ecfr-45-309.105.xml'), '45', '309.105')
  assert.equal(parsed.citation, '45 C.F.R. § 309.105')
  const anchors = parsed.paragraphs.map((x) => x.anchor)
  assert.ok(anchors.includes('p-309.105(a)(1)'))
  assert.ok(anchors.includes('p-309.105(a)(3)(ii)'))
  assert.equal(new Set(anchors).size, anchors.length)
  assert.deepEqual(p.parseEcfrReference('45 CFR 309.105'), { title: '45', section: '309.105', reference: '45:309.105' })
})

test('the Law Court index lists each opinion with its official cite and PDF', () => {
  const rows = p.parseLawCourtIndex(fixture('lawcourt-2024-index.html'))
  assert.ok(rows.length > 50)
  const howard = rows.find((row) => row.citation === '2024 ME 9')
  assert.equal(howard.file, '24me009.pdf')
  assert.match(howard.caseName, /Howard/)
  assert.deepEqual(p.parseMaineLawCourtReference('2024 ME 9'), { year: 2024, number: 9, reference: '2024:9', citation: '2024 ME 9' })
})

test('an opinion splits on the court’s own ¶ numbers', () => {
  const paras = p.splitOpinionParagraphs('DARCY L. HOWARD v. PATRICK S. WHITE\n[¶1] Patrick S. White appeals.\n[¶2] In December 2019, Howard filed\na complaint.\n[¶ 3] We vacate.')
  assert.deepEqual(paras.map((x) => x.anchor), ['caption', 'para-1', 'para-2', 'para-3'])
  assert.equal(paras[2].text, 'In December 2019, Howard filed a complaint.')
  assert.equal(paras[3].label, '¶ 3')
})

test('a CourtListener opinion without printed ¶ numbers is numbered, never called official', () => {
  const paras = p.parseCourtListenerOpinion('<p>First.</p><p>Second &amp; last.</p>', '')
  assert.deepEqual(paras.map((x) => [x.anchor, x.label, x.text]), [['p-1', 'para. 1', 'First.'], ['p-2', 'para. 2', 'Second & last.']])
})

test('each sentence of a note owns the citations written after it', () => {
  const body = 'An order may be modified as circumstances require. [[cite:aaaaaaaa1]] Relocating more than 60 miles is presumed to disrupt contact.[[cite:bbbbbbbb2]][[cite:cccccccc3]] The client prefers mediation.\n# Next steps\nFile under 19-A M.R.S. § 1657. [[cite:aaaaaaaa1]]'
  const blocks = p.parseNoteBody(body)
  assert.equal(blocks.length, 3)
  assert.deepEqual(blocks[0].sentences.map((s) => s.citations), [['aaaaaaaa1'], ['bbbbbbbb2', 'cccccccc3'], []])
  assert.equal(blocks[0].sentences[2].text, 'The client prefers mediation.')
  assert.equal(blocks[1].kind, 'heading')
  assert.equal(blocks[2].sentences.length, 1, 'M.R.S. does not end the sentence')
  assert.deepEqual(blocks[2].sentences[0].citations, ['aaaaaaaa1'])
  assert.deepEqual(p.noteSupport(body), { claims: 4, supported: 3, unsupported: 1 })
})

test('Howard v. White is one sentence', () => {
  const [block] = p.parseNoteBody('In Howard v. White, the court vacated the order. [[cite:aaaaaaaa1]]')
  assert.equal(block.sentences.length, 1)
})

test('a citation that names no retrieved paragraph is removed and reported', () => {
  const { body, removed } = p.stripUnknownCitations('A claim. [[cite:aaaaaaaa1]] Another. [[cite:zzzzzzzz9]]', new Set(['aaaaaaaa1']))
  assert.equal(body.trim(), 'A claim. [[cite:aaaaaaaa1]] Another.')
  assert.deepEqual(removed, ['zzzzzzzz9'])
})
