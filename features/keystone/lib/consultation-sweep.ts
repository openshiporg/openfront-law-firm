import { keystoneContext } from '../context'
import { prismaWithoutGraphQLErrorConversion } from './transactions'
import { sweepConsultationPayments } from '../mutations/consultationPayments'

const EVERY_MS = 60_000

/** One timer per process; a sweep never overlaps the previous one. */
export function startConsultationSweep() {
  const state = globalThis as any
  if (state.__consultationSweep) return
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      await sweepConsultationPayments(prismaWithoutGraphQLErrorConversion(keystoneContext.prisma))
    } catch (error) {
      console.error('Consultation payment sweep failed', error)
    } finally {
      running = false
    }
  }
  state.__consultationSweep = setInterval(run, EVERY_MS)
  state.__consultationSweep.unref?.()
  setTimeout(run, 10_000).unref?.()
  console.log('Consultation payment sweep started (every 60 s)')
}
