import type { ReactNode } from 'react'

import { requireFirmWorkspace } from '../lib/firmOnboarding'

export async function FirmWorkspaceLayout({ children }: { children: ReactNode }) {
  await requireFirmWorkspace()
  return children
}
