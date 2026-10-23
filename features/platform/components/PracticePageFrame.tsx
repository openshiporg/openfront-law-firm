'use client'

import type { ReactNode } from 'react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { useDashboard } from '@/features/dashboard/context/DashboardProvider'
import { platformBreadcrumbs, type PlatformTrailItem } from '@/features/platform/lib/navigation'

/** Feature-owned client boundary: server-rendered domain content stays children;
 * the canonical DashboardProvider remains the authority for its actual base path. */
export function PracticePage({ title, children, actions, trail, status, meta, toolbar }: {
  title: string
  description: string
  children: ReactNode
  actions?: ReactNode
  trail?: PlatformTrailItem[]
  /** Optional record status: its dot sits on the title line. */
  status?: ReactNode
  meta?: ReactNode
  toolbar?: ReactNode
}) {
  const { basePath } = useDashboard()
  return <PageContainer title={title} breadcrumbs={platformBreadcrumbs(trail ?? [{ label: title }], basePath)} header={
    <div className="flex min-w-0 flex-col gap-3 pb-1 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere]">{title}</h1>
          {status}
        </div>
        {meta ? <div className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  }>
    {toolbar ? <div className="min-w-0 px-4 pt-3 md:px-6">{toolbar}</div> : null}
    <div className="min-w-0 px-4 pb-16 pt-4 md:px-6">{children}</div>
  </PageContainer>
}
