import { activeFirmId, permissions, type PermissionKey, type Session } from '../access'
import { computeAgentApprovalDigest, highRiskAgentActions } from '../lib/agent-controls'
import { effectiveOAuthScopes, loadActiveHumanSession, normalizeAgentCapabilities, normalizeMachineScopes } from '../lib/machine-auth'

export type AuthorityContext = {
  session?: Session | null
  withSession(session: Session): AuthorityContext
}

/** Shared current member lock, also used when delegating a key to another owner.
 * Role.id alone is not a tenant binding: legacy mismatched tuples fail closed. */
export async function lockCurrentFirmMember(tx: any, userId: string, firmId: string) {
  await tx.$executeRaw`SELECT u.id FROM "User" u
    JOIN "FirmMembership" m ON m."user" = u.id AND m.firm = ${firmId}
    JOIN "Role" r ON r.id = m.role AND r.firm = m.firm
    JOIN "Firm" f ON f.id = m.firm
    WHERE u.id = ${userId} AND u."activeFirm" = f.id
    ORDER BY r.id, m.id FOR SHARE OF u, m, r, f`
  return loadActiveHumanSession(tx, userId, firmId)
}

/** Authority participates in the SAME serializable transaction as the effect.
 * Shared PG row locks order the command before any concurrent user, membership,
 * role, firm or credential revocation instead of trusting request-start claims.
 */
export async function assertCurrentCommandActor(tx: any, context: AuthorityContext, permission: PermissionKey) {
  const session = context.session as Session | undefined
  const firmId = activeFirmId(session)
  if (!session?.itemId || !firmId) throw new Error('Current command authority is required.')
  const current = await lockCurrentFirmMember(tx, session.itemId, firmId)
  if (!current || current.data.activeFirm?.status !== 'active') throw new Error('Current command authority is required.')
  const type = session.authenticationType || 'human'
  if (type === 'human') {
    if (!permissions[permission]({ session: current })) throw new Error('Current command authority is required.')
    const execution = (session as any).agentExecution
    if (session.agentPrincipalId) {
      if (!execution?.actionId || !execution?.credentialSession || typeof execution.claimStartedAt !== 'string' || !Number.isFinite(Date.parse(execution.claimStartedAt))) throw new Error('Agent execution claim binding is required.')
      await tx.$executeRaw`SELECT a.id FROM "AgentAction" a JOIN "AgentGrant" g ON g.id = a.grant JOIN "AgentPrincipal" p ON p.id = a."agentPrincipal" WHERE a.id = ${execution.actionId} FOR SHARE OF a,g,p`
      const action = await tx.agentAction.findFirst({ where: { id: execution.actionId, firmId, agentPrincipalId: session.agentPrincipalId, status: 'executing', startedAt: new Date(execution.claimStartedAt), grant: { status: 'active' }, agentPrincipal: { status: 'active' } }, include: { grant: true } })
      if (!action || action.approvedById && action.approvedById !== session.itemId || action.grant.startsAt && action.grant.startsAt > new Date() || action.grant.expiresAt && action.grant.expiresAt <= new Date() || !Array.isArray(action.grant.capabilities) || !action.grant.capabilities.includes(action.actionType)) throw new Error('Current agent execution authority is required.')
      // The claim checked the approval earlier, in another transaction. Re-check the
      // exact approval here, where the effect commits: still unexpired, digest intact,
      // and the approver still holds approval authority (domain authority is above).
      if (highRiskAgentActions.has(action.actionType)) {
        const expiresAt = action.approvalExpiresAt
        if (
          !action.approvedById ||
          !expiresAt ||
          expiresAt <= new Date() ||
          action.approvalDigest !== computeAgentApprovalDigest({
            actionId: action.id,
            actionType: action.actionType,
            matterId: action.matterId,
            requestDigest: action.requestDigest,
            approvalExpiresAt: expiresAt,
          }) ||
          !permissions.canApproveAgentActions({ session: current })
        ) throw new Error('Current agent approval authority is required.')
      }
      await assertCurrentAgentCredential(tx, context.withSession(execution.credentialSession), action.actionType)
    }
    return
  }
  const now = new Date()
  if (type === 'api_key') {
    await tx.$executeRaw`SELECT id FROM "ApiKey" WHERE id = ${session.credentialId || ''} FOR SHARE`
    const key = await tx.apiKey.findFirst({ where: { id: session.credentialId, firmId, ownerId: session.itemId, status: 'active' } })
    if (!key || key.expiresAt && key.expiresAt <= now) throw new Error('Current credential authority is required.')
    const scoped = { ...current, authenticationType: type, machineScopes: normalizeMachineScopes(key.scopes) } as Session
    if (!permissions[permission]({ session: scoped })) throw new Error('Current credential authority is required.')
    return
  }
  if (type === 'oauth') {
    await tx.$executeRaw`SELECT t.id FROM "OAuthToken" t JOIN "OAuthClient" c ON c.id = t.client JOIN "OAuthConsent" s ON s.id = t.consent WHERE t.id = ${session.credentialId || ''} FOR SHARE OF t,c,s`
    const token = await tx.oAuthToken.findFirst({ where: { id: session.credentialId, firmId, userId: session.itemId, status: 'active', tokenType: 'access_token', expiresAt: { gt: now }, client: { status: 'active', firmId }, consent: { status: 'active' } }, include: { client: true, consent: true } })
    if (!token) throw new Error('Current credential authority is required.')
    const scopes = effectiveOAuthScopes(current, { clientAllowedScopes: token.client.allowedScopes, consentScopes: token.consent.scopes, tokenScopes: token.scopes })
    if (!permissions[permission]({ session: { ...current, authenticationType: type, machineScopes: scopes } })) throw new Error('Current credential authority is required.')
    return
  }
  throw new Error('Direct command authority is unavailable for this credential type.')
}

export async function assertCurrentAgentCredential(tx: any, context: AuthorityContext, capability: string) {
  const session = context.session as Session | undefined
  const firmId = activeFirmId(session)
  if (!session?.itemId || !firmId || session.authenticationType !== 'agent' || !session.credentialId || !session.agentPrincipalId) throw new Error('Current agent credential is required.')
  await tx.$executeRaw`SELECT c.id FROM "AgentCredential" c JOIN "AgentPrincipal" p ON p.id = c."agentPrincipal" WHERE c.id = ${session.credentialId} FOR SHARE OF c,p`
  const current = await lockCurrentFirmMember(tx, session.itemId, firmId)
  const credential = await tx.agentCredential.findFirst({ where: { id: session.credentialId, firmId, status: 'active', agentPrincipalId: session.agentPrincipalId, agentPrincipal: { status: 'active', firmId, ownerId: session.itemId } } })
  if (!current || current.data.activeFirm?.status !== 'active' || !credential || credential.expiresAt && credential.expiresAt <= new Date() || !normalizeAgentCapabilities(credential.scopes).includes(capability)) throw new Error('Current agent credential is required.')
}
