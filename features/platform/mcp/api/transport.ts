import { authenticatedUserId, requestHasTrustedOrigin } from '@/features/keystone/lib/authenticated-request'

/**
 * Generic schema-discovery and CRUD MCP tools are disabled for legal data.
 * Future connectors must register bounded, read-only evidence tools or route
 * proposed writes through AgentAction approval and audit evidence.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ transport: string }> },
) {
  const { transport } = await params
  if (transport !== 'http') return new Response('Not found', { status: 404 })
  if (!requestHasTrustedOrigin(request)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!await authenticatedUserId(request, fetch, { requireDashboard: true })) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  return Response.json(
    { error: 'Generic legal-data MCP tools are disabled.', code: 'LEGAL_MCP_DISABLED' },
    { status: 501, headers: { 'cache-control': 'no-store' } },
  )
}
