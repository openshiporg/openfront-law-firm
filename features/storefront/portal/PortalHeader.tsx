import { FirmBrand, type PortalBrand } from './FirmBrand'
import { signOutPortal } from './actions'

/** Signed-in portal header: session-bound firm lockup and sign out. */
export function PortalHeader({ brand }: { brand: PortalBrand }) {
  return <header className="sf-header">
    <div className="sf-shell sf-header__bar" style={{ maxWidth: '56rem' }}>
      <FirmBrand brand={brand} />
      <form action={signOutPortal} className="ml-auto"><div className="sf-track"><button className="sf-pill sf-pill--raised">Sign out</button></div></form>
    </div>
  </header>
}
