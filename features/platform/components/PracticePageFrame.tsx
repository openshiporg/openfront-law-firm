'use client'

import type { ReactNode } from 'react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { useDashboard } from '@/features/dashboard/context/DashboardProvider'
import { platformBreadcrumbs, type PlatformTrailItem } from '@/features/platform/lib/navigation'

/** Feature-owned client boundary: server-rendered domain content stays children;
 * the canonical DashboardProvider remains the authority for its actual base path. */
export function PracticePage({ title, children, actions, trail }: {
  title: string
  description: string
  children: ReactNode
  actions?: ReactNode
  trail?: PlatformTrailItem[]
}) {
  const { basePath } = useDashboard()
  return <PageContainer title={title} breadcrumbs={platformBreadcrumbs(trail ?? [{ label: title }], basePath)} header={
    <div className="flex min-w-0 flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><h1 className="text-2xl font-semibold text-foreground [overflow-wrap:anywhere]">{title}</h1></div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  }><div className="min-w-0 px-4 pb-16 pt-2 md:px-6">{children}</div></PageContainer>
}
