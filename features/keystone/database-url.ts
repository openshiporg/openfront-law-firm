/**
 * Postgres URL with a bounded Prisma pool.
 *
 * Prisma's default pool is cpus*2+1. On a 48-core Railway host that is 97 connections for a single client, and
 * Postgres's default max_connections is 100, so one web container can fill the server with idle connections; then
 * Keystone's access-control and count queries fail with "too many clients". Every Prisma client in a process
 * therefore gets an explicit share: the Keystone web client 15, each extra client (an in-process worker or a
 * webhook/session helper) 5.
 *
 * DATABASE_CONNECTION_LIMIT overrides the web pool and DATABASE_CONNECTION_LIMIT_WORKER every extra pool.
 * A connection_limit already present in the URL always wins.
 */
export const POOL_SIZES = { web: 15, worker: 5 } as const

export type PoolRole = keyof typeof POOL_SIZES

const OVERRIDE_ENV: Record<PoolRole, string> = {
  web: 'DATABASE_CONNECTION_LIMIT',
  worker: 'DATABASE_CONNECTION_LIMIT_WORKER',
}

export function pooledDatabaseUrl(url: string, role?: PoolRole): string
export function pooledDatabaseUrl(url: string | undefined, role?: PoolRole): string | undefined
export function pooledDatabaseUrl(url: string | undefined, role: PoolRole = 'web'): string | undefined {
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return url
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  // Keystone's nested matter/ethical-wall filters generate large prepared query trees.
  // Prisma defaults to retaining 100 statements per connection (on BOTH client and DB).
  // A five-role crawl retained >12 GB in 15 idle PostgreSQL backends on a 22 MB DB.
  // Do not retain these one-off dashboard shapes; preserve an explicit operator choice.
  if (!parsed.searchParams.has('statement_cache_size')) parsed.searchParams.set('statement_cache_size', '0')
  const override = Number(process.env[OVERRIDE_ENV[role]])
  if (!parsed.searchParams.has('connection_limit')) parsed.searchParams.set('connection_limit', String(Number.isInteger(override) && override > 0 ? override : POOL_SIZES[role]))
  return parsed.toString()
}

/** Options for an extra `new PrismaClient(...)` outside Keystone's own context. */
export function pooledPrismaOptions(role: PoolRole = 'worker'): { datasourceUrl?: string } {
  const datasourceUrl = pooledDatabaseUrl(process.env.DATABASE_URL, role)
  return datasourceUrl ? { datasourceUrl } : {}
}
