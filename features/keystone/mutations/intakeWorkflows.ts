import { assertCurrentCommandActor } from "./command-authority";
import { randomUUID } from 'node:crypto'

import type { Context } from '.keystone/types'

import { isInteractiveHumanSession, permissions } from '../access'
import { blockingConflictCheckStatuses } from '../lib/conflict-status'
import { sha256Digest } from '../lib/digests'
import { assertLifecycleTransition } from '../lib/lifecycles'
import { runSerializableTransaction } from '../lib/transactions'
import { recordAuditEvent, requirePermission } from './workflow-helpers'

const MAX_ADVERSE_PARTIES = 25
const organizationSuffix = /\b(inc|incorporated|llc|l\.l\.c|llp|lp|ltd|limited|corp|corporation|company|co|plc|pllc|pc|gmbh|ag|sa|bv|nv|bank|trust|group|holdings|partners|association|foundation|university|hospital|authority|department|agency|county|city)\.?$/i

export function normalizeConflictTerm(value: string) {
  return value.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** Known adverse parties arrive as free text. Each line, semicolon or comma separated
 * entry is one name; duplicates and the client's own name are dropped. */
export function parseAdversePartyNames(summary: string | null, exclude: string[] = []) {
  if (!summary) return []
  const seen = new Set(exclude.map(normalizeConflictTerm).filter(Boolean))
  const names: string[] = []
  for (const raw of summary.split(/[\r\n;,]+/)) {
    const name = raw.replace(/^[\s\-*•\d.)]+/, '').replace(/\s+/g, ' ').trim()
    const normalized = normalizeConflictTerm(name)
    if (!normalized || seen.has(normalized)) continue
    if (name.length > 200) throw new Error('Each known adverse party must be 200 characters or fewer.')
    seen.add(normalized)
    names.push(name)
  }
  if (names.length > MAX_ADVERSE_PARTIES) throw new Error(`List at most ${MAX_ADVERSE_PARTIES} known adverse parties.`)
  return names
}

/** A person's full name as first and last name: the last word is the surname. */
export function splitPersonName(name: string) {
  const parts = name.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lastName = parts.length > 1 ? parts.pop() as string : ''
  return { firstName: parts.join(' '), lastName }
}

export function adversePartyContact(name: string) {
  if (organizationSuffix.test(name)) return { contactType: 'organization' as const, firstName: '', lastName: '', organizationName: name }
  const parts = name.split(' ')
  const lastName = parts.length > 1 ? parts.pop() as string : ''
  return { contactType: 'person' as const, firstName: parts.join(' '), lastName, organizationName: '' }
}

const intakeClearancePath: Record<string, string[]> = {
  new: ['screening', 'conflict_review', 'decision'],
  screening: ['conflict_review', 'decision'],
  conflict_review: ['decision'],
  consultation: ['decision'],
}

/** Lifecycle walks the intake card takes on its own as its conflict check and consultation
 * progress (Clio Grow style): a running check puts it in conflict review; a cleared check
 * moves it to the consultation stage while a consultation is still open, otherwise to
 * decision; a completed consultation moves it to decision once conflicts are clear. */
export const intakeAutoPaths: Record<'conflict_review' | 'consultation' | 'decision', Record<string, string[]>> = {
  conflict_review: { new: ['screening', 'conflict_review'], screening: ['conflict_review'] },
  consultation: { new: ['screening', 'conflict_review', 'consultation'], screening: ['conflict_review', 'consultation'], conflict_review: ['consultation'] },
  decision: intakeClearancePath,
}

async function intakeAutomationActor(tx: any, context: Context) {
  const session = context.session as any
  if (!isInteractiveHumanSession(session) || !permissions.canManageIntake({ session })) return false
  try {
    await assertCurrentCommandActor(tx, context, 'canManageIntake')
    return true
  } catch {
    return false
  }
}

