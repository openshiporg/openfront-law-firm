import { isEmailDeliveryConfigured } from '@/features/keystone/lib/mail'

/** Server-only boolean for platform screens; never returns SMTP values. */
export function getEmailDeliveryConfigured(): boolean {
  return isEmailDeliveryConfigured()
}
