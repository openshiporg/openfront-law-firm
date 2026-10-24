import type { Context } from '.keystone/types'
import { randomUUID } from 'node:crypto'
import { isHumanIdentitySession } from '../access'
import { isLocalFixtureFirm } from '../lib/local-fixture'
import { runSerializableTransaction } from '../lib/transactions'
import { sha256Digest } from '../lib/digests'
import { recordAuditEvent } from './workflow-helpers'
import { assertCurrentCommandActor } from './command-authority'
import { adversePartyContact, normalizeConflictTerm, parseAdversePartyNames } from './intakeWorkflows'
import { loadActiveHumanSession } from '../lib/machine-auth'
import {
  FIRST_CONTACT_ACKNOWLEDGMENT,
  FIXTURE_FIRST_CONTACT_NOTICE,
  FirstContactValidationError,
  firstContactVersion,
  hasNamedOpposingParty,
  validateFirstContact,
} from '../../storefront/lib/first-contact'

type PublicMode = 'fixture' | 'live'
type AdmittedFirm = { firm: any; mode: PublicMode; policy: any | null }

/**
 * Public customer admission for exactly one active firm deployment. The owned
 * offline fixture is admitted only by the fixture validator; a real firm only
 * through its operator-published PublicSitePolicy (privacy notice for accounts,
 * first-contact notice for booking). Synthetic firms are never treated as live.
 */
/** Servicing accepted records is not admission to new business. The deployment
 * and fictional-local guards still apply; public policy toggles do not erase
 * a verified account's accepted history or original command receipt. */
