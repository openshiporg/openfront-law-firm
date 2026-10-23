import { suggestLedgerNumber } from '../actions/openTrustRecords'
import { TrustSetupForm, type TrustSetupAccount } from './TrustSetupForm'

export async function TrustSetupPanel({ accounts }: { accounts: TrustSetupAccount[] }) {
  return <TrustSetupForm accounts={accounts} suggestedLedgerNumber={await suggestLedgerNumber()} />
}
