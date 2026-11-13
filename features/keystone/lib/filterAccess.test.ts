// Count-filter attack through relations and read-gated scalars, run against a scratch database:
//   RUN_FILTER_ACCESS_TEST=1 DATABASE_URL=... tsx --test features/keystone/lib/filterAccess.test.ts
// Signed out and every limited role must get the same count for a value that exists and one that
// does not (or an access error). Admin keeps real filters.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { getContext } from '@keystone-6/core/context'
import * as PrismaModule from '@prisma/client'

import config from '../index'
import { permissionKeys, type PermissionKey, type Session } from '../access'

const enabled = process.env.RUN_FILTER_ACCESS_TEST === '1'
const suffix = randomUUID().replaceAll('-', '').slice(0, 10)

type Probe = { name: string; list: string; where: (value: string) => string; exists: string }

async function run() {
  const context = getContext(config, PrismaModule)
  const prisma = context.prisma as any
  try {
    const firm = await prisma.firm.create({ data: { name: `Filter ${suffix}`, slug: `filter-${suffix}`, status: 'active' } })
    const roleFor = (name: string, granted: PermissionKey[]) =>
      prisma.role.create({ data: { firmId: firm.id, name: `${name} ${suffix}`, status: 'active', ...Object.fromEntries(granted.map((key) => [key, true])) } })

    const adminRole = await roleFor('Admin', [...permissionKeys])
    const roles: Record<string, any> = {
      admin: adminRole,
      scoped: await roleFor('Scoped', ['canAccessDashboard', 'canReadMatters']),
      billing: await roleFor('Billing', ['canAccessDashboard', 'canReadBilling', 'canManageBilling']),
      tasks: await roleFor('Tasks', ['canAccessDashboard', 'canReadTasks']),
    }
    const sessions: Record<string, Session | undefined> = { anonymous: undefined }
    for (const [key, role] of Object.entries(roles)) {
      const user = await prisma.user.create({
        data: { name: `Zed ${key} ${suffix}`, email: `${key}-${suffix}@example.invalid`, password: 'not-used-in-this-test', status: 'active', activeFirmId: firm.id, bootstrapRoleId: adminRole.id },
      })
      const membership = await prisma.firmMembership.create({ data: { firmId: firm.id, userId: user.id, roleId: role.id, status: 'active' } })
      const sessionRole: any = { id: role.id, name: role.name, status: 'active', firm: { id: firm.id } }
      for (const permission of permissionKeys) sessionRole[permission] = Boolean(role[permission])
      sessions[key] = {
        itemId: user.id,
        listKey: 'User',
        data: {
          name: user.name,
          status: 'active',
          activeFirm: { id: firm.id, name: firm.name, status: 'active' },
          role: sessionRole,
          firmMemberships: [{ id: membership.id, status: 'active', firm: { id: firm.id }, role: sessionRole }],
        },
      }
    }

    const attorney = await prisma.user.findFirst({ where: { email: `admin-${suffix}@example.invalid` } })
    const contact = await prisma.contact.create({
      data: { firmId: firm.id, contactType: 'person', status: 'client', firstName: 'Quincy', lastName: 'Vandermeer', primaryEmail: `quincy-${suffix}@example.invalid`, primaryPhone: '555-0142' },
    })
    await prisma.matter.create({
      data: { firmId: firm.id, matterNumber: `M-${suffix}`, title: 'Harbor boundary dispute', status: 'open', clientId: contact.id, responsibleAttorneyId: attorney.id },
    })
    await prisma.intake.create({ data: { firmId: firm.id, primaryContactId: contact.id } }).catch(() => null)

    const probes: Probe[] = [
      { name: 'users by name', list: 'users', where: (v) => `{ name: { startsWith: "${v}" } }`, exists: 'Zed' },
      { name: 'users by activeFirm', list: 'users', where: (v) => `{ activeFirm: { name: { startsWith: "${v}" } } }`, exists: 'Filter' },
      { name: 'contacts by email', list: 'contacts', where: (v) => `{ primaryEmail: { startsWith: "${v}" } }`, exists: 'quincy' },
      { name: 'matters by client email', list: 'matters', where: (v) => `{ client: { primaryEmail: { startsWith: "${v}" } } }`, exists: 'quincy' },
      { name: 'matters by client name', list: 'matters', where: (v) => `{ client: { lastName: { startsWith: "${v}" } } }`, exists: 'Vander' },
      { name: 'matters by attorney name', list: 'matters', where: (v) => `{ responsibleAttorney: { name: { startsWith: "${v}" } } }`, exists: 'Zed' },
      { name: 'firm memberships by user', list: 'firmMemberships', where: (v) => `{ user: { name: { startsWith: "${v}" } } }`, exists: 'Zed' },
      { name: 'firm memberships by role', list: 'firmMemberships', where: (v) => `{ role: { name: { startsWith: "${v}" } } }`, exists: 'Admin' },
      { name: 'roles by assignee', list: 'roles', where: (v) => `{ assignedTo: { some: { name: { startsWith: "${v}" } } } }`, exists: 'Zed' },
      { name: 'intakes by contact email', list: 'intakes', where: (v) => `{ primaryContact: { primaryEmail: { startsWith: "${v}" } } }`, exists: 'quincy' },
      { name: 'documents by matter client', list: 'documents', where: (v) => `{ matter: { client: { primaryEmail: { startsWith: "${v}" } } } }`, exists: 'quincy' },
      { name: 'invoices by matter client', list: 'invoices', where: (v) => `{ matter: { client: { primaryEmail: { startsWith: "${v}" } } } }`, exists: 'quincy' },
      { name: 'time entries by user', list: 'timeEntries', where: (v) => `{ user: { name: { startsWith: "${v}" } } }`, exists: 'Zed' },
      { name: 'tasks by assignee', list: 'legalTasks', where: (v) => `{ assignedTo: { name: { startsWith: "${v}" } } }`, exists: 'Zed' },
      { name: 'tasks by matter title', list: 'legalTasks', where: (v) => `{ matter: { title: { startsWith: "${v}" } } }`, exists: 'Harbor' },
      { name: 'payments by matter client', list: 'payments', where: (v) => `{ matter: { client: { primaryEmail: { startsWith: "${v}" } } } }`, exists: 'quincy' },
      { name: 'payment providers by credentials', list: 'paymentProviders', where: (v) => `{ code: { startsWith: "${v}" } }`, exists: 'pp_' },
      { name: 'api keys by owner', list: 'apiKeys', where: (v) => `{ owner: { name: { startsWith: "${v}" } } }`, exists: 'Zed' },
      { name: 'agent actions by approver', list: 'agentActions', where: (v) => `{ approvedBy: { name: { startsWith: "${v}" } } }`, exists: 'Zed' },
      { name: 'audit events by actor', list: 'auditEvents', where: (v) => `{ actorUser: { name: { startsWith: "${v}" } } }`, exists: 'Zed' },
    ]

    const count = async (who: string, probe: Probe, value: string) => {
      const ctx = sessions[who] ? context.withSession(sessions[who]) : context
      const result = await ctx.graphql.raw({ query: `{ n: ${probe.list}Count(where: ${probe.where(value)}) }` })
      if (result.errors?.length) return `error:${String(result.errors[0].message).split('\n')[0].slice(0, 80)}`
      return String((result.data as any)?.n)
    }

    const findings: string[] = []
    for (const who of ['anonymous', 'scoped', 'billing', 'tasks']) {
      for (const probe of probes) {
        const hit = await count(who, probe, probe.exists)
        const miss = await count(who, probe, 'Qzxv-never')
        console.log(`${who.padEnd(10)} ${probe.name.padEnd(34)} exists=${hit}  absent=${miss}`)
        if (hit !== miss && !(hit.startsWith('error') && miss.startsWith('error'))) findings.push(`${who}: ${probe.name} exists=${hit} absent=${miss}`)
      }
    }
    assert.deepEqual(findings, [], `filter probes leaked:\n${findings.join('\n')}`)

    // Admin keeps its real filters.
    const adminHit = await count('admin', probes[0], 'Zed')
    const adminMiss = await count('admin', probes[0], 'Qzxv-never')
    console.log(`admin      users by name                      exists=${adminHit}  absent=${adminMiss}`)
    assert.ok(Number(adminHit) > 0 && adminMiss === '0', 'admin filters still work')
    assert.equal(await count('admin', probes.find((p) => p.name === 'matters by client email')!, 'quincy'), '1')
    assert.equal(await count('admin', probes.find((p) => p.name === 'matters by attorney name')!, 'Zed'), '1')
  } finally {
    await context.prisma.$disconnect()
  }
}

test('relation and scalar where-filters do not reveal hidden values', { skip: !enabled }, run)