async function servicingFirm(tx: any) {
  await tx.$executeRaw`SELECT id FROM "Firm" WHERE status = 'active' ORDER BY id FOR SHARE`
  const firms = await tx.firm.findMany({ where: { status: 'active' }, take: 2 })
  if (firms.length !== 1) return null
  const firm = firms[0]
  if (firm.isDemo && !await isLocalFixtureFirm(tx, firm.id)) return null
  return firm
}
async function publicFirm(tx: any, capability: 'accounts' | 'booking'): Promise<AdmittedFirm | null> {
  const firm = await servicingFirm(tx)
  if (!firm) return null
  if (await isLocalFixtureFirm(tx, firm.id)) return { firm, mode: 'fixture', policy: null }
  if (firm.isDemo) return null
  const policy = await tx.publicSitePolicy.findFirst({ where: { firmId: firm.id, status: 'published' } })
  if (!policy?.publicAccountsEnabled || !String(policy.privacyNotice ?? '').trim()) return null
  if (capability === 'booking' && (!policy.publicBookingEnabled || !String(policy.firstContactNotice ?? '').trim())) return null
  return { firm, mode: 'live', policy }
}
async function account(tx: any, context: Context) {
  const session = context.session
  if (!isHumanIdentitySession(session) || session.listKey !== 'User') throw new Error('Sign in to your account.')
  await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${session.itemId} FOR SHARE`
  const user = await tx.user.findUnique({ where: { id: session.itemId }, select: { id: true, name: true, email: true, status: true } })
  if (!user || user.status !== 'active') throw new Error('Sign in to your account.')
  return user
}
function dto(row: any) {
  return { id: row.id, serviceTitle: row.serviceTitle, feeMinor: row.feeMinor, currencyCode: row.currencyCode, status: row.status, startsAt: row.startsAt?.toISOString() ?? null, endsAt: row.endsAt?.toISOString() ?? null, timezone: row.timezone || 'UTC' }
}

const serviceSelect = { id: true, code: true, publicSlug: true, name: true, description: true, consultationFeeMinor: true, consultationMinutes: true }
function serviceDto(service: any, firm: any) {
  return { ...service, publicSlug: service.publicSlug ?? '', currencyCode: firm.defaultCurrency }
}

const CATALOG_PAGE_SIZE = 24
const HISTORY_PAGE_SIZE = 20

function encodeCursor(value: Record<string, string>) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}
/** Opaque keyset continuation; a malformed or foreign cursor is rejected, never widened. */
function decodeCursor(cursor: string | null | undefined, keys: readonly string[]): Record<string, string> | null {
  if (!cursor) return null
  try {
    const value = JSON.parse(Buffer.from(String(cursor).slice(0, 512), 'base64url').toString('utf8'))
    if (value && typeof value === 'object' && keys.every((key) => typeof value[key] === 'string' && value[key].length <= 256)) return value
  } catch {
    // rejected below
  }
  throw new Error('This page is unavailable. Start again from the first page.')
}

export async function consultationCatalogPage(_root: unknown, args: { cursor?: string | null }, context: Context) {
  return runSerializableTransaction(context.prisma, async (tx: any) => {
    const admitted = await publicFirm(tx, 'booking')
    if (!admitted) return { services: [], nextCursor: null }
    const { firm } = admitted
    const after = decodeCursor(args.cursor, ['s', 'i'])
    const rows = await tx.practiceArea.findMany({
      where: { AND: [
        { firmId: firm.id, status: 'active', isPublic: true, publicSlug: { not: null } },
        after ? { OR: [{ publicSlug: { gt: after.s } }, { publicSlug: after.s, id: { gt: after.i } }] } : {},
      ] },
      orderBy: [{ publicSlug: 'asc' }, { id: 'asc' }], take: CATALOG_PAGE_SIZE + 1, select: serviceSelect,
    })
    const page = rows.slice(0, CATALOG_PAGE_SIZE)
    const last = page.at(-1)
    return { services: page.map((service: any) => serviceDto(service, firm)), nextCursor: rows.length > CATALOG_PAGE_SIZE && last ? encodeCursor({ s: last.publicSlug, i: last.id }) : null }
  })
}
/** First catalog page (kept for existing callers). */
export async function consultationCatalog(root: unknown, _args: unknown, context: Context) {
  return (await consultationCatalogPage(root, {}, context)).services
}
/** One published service, resolved exactly by its normalized public slug or ID. */
export async function consultationService(_root: unknown, args: { slug?: string | null; id?: string | null }, context: Context) {
  if (Boolean(args.slug) === Boolean(args.id)) throw new Error('Provide a service slug or ID.')
  return runSerializableTransaction(context.prisma, async (tx: any) => {
    const admitted = await publicFirm(tx, 'booking')
    if (!admitted) return null
    const { firm } = admitted
    const target = args.slug ? { publicSlug: String(args.slug).slice(0, 80) } : { id: String(args.id) }
    const service = await tx.practiceArea.findFirst({ where: { ...target, firmId: firm.id, status: 'active', isPublic: true }, select: serviceSelect })
    return service ? serviceDto(service, firm) : null
  })
}
export async function registerConsultationAccount(_root: unknown, args: { name: string; email: string; password: string }, context: Context) {
  if (context.session?.itemId) throw new Error('Sign out before creating an account.')
  const name = args.name?.trim(), email = args.email?.trim().toLowerCase()
  if (!name || name.length > 120 || !email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || args.password.length < 12 || args.password.length > 1000) throw new Error('Enter a name, valid email and password of at least 12 characters.')
  if (!await publicFirm(context.prisma, 'accounts')) throw new Error('Account registration is unavailable.')
  try {
    // The scoped operation is explicitly admitted above. Keystone owns password
    // hashing/validation; no role, tenant, bootstrap key or existing contact is claimed.
    const user = await context.sudo().db.User.createOne({ data: { name, email, password: args.password, status: 'active', onboardingStatus: 'completed' } })
    return { id: user.id }
  } catch { throw new Error('Account could not be created. Use another email or sign in.') }
}

// ---------------------------------------------------------------------------
// Availability: one rule set shared by the availability query and the booking
// command, so the customer is only offered times the command will accept.
// ---------------------------------------------------------------------------
const BOOKING_LEAD_MS = 60 * 60_000
const BOOKING_HORIZON_MS = 14 * 86_400_000
const SLOT_STEP_MINUTES = 30
const CANDIDATE_STEP_MS = 15 * 60_000
const MAX_OFFERED_SLOTS = 300
// Fictional offline fixtures only. This is NOT a live office calendar.
export const CONSULTATION_HOURS = { open: 9 * 60, close: 17 * 60, weekdays: new Set([1, 2, 3, 4, 5]) }
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function validTimezone(value: unknown, fallback = 'UTC') {
  const zone = typeof value === 'string' && value ? value : fallback
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format()
    return zone
  } catch {
    return 'UTC'
  }
}
function localClock(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return { weekday: WEEKDAYS.indexOf(part('weekday')), minute: Number(part('hour')) * 60 + Number(part('minute')), day: `${part('year')}-${part('month')}-${part('day')}` }
}
export function insideConsultationHours(start: Date, end: Date, timeZone: string) {
  if (start.getUTCSeconds() || start.getUTCMilliseconds()) return false
  const from = localClock(start, timeZone), to = localClock(end, timeZone)
  return CONSULTATION_HOURS.weekdays.has(from.weekday) && from.day === to.day && from.minute % SLOT_STEP_MINUTES === 0 &&
    from.minute >= CONSULTATION_HOURS.open && to.minute <= CONSULTATION_HOURS.close && to.minute > from.minute
}
function withinHorizon(start: Date, now: number) {
  return start.getTime() >= now + BOOKING_LEAD_MS && start.getTime() <= now + BOOKING_HORIZON_MS
}
type Host = { userId: string; officeId: string | null; timezone: string; session: any }
async function eligibleHosts(tx: any, firm: any): Promise<Host[]> {
  const hosts: Host[] = []
  let after: string | undefined
  for (let page = 0; page < 32; page++) {
    const memberships = await tx.firmMembership.findMany({
      where: { firmId: firm.id, status: 'active', user: { status: 'active' }, role: { firmId: firm.id, status: 'active', canManageIntake: true }, OR: [{ primaryOfficeId: null }, { primaryOffice: { status: 'active' } }], ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: 'asc' }, take: 100,
      select: { id: true, userId: true, primaryOfficeId: true, primaryOffice: { select: { status: true, timezone: true } } },
    })
    for (const membership of memberships) {
      const session = await loadActiveHumanSession(tx, membership.userId, firm.id)
      if (!session) continue
      hosts.push({ userId: membership.userId, officeId: membership.primaryOfficeId ?? null, timezone: validTimezone(membership.primaryOffice?.timezone, validTimezone(firm.defaultTimezone)), session })
    }
    if (memberships.length < 100) return hosts
    after = memberships[memberships.length - 1].id
  }
  throw new Error('Consultation capacity could not be fully checked. Contact the firm.')
}
/**
 * Consultation hours are the published weekday office hours (CONSULTATION_HOURS in each
 * host's office time zone). A live firm adopts them by publishing its policy with booking
 * enabled, which the Public site screen states next to the booking switch; publicFirm
 * already requires that publication. Anything else stays closed to new bookings.
 */
function requireConfiguredConsultationCalendar(admitted: AdmittedFirm) {
  if (admitted.mode === 'fixture') return
  if (admitted.mode === 'live' && admitted.policy?.status === 'published' && admitted.policy.publicBookingEnabled) return
  throw new Error('Online consultation scheduling is unavailable. Contact the firm.')
}
function busyWhere(firmId: string, hostId: string, start: Date, end: Date) {
  return { firmId, hostId, status: { in: ['requested', 'scheduled'] }, startsAt: { lt: end }, endsAt: { gt: start } }
}

export async function consultationAvailability(_root: unknown, args: { serviceId: string }, context: Context) {
  return runSerializableTransaction(context.prisma, async (tx: any) => {
    await account(tx, context)
    const admitted = await publicFirm(tx, 'booking')
    if (!admitted) throw new Error('Consultation booking is unavailable.')
    const { firm } = admitted
    requireConfiguredConsultationCalendar(admitted)
    const service = await tx.practiceArea.findFirst({ where: { id: args.serviceId, firmId: firm.id, status: 'active', isPublic: true } })
    if (!service) throw new Error('Service is unavailable.')
    const timezone = validTimezone(firm.defaultTimezone)
    const now = Date.now()
    const hosts = await eligibleHosts(tx, firm)
    const busy = new Map<string, Array<{ start: number; end: number }>>()
    for (const host of hosts) {
      const intervals: Array<{ start: number; end: number }> = []
      let after: string | undefined
      let complete = false
      for (let page = 0; page < 64; page++) {
        const rows = await tx.consultation.findMany({ where: { ...busyWhere(firm.id, host.userId, new Date(now), new Date(now + BOOKING_HORIZON_MS + 86_400_000)), ...(after ? { id: { gt: after } } : {}) }, select: { id: true, startsAt: true, endsAt: true }, orderBy: { id: 'asc' }, take: 256 })
        intervals.push(...rows.map((row: any) => ({ start: row.startsAt.getTime(), end: row.endsAt.getTime() })))
        if (rows.length < 256) { complete = true; break }
        after = rows[rows.length - 1].id
      }
      if (!complete) throw new Error('Consultation capacity could not be fully checked. Contact the firm.')
      busy.set(host.userId, intervals)
    }
    const slots: Array<{ startsAt: string; endsAt: string }> = []
    const first = Math.ceil((now + BOOKING_LEAD_MS) / CANDIDATE_STEP_MS) * CANDIDATE_STEP_MS
    for (let at = first; at <= now + BOOKING_HORIZON_MS && slots.length < MAX_OFFERED_SLOTS; at += CANDIDATE_STEP_MS) {
      const start = new Date(at), end = new Date(at + service.consultationMinutes * 60_000)
      const open = hosts.some((host) => insideConsultationHours(start, end, host.timezone) &&
        !(busy.get(host.userId) ?? []).some((interval) => interval.start < end.getTime() && interval.end > start.getTime()))
      if (open) slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() })
    }
    return { timezone, slots }
  })
}

function currentAcknowledgment({ mode, policy }: AdmittedFirm) {
  const notice = mode === 'fixture' ? FIXTURE_FIRST_CONTACT_NOTICE : String(policy.firstContactNotice).trim()
  return {
    version: firstContactVersion(mode, Number(policy?.firstContactNoticeVersion ?? 0)),
    noticeDigest: sha256Digest(notice),
    acknowledgmentDigest: sha256Digest(FIRST_CONTACT_ACKNOWLEDGMENT),
    privacyNoticeVersion: policy ? Number(policy.privacyNoticeVersion ?? 0) : null,
  }
}

export async function bookClientConsultation(
  _root: unknown,
  args: { serviceId: string; startsAt: string; requestKey: string; summary?: string | null; jurisdiction: string; opposingParties: string; keyDeadline?: string | null; acknowledgmentVersion: string },
  context: Context,
) {
  if (!context.session?.itemId) throw new Error('Sign in to book a consultation.')
  if (!/^[a-f0-9-]{36}$/i.test(args.requestKey)) throw new Error('Invalid consultation request.')
  let firstContact: ReturnType<typeof validateFirstContact>
  try {
    firstContact = validateFirstContact(args)
  } catch (error) {
    if (error instanceof FirstContactValidationError) throw new Error(error.message)
    throw error
  }
  const { summary } = firstContact
  const start = new Date(args.startsAt)
  if (!Number.isFinite(start.getTime())) throw new Error('Select an available time.')
  return runSerializableTransaction(context.prisma, async (tx: any) => {
    const user = await account(tx, context)
    const firm = await servicingFirm(tx)
    if (!firm) throw new Error('Consultation servicing is unavailable.')
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`consultation-request:${firm.id}:${args.requestKey}`}))`
    const fingerprint = sha256Digest({ accountId: user.id, serviceId: args.serviceId, startsAt: start.toISOString(), ...firstContact, acknowledgmentVersion: args.acknowledgmentVersion })
    const prior = await tx.consultation.findUnique({ where: { firmId_requestKey: { firmId: firm.id, requestKey: args.requestKey } } })
    if (prior) {
      if (prior.accountId !== user.id || prior.requestDigest !== fingerprint) throw new Error('Request reference is unavailable for this account or has changed.')
      return dto(prior)
    }
    // Only a NEW effect requires current publication and current notices. An
    // exact owned receipt above retains its original immutable consent snapshot.
    const admitted = await publicFirm(tx, 'booking')
    if (!admitted || admitted.firm.id !== firm.id) throw new Error('Consultation booking is unavailable.')
    const { mode } = admitted
    requireConfiguredConsultationCalendar(admitted) // exact accepted replay above remains available
    const acknowledgment = currentAcknowledgment(admitted)
    if (args.acknowledgmentVersion !== acknowledgment.version) throw new Error('The first-contact notice has changed. Review it and submit again.')
    const service = await tx.practiceArea.findFirst({ where: { id: args.serviceId, firmId: firm.id, status: 'active', isPublic: true } })
    if (!service) throw new Error('Service is unavailable.')
    const end = new Date(start.getTime() + service.consultationMinutes * 60000)
    if (!withinHorizon(start, Date.now())) throw new Error('Select an available time within the next fourteen days.')
    const hosts = await eligibleHosts(tx, firm)
    if (!hosts.length) throw new Error('No consultation host is available.')
    let receiver: Host | null = null
    let insideHours = false
    for (const host of hosts) {
      if (!insideConsultationHours(start, end, host.timezone)) continue
      insideHours = true
      await assertCurrentCommandActor(tx, context.withSession(host.session), 'canManageIntake')
      // All booking writers use this host lock (in membership order); raw Consultation CRUD is omitted.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`consultation-host:${firm.id}:${host.userId}`}))`
      if (!await tx.consultation.count({ where: busyWhere(firm.id, host.userId, start, end) })) {
        receiver = host
        break
      }
    }
    if (!insideHours) throw new Error('Select an available time.')
    if (!receiver) throw new Error('This time is no longer available. Choose another time.')
    const suffix = randomUUID().slice(0, 8).toUpperCase()
    const contact = await tx.contact.create({ data: { firmId: firm.id, firstName: user.name, lastName: '', contactType: 'person', status: 'prospective_client', primaryEmail: user.email, conflictSearchAliases: [] } })
    const intake = await tx.intake.create({ data: { firmId: firm.id, intakeNumber: `INT-${suffix}`, title: `${service.name} consultation`, status: 'new', source: 'website', primaryContactId: contact.id, openedById: receiver.userId, assignedToId: receiver.userId, officeId: receiver.officeId, summary, adversePartySummary: firstContact.opposingParties } })
    await tx.intakeParticipant.create({ data: { firmId: firm.id, intakeId: intake.id, contactId: contact.id, participantRole: 'prospective_client', status: 'active' } })
    const acceptedAt = new Date()
    const snapshot = { version: 2, serviceId: service.id, title: service.name, description: service.description, minutes: service.consultationMinutes, feeMinor: service.consultationFeeMinor, currencyCode: firm.defaultCurrency, isLocalFixture: mode === 'fixture', relationship: 'none', acknowledgmentVersion: acknowledgment.version }
    await tx.intakeSubmission.create({ data: { firmId: firm.id, intakeId: intake.id, submittedByContactId: contact.id, status: 'submitted', schemaVersion: 'consultation-v2', formSchema: { fields: ['service', 'startsAt', 'jurisdiction', 'opposingParties', 'keyDeadline', 'summary', 'acknowledgment'] }, responses: { service: snapshot, startsAt: start.toISOString(), jurisdiction: firstContact.jurisdiction, opposingParties: firstContact.opposingParties, keyDeadline: firstContact.keyDeadline || null, summary, acknowledgment: { ...acknowledgment, acceptedAt: acceptedAt.toISOString() } }, submittedAt: acceptedAt } })
    const check = await tx.conflictCheck.create({ data: { firmId: firm.id, intakeId: intake.id, checkNumber: `CHK-${suffix}`, status: 'requested', requestedById: receiver.userId, searchScope: 'contacts_and_matters', searchVersion: 'v1' } })
    await tx.conflictSearchTerm.create({ data: { firmId: firm.id, checkId: check.id, term: user.name, normalizedTerm: user.name.toLowerCase(), termType: 'person', sourceContactId: contact.id } })
    // Named opposing parties are handled as on a staff intake: each becomes an opposing
    // contact, an adverse-party participant (a matter party on conversion) and a search term.
    if (hasNamedOpposingParty(firstContact.opposingParties)) {
      let names: string[]
      try { names = parseAdversePartyNames(firstContact.opposingParties, [user.name]) } catch { names = [] }
      for (const name of names.slice(0, 25)) {
        const identity = adversePartyContact(name)
        const adverse = await tx.contact.create({ data: { firmId: firm.id, ...identity, status: 'opposing', primaryEmail: '', primaryPhone: '', conflictSearchAliases: [] } })
        await tx.intakeParticipant.create({ data: { firmId: firm.id, intakeId: intake.id, contactId: adverse.id, participantRole: 'adverse_party', status: 'active' } })
        await tx.conflictSearchTerm.create({ data: { firmId: firm.id, checkId: check.id, term: name, normalizedTerm: normalizeConflictTerm(name), termType: identity.contactType, sourceContactId: adverse.id, includeAliases: true } })
      }
      if (!names.length) {
        await tx.conflictSearchTerm.create({ data: { firmId: firm.id, checkId: check.id, term: firstContact.opposingParties.slice(0, 500), normalizedTerm: normalizeConflictTerm(firstContact.opposingParties).slice(0, 500), termType: 'other', includeAliases: false } })
      }
    }
    const row = await tx.consultation.create({ data: { firmId: firm.id, intakeId: intake.id, accountId: user.id, requestKey: args.requestKey, requestDigest: fingerprint, serviceTitle: service.name, serviceSnapshot: snapshot, feeMinor: service.consultationFeeMinor, currencyCode: firm.defaultCurrency, startsAt: start, endsAt: end, status: 'requested', timezone: receiver.timezone, hostId: receiver.userId, officeId: receiver.officeId, participants: { connect: { id: contact.id } } } })
    await recordAuditEvent(tx, { firmId: firm.id, actorUserId: user.id, actorType: 'customer', eventType: 'consultation.requested', category: 'legal_workflow', intakeId: intake.id, metadata: { consultationId: row.id, requestDigest: fingerprint, isLocalFixture: mode === 'fixture', acknowledgmentVersion: acknowledgment.version } })
    return dto(row)
  })
}