async function walkIntake(tx: any, input: { firmId: string; userId: string; intakeId: string; target: keyof typeof intakeAutoPaths; cause: string; metadata: Record<string, unknown>; gate?: (intake: any) => Promise<boolean> }) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`intake:${input.firmId}:${input.intakeId}`}))`
  const intake = await tx.intake.findFirst({ where: { id: input.intakeId, firmId: input.firmId }, select: { id: true, status: true } })
  const path = intake ? intakeAutoPaths[input.target][intake.status] : undefined
  if (!intake || !path) return null
  if (input.gate && !await input.gate(intake)) return null
  let fromStatus = intake.status as string
  for (const toStatus of path) {
    assertLifecycleTransition('intake', fromStatus, toStatus)
    await recordAuditEvent(tx, {
      firmId: input.firmId,
      eventType: `intake.${toStatus}`,
      category: 'legal_workflow',
      actorUserId: input.userId,
      intakeId: intake.id,
      metadata: { fromStatus, toStatus, cause: input.cause, ...input.metadata },
    })
    fromStatus = toStatus
  }
  await tx.intake.update({ where: { id: intake.id }, data: { status: fromStatus } })
  return { intakeId: intake.id, fromStatus: intake.status as string, toStatus: fromStatus }
}

/** A conflict check that starts running puts its intake into conflict review. */
export async function advanceIntakeOnConflictProgress(tx: any, context: Context, input: { firmId: string; userId: string; intakeId: string; checkId: string; checkStatus: string }) {
  if (!['running', 'review_required'].includes(input.checkStatus)) return null
  if (!await intakeAutomationActor(tx, context)) return null
  return walkIntake(tx, { ...input, target: 'conflict_review', cause: `conflict_check_${input.checkStatus}`, metadata: { conflictCheckId: input.checkId } })
}

async function conflictsClear(tx: any, firmId: string, intakeId: string) {
  const [cleared, blocking] = await Promise.all([
    tx.conflictCheck.count({ where: { firmId, intakeId, status: 'cleared' } }),
    tx.conflictCheck.count({ where: { firmId, intakeId, status: { in: [...blockingConflictCheckStatuses] } } }),
  ])
  return Boolean(cleared) && !blocking
}

/** A completed consultation moves its intake to decision once its conflicts are clear. */
export async function advanceIntakeAfterConsultation(tx: any, context: Context, input: { firmId: string; userId: string; intakeId: string; consultationId: string; outcome?: string | null }) {
  if (!await intakeAutomationActor(tx, context)) return null
  return walkIntake(tx, {
    ...input,
    target: 'decision',
    cause: 'consultation_completed',
    metadata: { consultationId: input.consultationId, outcome: input.outcome ?? null },
    gate: (intake) => conflictsClear(tx, input.firmId, intake.id),
  })
}

/** Runs inside finalizeConflictCheck's transaction once a check is cleared. When the
 * intake has a cleared check and no blocking check left, and the reviewer may manage
 * intake, the intake walks its lifecycle to the decision stage. Conversion stays an
 * explicit, reasoned command. A conflict_found result never reaches this. */
export async function advanceIntakeAfterConflictClearance(
  tx: any,
  context: Context,
  input: { firmId: string; userId: string; intakeId: string; checkId: string },
) {
  if (!await intakeAutomationActor(tx, context)) return null
  // An open consultation is the next step: stop at the consultation stage until it is held.
  const openConsultations = await tx.consultation.count({ where: { firmId: input.firmId, intakeId: input.intakeId, status: { in: ['requested', 'scheduled'] } } })
  return walkIntake(tx, {
    ...input,
    target: openConsultations ? 'consultation' : 'decision',
    cause: 'conflict_check_cleared',
    metadata: { conflictCheckId: input.checkId, reasonDigest: sha256Digest('Conflict check cleared.') },
    gate: (intake) => conflictsClear(tx, input.firmId, intake.id),
  })
}

function text(value: unknown, label: string, maximum: number, required = true) {
  const result = typeof value === 'string' ? value.trim() : ''
  if ((required && !result) || result.length > maximum) throw new Error(`${label} ${required ? 'is required and ' : ''}must be ${maximum} characters or fewer.`)
  return result || null
}

export async function startClientIntake(
  _root: unknown,
  args: {
    contactType: string
    firstName?: string | null
    lastName?: string | null
    organizationName?: string | null
    email?: string | null
    phone?: string | null
    title: string
    source?: string | null
    summary?: string | null
    adversePartySummary?: string | null
    officeId?: string | null
    practiceAreaId?: string | null
    assignedToId?: string | null
  },
  context: Context,
) {
  const { firmId, userId } = requirePermission(context, 'canManageIntake', { humanOnly: true })
  if (!permissions.canManagePeople({ session: context.session as any }) || !permissions.canRunConflictChecks({ session: context.session as any })) {
    throw new Error('Starting an intake requires people-management and conflict-check permission.')
  }
  if (!['person', 'organization'].includes(args.contactType)) throw new Error('Contact type must be person or organization.')
  const firstName = text(args.firstName, 'First name', 120, args.contactType === 'person')
  const lastName = text(args.lastName, 'Last name', 120, args.contactType === 'person')
  const organizationName = text(args.organizationName, 'Organization name', 200, args.contactType === 'organization')
  const email = text(args.email, 'Email', 320, false)?.toLowerCase() ?? null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email must be valid.')
  const phone = text(args.phone, 'Phone', 80, false)
  const title = text(args.title, 'Intake title', 240) as string
  const summary = text(args.summary, 'Intake summary', 4000, false)
  const adversePartySummary = text(args.adversePartySummary, 'Adverse-party summary', 2000, false)
  const source = args.source?.trim() || 'other'
  const contactName = args.contactType === 'organization' ? organizationName : [firstName, lastName].filter(Boolean).join(' ')
  if (!contactName) throw new Error('A conflict-search name is required.')
  parseAdversePartyNames(adversePartySummary, [contactName])
  if (!['website', 'referral', 'phone', 'walk_in', 'import', 'other'].includes(source)) throw new Error('Unsupported intake source.')
  const prisma = context.prisma as any

  return runSerializableTransaction(prisma, async (tx: any) => {
    await assertCurrentCommandActor(tx, context, "canManageIntake");
    await assertCurrentCommandActor(tx, context, "canManagePeople");
    await assertCurrentCommandActor(tx, context, "canRunConflictChecks");
    if (args.officeId) {
      const office = await tx.office.findFirst({ where: { id: args.officeId, firmId, status: 'active' }, select: { id: true } })
      if (!office) throw new Error('The selected office is unavailable in this firm.')
    }
    if (args.practiceAreaId) {
      const area = await tx.practiceArea.findFirst({ where: { id: args.practiceAreaId, firmId, status: 'active' }, select: { id: true } })
      if (!area) throw new Error('The selected practice area is unavailable in this firm.')
    }
    if (args.assignedToId) {
      const membership = await tx.firmMembership.findFirst({
        where: { firmId, userId: args.assignedToId, status: 'active' },
        select: { id: true },
      })
      if (!membership) throw new Error('The selected assignee is not an active firm member.')
    }
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
    const contact = await tx.contact.create({
      data: {
        firmId,
        contactType: args.contactType,
        status: 'prospective_client',
        firstName: firstName ?? "",
        lastName: lastName ?? "",
        organizationName: organizationName ?? "",
        primaryEmail: email ?? "",
        primaryPhone: phone ?? "",
        conflictSearchAliases: [],
      },
      select: { id: true },
    })
    const intake = await tx.intake.create({
      data: {
        firmId,
        intakeNumber: `INT-${suffix}`,
        title,
        status: 'new',
        source,
        primaryContactId: contact.id,
        officeId: args.officeId || null,
        practiceAreaId: args.practiceAreaId || null,
        openedById: userId,
        assignedToId: args.assignedToId || userId,
        receivedAt: new Date(),
        summary: summary ?? "",
        adversePartySummary: adversePartySummary ?? "",
      },
      select: { id: true, intakeNumber: true, status: true },
    })
    await tx.intakeParticipant.create({
      data: { firmId, intakeId: intake.id, contactId: contact.id, participantRole: 'prospective_client', status: 'active' },
    })
    const adverseNames = parseAdversePartyNames(adversePartySummary, [contactName ?? ''])
    const adverseContacts = []
    for (const name of adverseNames) {
      const identity = adversePartyContact(name)
      const adverse = await tx.contact.create({
        data: { firmId, ...identity, status: 'opposing', primaryEmail: '', primaryPhone: '', conflictSearchAliases: [] },
        select: { id: true },
      })
      await tx.intakeParticipant.create({
        data: { firmId, intakeId: intake.id, contactId: adverse.id, participantRole: 'adverse_party', status: 'active' },
      })
      adverseContacts.push({ id: adverse.id, name, termType: identity.contactType })
    }
    const conflictCheck = await tx.conflictCheck.create({
      data: {
        firmId,
        checkNumber: `CHK-${suffix}`,
        status: 'requested',
        intakeId: intake.id,
        requestedById: userId,
        searchScope: 'contacts_and_matters',
        searchVersion: 'v1',
      },
      select: { id: true, checkNumber: true, status: true },
    })
    await tx.conflictSearchTerm.create({
      data: {
        firmId,
        checkId: conflictCheck.id,
        term: contactName,
        normalizedTerm: normalizeConflictTerm(contactName),
        termType: args.contactType === 'organization' ? 'organization' : 'person',
        sourceContactId: contact.id,
        includeAliases: true,
      },
    })
    for (const adverse of adverseContacts) {
      await tx.conflictSearchTerm.create({
        data: {
          firmId,
          checkId: conflictCheck.id,
          term: adverse.name,
          normalizedTerm: normalizeConflictTerm(adverse.name),
          termType: adverse.termType,
          sourceContactId: adverse.id,
          includeAliases: true,
        },
      })
    }
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: 'user',
      eventType: 'intake.started',
      category: 'legal_workflow',
      intakeId: intake.id,
      contactId: contact.id,
      metadata: { conflictCheckId: conflictCheck.id, source, adversePartyContactIds: adverseContacts.map((adverse) => adverse.id) },
    })
    return { intake, contact, conflictCheck }
  })
}
