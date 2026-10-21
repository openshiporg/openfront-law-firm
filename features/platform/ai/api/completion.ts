import { authenticatedUserId, requestHasTrustedOrigin } from '@/features/keystone/lib/authenticated-request'

/**
 * The legacy generic completion endpoint is intentionally fail-closed.
 *
 * Legal AI work is exposed through the evidence-first `/dashboard/platform/ai`
 * workspace. Model execution will be enabled only after a provider adapter can
 * bind every request to an authorized matter/document set, citations, an
 * immutable run record, and the controlled AgentAction approval boundary.
 */
export async function POST(request: Request) {
  if (!requestHasTrustedOrigin(request)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!await authenticatedUserId(request, fetch, { requireDashboard: true })) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  return Response.json(
    {
      error: 'Legal AI model execution is not configured.',
      code: 'LEGAL_AI_EXECUTION_UNAVAILABLE',
      next: '/dashboard/platform/ai',
    },
    { status: 501, headers: { 'cache-control': 'no-store' } },
  )
}
