/**
 * Server start-up. Starts the one-minute consultation payment sweep (paid-but-unreturned
 * checkouts, lapsed holds) in the Node server, once per process.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const { startConsultationSweep } = await import('./features/keystone/lib/consultation-sweep')
  startConsultationSweep()
}
