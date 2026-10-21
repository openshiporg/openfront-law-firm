import { assertCurrentCommandActor } from "./command-authority";
import { randomUUID } from 'node:crypto'

import type { Context } from '.keystone/types'

import { permissions } from '../access'
import { runSerializableTransaction } from '../lib/transactions'
import { recordAuditEvent, requirePermission } from './workflow-helpers'

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
    const contactName = args.contactType === 'organization' ? organizationName : [firstName, lastName].filter(Boolean).join(' ')
    if (!contactName) throw new Error('A conflict-search name is required.')
    await tx.conflictSearchTerm.create({
      data: {
        firmId,
        checkId: conflictCheck.id,
        term: contactName,
        normalizedTerm: contactName.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(),
        termType: args.contactType === 'organization' ? 'organization' : 'person',
        sourceContactId: contact.id,
        includeAliases: true,
      },
    })
    await recordAuditEvent(tx, {
      firmId,
      actorUserId: userId,
      actorType: 'user',
      eventType: 'intake.started',
      category: 'legal_workflow',
      intakeId: intake.id,
      contactId: contact.id,
      metadata: { conflictCheckId: conflictCheck.id, source },
    })
    return { intake, contact, conflictCheck }
  })
}
