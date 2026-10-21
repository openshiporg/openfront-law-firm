'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { FirmSetupForm } from './FirmSetupForm'
export default function OnboardingDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}><DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-y-auto p-0"><DialogHeader className="px-5 pt-5"><DialogTitle>Firm setup</DialogTitle><DialogDescription>Workspace settings</DialogDescription></DialogHeader><FirmSetupForm /></DialogContent></Dialog>
}
