import { Notice, TitleLine } from '@/features/platform/components/ui'

/** Presentational only: the caller passes the server-side boolean from
 * isEmailDeliveryConfigured(); no SMTP value ever reaches this component. */
export function EmailDeliveryStatus({ configured, context = 'integrations' }: { configured: boolean; context?: 'integrations' | 'portal' }) {
  return (
    <div className="min-w-0 space-y-2">
      <TitleLine as="p" tone={configured ? 'emerald' : 'amber'} headingClassName="text-sm">
        Email delivery: {configured ? 'configured' : 'not configured'}
      </TitleLine>
      {!configured ? (
        <Notice>
          {context === 'portal'
            ? 'Invitations and sign-in links can’t be emailed. Copy each invitation link and send it to the client yourself; a client who needs to sign in again needs a new invitation from the firm.'
            : 'Staff setup links, client invitations and client sign-in links can’t be emailed until SMTP is set up on the server.'}
        </Notice>
      ) : null}
    </div>
  )
}
