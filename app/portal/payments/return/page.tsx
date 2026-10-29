import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PORTAL_SESSION_COOKIE } from '@/features/portal/constants'
import { reconcilePortalPayment } from '@/features/keystone/mutations/portalPayments'
import { keystoneContext } from '@/features/keystone/context'

export const dynamic = 'force-dynamic'

export default async function PortalPaymentReturnPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const token = (await cookies()).get(PORTAL_SESSION_COOKIE)?.value
  if (!token) redirect('/portal/signin')
  const { payment } = await searchParams
  let status = 'pending'
  if (payment) {
    try { status = (await reconcilePortalPayment(null, { paymentId: payment, token }, keystoneContext)).status }
    catch { status = 'pending' }
  }
  return <main className="storefront min-h-svh p-8"><section className="mx-auto grid max-w-xl gap-5"><h1 className="sf-title">Payment status</h1><p role="status">{status === 'captured' || status === 'settled' ? 'Payment received.' : 'Payment is not yet confirmed. You can check again shortly.'}</p>{payment ? <Link className="sf-pill sf-pill--raised w-fit" href={`/portal/payments/return?payment=${encodeURIComponent(payment)}`}>Check status</Link> : null}<Link className="sf-link" href="/portal">Return to portal</Link></section></main>
}
