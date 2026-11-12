import { notFound } from 'next/navigation'
import { firmMetadata } from '../lib/metadata'
export async function generateMetadata() { return firmMetadata('Submission status') }
// No submission status can be looked up by reference here (public intake is off and
// booked consultations live under /account/appointments), so this is a missing record: 404.
export default function ConsultationReceivedPage(): never {
  notFound()
}
