'use server'

import { randomUUID } from 'node:crypto'

import type { Prisma, PrismaClient } from '@prisma/client'
import { redirect } from 'next/navigation'

import { keystoneContext } from '@/features/keystone/context'
import { sha256Digest } from '@/features/keystone/lib/digests'
import { runSerializableTransaction } from '@/features/keystone/lib/transactions'
import { practiceAreas, PUBLIC_INTAKE_ENABLED } from '@/features/storefront/content'
import { PublicIntakeValidationError, validateConsultationRequest } from '@/features/storefront/lib/consultation'

export type ConsultationRequestState = {
  error: string | null
  values: Record<string, string>
  revision: number
}

export async function createPublicConsultationRequest(input: Record<string, unknown>, prisma: PrismaClient) {
  if (!PUBLIC_INTAKE_ENABLED) throw new PublicIntakeValidationError('Public consultation intake is not currently configured.')
  const values = validateConsultationRequest(input)
  const publicReference = values.idempotencyKey
  return runSerializableTransaction(prisma, async (transaction) => {
    const tx = transaction as Prisma.TransactionClient
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`public-intake:${publicReference}`}))`
    const firms = await tx.firm.findMany({ where: { status: 'active' }, orderBy: { createdAt: 'asc' }, take: 2, select: { id: true, defaultTimezone: true } })
    if (firms.length !== 1) throw new Error('Public consultation intake requires exactly one active firm deployment.')
    const firm = firms[0]
    const eventId = `public-intake:${publicReference}`
    const replay = await tx.auditEvent.findFirst({ where: { firmId: firm.id, eventId }, select: { metadata: true } })
    const replayMetadata = replay?.metadata && typeof replay.metadata === 'object' && !Array.isArray(replay.metadata)
      ? replay.metadata as Record<string, unknown>
      : null
    if (replayMetadata?.publicReference === publicReference) return { publicReference, replayed: true }
    const receiver = await tx.firmMembership.findFirst({
      where: {
        firmId: firm.id,
        status: 'active',
        user: { status: 'active' },
        role: { status: 'active', canManageIntake: true, canRunConflictChecks: true },
      },
      orderBy: { createdAt: 'asc' },
      select: { userId: true, primaryOfficeId: true },
    })
    if (!receiver) throw new Error('No authorized intake receiver is configured.')

    const emailDigest = sha256Digest(values.email)
    const recentCount = await tx.auditEvent.count({
      where: {
        firmId: firm.id,
        eventType: 'intake.public_submitted',
        occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
        metadata: { path: ['emailDigest'], equals: emailDigest },
      },
    })
    if (recentCount >= 3) throw new PublicIntakeValidationError('This contact has reached the daily request limit. Contact the firm directly if the matter is urgent.')

    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
    const contact = await tx.contact.create({
      data: {
        firmId: firm.id,
        contactType: 'person',
        status: 'prospective_client',
        firstName: values.firstName,
        lastName: values.lastName,
        primaryEmail: values.email,
        primaryPhone: values.phone || '',
        conflictSearchAliases: [],
      },
      select: { id: true },
    })
    const selectedPractice = practiceAreas.find((item) => item.slug === values.practiceArea)!
    const intake = await tx.intake.create({
      data: {
        firmId: firm.id,
        intakeNumber: `INT-${suffix}`,
        title: `${selectedPractice.name} consultation request`,
        status: 'new',
        source: 'website',
        primaryContactId: contact.id,
        officeId: receiver.primaryOfficeId || null,
        openedById: receiver.userId,
        assignedToId: receiver.userId,
        receivedAt: new Date(),
        summary: values.summary,
        adversePartySummary: values.opposingParties,
      },
      select: { id: true },
    })
    await tx.intakeParticipant.create({ data: { firmId: firm.id, intakeId: intake.id, contactId: contact.id, participantRole: 'prospective_client', status: 'active' } })
    await tx.intakeSubmission.create({
      data: {
        firmId: firm.id,
        intakeId: intake.id,
        submittedByContactId: contact.id,
        status: 'submitted',
        schemaVersion: 'public-consultation-v1',
        formSchema: { fields: ['identity', 'contact', 'practiceArea', 'jurisdiction', 'opposingParties', 'deadline', 'summary'] },
        responses: {
          publicReference,
          practiceArea: values.practiceArea,
          jurisdiction: values.jurisdiction,
          opposingParties: values.opposingParties,
          keyDeadline: values.keyDeadline || null,
          summary: values.summary,
          referralSource: values.referralSource || null,
          acknowledgment: true,
        },
        submittedAt: new Date(),
      },
    })
    const conflictCheck = await tx.conflictCheck.create({
      data: {
        firmId: firm.id,
        checkNumber: `CHK-${suffix}`,
        status: 'requested',
        intakeId: intake.id,
        requestedById: receiver.userId,
        searchScope: 'contacts_and_matters',
        searchVersion: 'v1',
      },
      select: { id: true },
    })
    const fullName = `${values.firstName} ${values.lastName}`
    await tx.conflictSearchTerm.create({
      data: { firmId: firm.id, checkId: conflictCheck.id, term: fullName, normalizedTerm: fullName.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(), termType: 'person', sourceContactId: contact.id, includeAliases: true },
    })
    if (!/^none(?: known)?$/i.test(values.opposingParties)) {
      await tx.conflictSearchTerm.create({
        data: { firmId: firm.id, checkId: conflictCheck.id, term: values.opposingParties, normalizedTerm: values.opposingParties.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(), termType: 'other', includeAliases: false },
      })
    }
    await tx.consultation.create({
      data: {
        firmId: firm.id,
        intakeId: intake.id,
        status: 'requested',
        timezone: firm.defaultTimezone,
        officeId: receiver.primaryOfficeId || null,
        hostId: receiver.userId,
        participants: { connect: { id: contact.id } },
        outcome: 'pending',
      },
    })
    await tx.auditEvent.create({
      data: {
        firmId: firm.id,
        eventId,
        eventType: 'intake.public_submitted',
        category: 'legal_workflow',
        outcome: 'succeeded',
        actorType: 'public_prospect',
        contactId: contact.id,
        intakeId: intake.id,
        occurredAt: new Date(),
        metadata: { publicReference, emailDigest, practiceArea: values.practiceArea, schemaVersion: 'public-consultation-v1' },
      },
    })
    return { publicReference, replayed: false }
  })
}

export async function requestConsultation(previous: ConsultationRequestState, formData: FormData): Promise<ConsultationRequestState> {
  const values = Object.fromEntries(formData.entries()) as Record<string, string>
  if (!PUBLIC_INTAKE_ENABLED) {
    return { error: 'Public consultation intake is not currently configured.', values: {}, revision: previous.revision + 1 }
  }
  if (values.website) redirect(`/consultation/received?reference=${encodeURIComponent(values.idempotencyKey || randomUUID())}`)
  let result: { publicReference: string }
  try {
    result = await createPublicConsultationRequest(values, keystoneContext.prisma)
  } catch (error) {
    if (!(error instanceof PublicIntakeValidationError)) console.error('Public consultation request failed.')
    return {
      error: error instanceof PublicIntakeValidationError ? error.message : 'The request could not be submitted. Try again or contact the firm directly.',
      values: { ...values, opposingParties: values.opposingParties || '' },
      revision: previous.revision + 1,
    }
  }
  redirect(`/consultation/received?reference=${encodeURIComponent(result.publicReference)}`)
}
