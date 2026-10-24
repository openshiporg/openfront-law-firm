import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { ErrorBanner, StatusText } from '@/features/platform/components/ui'

import { FirmDefaultsForm, OfficeManager } from '../components/FirmForms'
import { getFirmSetup } from '../lib/firmQueries'

function supportedTimeZones() {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return []
  }
}

export async function FirmPage() {
  const setup = await getFirmSetup()
  return (
    <PracticePage
      title="Firm & offices"
      description="Firm defaults and offices"
      status={setup.status === 'loaded' ? <StatusText status={setup.firm.status} /> : undefined}
      meta={setup.status === 'loaded' ? setup.firm.name : undefined}
    >
      {setup.status !== 'loaded' ? <ErrorBanner title="Firm unavailable">{setup.message}</ErrorBanner> : (
        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <FirmDefaultsForm firm={setup.firm} timeZones={supportedTimeZones()} />
          <OfficeManager offices={setup.offices} total={setup.officesTotal} defaultTimeZone={setup.firm.defaultTimezone} />
        </div>
      )}
    </PracticePage>
  )
}
