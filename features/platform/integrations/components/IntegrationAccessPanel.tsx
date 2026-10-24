import { getIntegrationAccessSetup } from '../actions/integrationAccess'
import { CONNECTION_CATEGORIES, availableApiKeyScopes } from '../lib/machineScopes'
import { ApiKeysClient } from './ApiKeysClient'
import { ConnectionsClient } from './ConnectionsClient'

export async function IntegrationAccessPanel() {
  const setup = await getIntegrationAccessSetup()
  return (
    <div className="grid min-w-0 gap-6">
      <ConnectionsClient connections={setup.connections.status === 'loaded' ? setup.connections.rows : null} categories={CONNECTION_CATEGORIES} />
      <ApiKeysClient keys={setup.apiKeys.status === 'loaded' ? setup.apiKeys.rows : null} scopes={availableApiKeyScopes()} />
    </div>
  )
}
