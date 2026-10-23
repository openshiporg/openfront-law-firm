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

function adversePartyContact(name: string) {
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

/** Runs inside finalizeConflictCheck's transaction once a check is cleared. When the
 * intake has a cleared check and no blocking check left, and the reviewer may manage
 * intake, the intake walks its lifecycle to the decision stage. Conversion stays an
 * explicit, reasoned command. A conflict_found result never reaches this. */
export async function advanceIntakeAfterConflictClearance(
  tx: any,
  context: Context,
  input: { firmId: string; userId: string; intakeId: string; checkId: string },
) {
  const session = context.session as any
  if (!isInteractiveHumanSession(session) || !permissions.canManageIntake({ session })) return null
  try {
    await assertCurrentCommandActor(tx, context, 'canManageIntake')
  } catch {
    return null
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`intake:${input.firmId}:${input.intakeId}`}))`
  const intake = await tx.intake.findFirst({ where: { id: input.intakeId, firmId: input.firmId }, select: { id: true, status: true } })
  const path = intake ? intakeClearancePath[intake.status] : undefined
  if (!intake || !path) return null
  const [cleared, blocking] = await Promise.all([
    tx.conflictCheck.count({ where: { firmId: input.firmId, intakeId: intake.id, status: 'cleared' } }),
    tx.conflictCheck.count({ where: { firmId: input.firmId, intakeId: intake.id, status: { in: [...blockingConflictCheckStatuses] } } }),
  ])
  if (!cleared || blocking) return null
  let fromStatus = intake.status as string
  for (const toStatus of path) {
    assertLifecycleTransition('intake', fromStatus, toStatus)
    await recordAuditEvent(tx, {
      firmId: input.firmId,
      eventType: `intake.${toStatus}`,
      category: 'legal_workflow',
      actorUserId: input.userId,
      intakeId: intake.id,
      metadata: { fromStatus, toStatus, cause: 'conflict_check_cleared', conflictCheckId: input.checkId, reasonDigest: sha256Digest('Conflict check cleared.') },
    })
    fromStatus = toStatus
  }
  await tx.intake.update({ where: { id: intake.id }, data: { status: 'decision' } })
  return { intakeId: intake.id, fromStatus: intake.status as string, toStatus: 'decision' }
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
