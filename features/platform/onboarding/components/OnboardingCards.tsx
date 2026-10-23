"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Rocket } from "lucide-react";
import { StatusDot, Track, pillClass, pillPrimaryClass, trackItemClass } from "@/features/platform/components/ui";

export interface OnboardingStep {
  href: string;
  title: string;
  description: string;
}

// Base InfoCard components
interface CommonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const InfoCardTitle = React.memo(
  ({ children, className, ...props }: CommonCardProps) => {
    return (
      <div className={cn("flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground", className)} {...props}>
        <StatusDot tone="sky" className="animate-pulse motion-reduce:animate-none" />
        <span className="min-w-0 truncate">{children}</span>
      </div>
    );
  }
);
InfoCardTitle.displayName = "InfoCardTitle";

const InfoCardDescription = React.memo(
  ({ children, className, ...props }: CommonCardProps) => {
    return (
      <div className={cn("pl-4 text-xs leading-5 text-muted-foreground", className)} {...props}>
        {children}
      </div>
    );
  }
);
InfoCardDescription.displayName = "InfoCardDescription";

const InfoCardContent = React.memo(
  ({ children, className, ...props }: CommonCardProps) => {
    return (
      <div className={cn("flex min-w-0 flex-col gap-0.5", className)} {...props}>
        {children}
      </div>
    );
  }
);
InfoCardContent.displayName = "InfoCardContent";

const InfoCardFooter = ({
  children,
  className,
}: CommonCardProps) => {
  return <div className={cn("mt-3", className)}>{children}</div>;
};

export function OnboardingCards({
  steps,
  onboardingStatus,
  onDismiss,
  onOpenDialog,
  userRole,
}: {
  steps: OnboardingStep[];
  onboardingStatus?: string;
  onDismiss: () => void;
  onOpenDialog?: () => void;
  userRole?: { canManageOnboarding?: boolean | null } | null;
}) {
  const [dismissedSteps] = React.useState<string[]>([]);
  const cards = steps.filter(({ href }) => !dismissedSteps.includes(href));
  const cardCount = cards.length;
  const [showCompleted, setShowCompleted] = React.useState(cardCount > 0);

  React.useEffect(() => {
    let timeout: NodeJS.Timeout | undefined = undefined;
    if (cardCount === 0)
      timeout = setTimeout(() => setShowCompleted(false), 2700);
    return () => clearTimeout(timeout);
  }, [cardCount]);

  // Don't show onboarding if user doesn't have permission
  if (!userRole?.canManageOnboarding) {
    return null;
  }

  if (onboardingStatus === "completed" || onboardingStatus === "dismissed") {
    return null;
  }

  return cards.length || showCompleted ? (
    <div className="w-full">
      {cards.map(({ href, title, description }) => (
        <OnboardingCard
          key={href}
          title={title}
          description={description}
          onDismiss={onDismiss}
          onOpenDialog={onOpenDialog}
        />
      ))}
    </div>
  ) : null;
}

function OnboardingCard({
  title,
  description,
  onDismiss,
  onOpenDialog,
}: {
  title: string;
  description: string;
  onDismiss?: () => void;
  onOpenDialog?: () => void;
}) {
  const [isDismissed, setIsDismissed] = React.useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) {
    return null;
  }

  return (
    <>
      {/* Full sidebar view */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-xs group-has-[[data-collapsible=icon]]/sidebar-wrapper:hidden">
        <InfoCardContent>
          <InfoCardTitle>{title}</InfoCardTitle>
          <InfoCardDescription>{description}</InfoCardDescription>
        </InfoCardContent>
        <InfoCardFooter>
          <Track className="flex w-full">
            <button type="button" onClick={onOpenDialog} className={cn(pillPrimaryClass, "h-7 flex-1 px-3 text-xs")}>
              Get started
            </button>
            <button type="button" onClick={handleDismiss} className={cn(trackItemClass(false), "h-7 px-2.5 text-xs")}>
              Skip for now
            </button>
          </Track>
        </InfoCardFooter>
      </div>

      {/* Icon-only sidebar view */}
      <div className="relative hidden group-has-[[data-collapsible=icon]]/sidebar-wrapper:block">
        <StatusDot tone="sky" className="absolute -right-0.5 -top-0.5 z-10 animate-pulse motion-reduce:animate-none" />
        <button type="button" onClick={onOpenDialog} aria-label="Firm setup" className={cn(pillClass, "size-8 px-0")}>
          <Rocket className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