export async function customerConsultationPage(_root: unknown, args: { cursor?: string | null }, context: Context) {
  return runSerializableTransaction(context.prisma, async (tx: any) => {
    const user = await account(tx, context)
    const firm = await servicingFirm(tx)
    if (!firm) throw new Error('Appointment history is temporarily unavailable.')
    const after = decodeCursor(args.cursor, ['a', 'c', 'i'])
    if (after && after.a !== user.id) throw new Error('This page is unavailable. Start again from the first page.')
    const keyset = after ? { OR: [{ createdAt: { lt: new Date(after.c) } }, { createdAt: new Date(after.c), id: { gt: after.i } }] } : {}
    const rows = await tx.consultation.findMany({
      where: { AND: [{ accountId: user.id, firmId: firm.id }, keyset] },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: HISTORY_PAGE_SIZE + 1,
    })
    const page = rows.slice(0, HISTORY_PAGE_SIZE)
    const last = page.at(-1)
    return { appointments: page.map(dto), nextCursor: rows.length > HISTORY_PAGE_SIZE && last ? encodeCursor({ a: user.id, c: last.createdAt.toISOString(), i: last.id }) : null }
  })
}
/** First history page (kept for existing callers). */
export async function customerConsultations(root: unknown, _args: unknown, context: Context) {
  return (await customerConsultationPage(root, {}, context)).appointments
}
export async function customerConsultation(_root: unknown, args: { id: string }, context: Context) {
  return runSerializableTransaction(context.prisma, async (tx: any) => {
    const user = await account(tx, context)
    const firm = await servicingFirm(tx)
    if (!firm) throw new Error('Appointment history is temporarily unavailable.')
    const row = await tx.consultation.findFirst({ where: { id: args.id, accountId: user.id, firmId: firm.id } })
    return row ? dto(row) : null
  })
}
