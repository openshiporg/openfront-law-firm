'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { FirmSetupForm } from './FirmSetupForm'
export default function OnboardingDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-y-auto rounded-2xl p-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 text-left backdrop-blur">
          <DialogTitle className="text-base font-semibold">Firm setup</DialogTitle>
          <DialogDescription className="text-xs">Workspace settings</DialogDescription>
        </DialogHeader>
        <FirmSetupForm inDialog />
      </DialogContent>
    </Dialog>
  )
}
