import { PracticePage } from '@/features/platform/components/PracticeSurface'
import { StatusText } from '@/features/platform/components/ui'
import { getPublicSiteSetup } from '../actions/publicSite'
import { getAttorneyProfileSetup } from '../actions/attorneyProfiles'
import { AttorneyProfileManager } from './AttorneyProfileManager'
import { PracticeAreaManager, PublicSiteError, PublicSitePolicyForm } from './PublicSiteClient'

export async function PublicSitePage() {
  const [setup, attorneys] = await Promise.all([getPublicSiteSetup(), getAttorneyProfileSetup()])
  const status = setup.status === 'loaded' ? (setup.policy?.status === 'published' ? 'published' : 'draft') : undefined
  return (
    <PracticePage title="Public site" description="Publication, notices, practice areas and attorney profiles" status={status ? <StatusText status={status} /> : undefined}>
      {setup.status !== 'loaded' ? <PublicSiteError message={setup.message} /> : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <PublicSitePolicyForm policy={setup.policy} />
          <div className="grid min-w-0 gap-6">
            <PracticeAreaManager areas={setup.practiceAreas} currencyCode={setup.firm.defaultCurrency} />
            <AttorneyProfileManager setup={attorneys} areas={setup.practiceAreas.map((area) => ({ id: area.id, name: area.name }))} />
          </div>
        </div>
      )}
    </PracticePage>
  )
}
