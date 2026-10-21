// Adapted from Barbershop localFixtureAuthority: local fixtures are never legal
// authority. All ordinary tenant, owner, lifecycle and locking checks still run.
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'

export type FixtureClient = { $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T> }
function ownership() {
  try {
    const file = resolve(process.env.LAW_FIRM_FIXTURE_OWNERSHIP_PATH || '')
    const runtime = realpathSync(join(process.cwd(), '.runtime')) + sep
    const stat = lstatSync(file)
    if (!file.startsWith(runtime) || realpathSync(file) !== file || !stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o600 || stat.size > 65536) return null
    const v = JSON.parse(readFileSync(file, 'utf8'))
    if (v.version !== 1 || v.root !== dirname(file) || v.datadir !== join(v.root, 'pgdata') || !/^[a-z_][a-z0-9_]{0,62}$/.test(v.role) || !Array.isArray(v.databases) || !v.databases.length || v.databases.length > 64 || !v.databases.every((n: unknown) => typeof n === 'string' && /^runtime_law_firm_ephemeral_[a-z0-9_]+$/.test(n))) return null
    const data = lstatSync(v.datadir)
    if (!data.isDirectory() || data.isSymbolicLink() || data.uid !== stat.uid || realpathSync(v.datadir) !== v.datadir) return null
    if (Object.entries(process.env).some(([k, value]) => /^(SMTP|S3_|AWS_|STRIPE|PAYPAL|OPENAI|OPENROUTER|ANTHROPIC|TWILIO|RESEND|SENDGRID)/.test(k) && Boolean(value))) return null
    const url = new URL(process.env.DATABASE_URL || '')
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !v.databases.includes(url.pathname.slice(1)) || url.username !== v.role || Number(url.port) !== v.port) return null
    return v as { datadir: string; role: string; port: number; databases: string[] }
  } catch { return null }
}
export async function requireOwnedOfflineDatabase(client: FixtureClient) {
  const own = ownership()
  if (!own) throw new Error('An owned offline database is required.')
  const [row] = await client.$queryRawUnsafe<Array<{ allowed: boolean }>>(`SELECT (
    current_database() = ANY($1::text[]) AND current_user = $2 AND session_user = $2
    AND (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) = current_user
    AND CASE WHEN (SELECT rolsuper OR pg_has_role(current_user, 'pg_read_all_settings', 'USAGE') FROM pg_roles WHERE rolname=current_user)
      THEN current_setting('data_directory', true) = $3 ELSE false END
    AND inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet) AND inet_server_port() = $4
  ) AS allowed`, own.databases, own.role, own.datadir, own.port)
  if (row?.allowed !== true) throw new Error('Owned offline server, database owner or data directory mismatch.')
}
export async function isLocalFixtureFirm(client: FixtureClient, firmId: string) {
  const own = ownership()
  if (!own) return false
  const [row] = await client.$queryRawUnsafe<Array<{ allowed: boolean }>>(`SELECT (
    f."isDemo" = true AND f.status = 'active'
    AND current_database() = ANY($2::text[])
    AND current_user = $3 AND session_user = $3
    AND (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()) = current_user
    AND CASE WHEN (SELECT rolsuper OR pg_has_role(current_user, 'pg_read_all_settings', 'USAGE') FROM pg_roles WHERE rolname = current_user)
      THEN current_setting('data_directory', true) = $4 ELSE false END
    AND inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet) AND inet_server_port() = $5
    AND NOT EXISTS (SELECT 1 FROM "IntegrationConnection" c WHERE c."firm" = f.id AND c.status = 'active')
  ) AS allowed FROM "Firm" f WHERE f.id = $1`, firmId, own.databases, own.role, own.datadir, own.port)
  return row?.allowed === true
}
export async function requireLocalFixtureFirm(client: FixtureClient, firmId: string) {
  if (!await isLocalFixtureFirm(client, firmId)) throw new Error('Fictional consultation service is unavailable outside the owned offline workspace.')
}
