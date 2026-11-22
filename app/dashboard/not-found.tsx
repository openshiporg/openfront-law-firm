import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Page not available' }

/** Staff who open a workspace page that is missing, or outside their role, stay inside the workspace. */
export default function DashboardNotFound() {
  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-semibold text-foreground">Page not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn’t exist, or your role doesn’t include it. A firm administrator can change what your role includes.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="min-h-11 flex-1"><Link href="/dashboard/platform/my-work">My work</Link></Button>
          <Button asChild variant="outline" className="min-h-11 flex-1"><Link href="/dashboard/platform/today">Today</Link></Button>
        </div>
      </div>
    </main>
  )
}
