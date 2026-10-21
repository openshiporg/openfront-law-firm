"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useOnboardingApi } from "../hooks/useOnboardingApi";
import { useFormStatus } from "react-dom";

import { getSyntheticSeedAvailability, type OnboardingState } from "../actions/onboarding";
import seed from "../lib/seed.json";
import { Logo } from "@/features/dashboard/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { LogoPicker } from "@/features/platform/store-settings/LogoPicker";
import { LOGO_ICONS } from "@/features/platform/store-settings/lib/untitled-logo-registry";
import { STOREFRONT_ACCENT_PRESETS } from "@/features/storefront/lib/accent";

const seedLogo = LOGO_ICONS.find((icon) => icon.id === seed.logoIcon) ?? LOGO_ICONS[0];

const initialState: OnboardingState = {
  message: null,
  redirectTo: null,
  values: {
    firmName: "",
    firmSlug: "",
    firmDisplayName: "",
    firmShortName: "",
    brandTagline: "",
    accentId: seed.accentId,
    logoIcon: seedLogo.lightSvg,
    logoColor: seed.logoColor,
    supportEmail: "",
    officeName: "",
    officeCode: "",
    timezone: "America/Los_Angeles",
    currencyCode: "USD",
    practiceAreaName: "",
    seedSyntheticDemo: false,
  },
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Creating firm…" : "Create firm workspace"}
    </Button>
  );
}

const NO_SUGGESTIONS: readonly string[] = [];
const suggestionCache = new Map<"timeZone" | "currency", readonly string[]>();
function supported(kind: "timeZone" | "currency") {
  if (!suggestionCache.has(kind)) {
    try {
      suggestionCache.set(kind, Intl.supportedValuesOf(kind));
    } catch {
      suggestionCache.set(kind, NO_SUGGESTIONS);
    }
  }
  return suggestionCache.get(kind) ?? NO_SUGGESTIONS;
}
const noSubscription = () => () => {};

/** Suggestions come from the visitor's runtime after hydration (server and browser lists differ). */
function Suggestions({ id, kind }: { id: string; kind: "timeZone" | "currency" }) {
  const values = useSyncExternalStore(noSubscription, () => supported(kind), () => NO_SUGGESTIONS);
  return <datalist id={id}>{values.map((value) => <option key={value} value={value} />)}</datalist>;
}

function Field({
  id,
  label,
  defaultValue,
  placeholder,
  autoComplete,
  required = false,
  type = "text",
  maxLength,
  pattern,
  list,
  hint,
}: {
  id: keyof OnboardingState["values"];
  label: string;
  defaultValue: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  type?: "text" | "email";
  maxLength?: number;
  pattern?: string;
  list?: string;
  hint?: string;
}) {
  const inputId = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        {label}
        {required ? null : <span className="font-normal text-muted-foreground"> (optional)</span>}
      </Label>
      <Input
        id={inputId}
        name={id}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        maxLength={maxLength}
        pattern={pattern}
        list={list}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
      />
      {hint ? <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Required fields mirror completeFirmOnboarding's server contract: firm name,
 * slug, first office, office code, timezone and currency. Branding, support
 * email and the practice-area name are optional and fall back to server defaults.
 */
export function FirmSetupForm({ offlineSampleAvailable: preflight }: { offlineSampleAvailable?: boolean }) {
  const [state, action] = useOnboardingApi(initialState);
  const listId = useId();
  // Server pages pass the preflight; the dialog asks the same viewer query after mount.
  const [checked, setChecked] = useState<boolean | null>(null);
  useEffect(() => {
    if (preflight !== undefined) return;
    let current = true;
    getSyntheticSeedAvailability().then((available) => { if (current) setChecked(available); }, () => { if (current) setChecked(false); });
    return () => { current = false; };
  }, [preflight]);
  const offlineSampleAvailable = preflight ?? checked ?? false;

  useEffect(() => {
    if (state.redirectTo) window.location.assign(state.redirectTo);
  }, [state.redirectTo]);

  return (
    <section className="bg-background px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3"><SidebarTrigger className="size-11" /><Logo aria-hidden="true" /></div>
        <div className="mt-10 max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">Firm setup</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Establish the first firm workspace
          </h1>
        </div>

        <form action={action} className="mt-10 border-t border-border pt-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field id="firmName" label="Legal firm name" defaultValue={state.values.firmName} autoComplete="organization" required maxLength={200} />
            <Field id="firmSlug" label="Workspace slug" defaultValue={state.values.firmSlug} placeholder="your-firm" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" hint="Lowercase letters, numbers and single hyphens." />
            <Field id="firmDisplayName" label="Display brand" defaultValue={state.values.firmDisplayName} maxLength={120} hint="Defaults to the legal firm name." />
            <Field id="firmShortName" label="Short brand" defaultValue={state.values.firmShortName} maxLength={40} />
            <div className="sm:col-span-2"><Field id="brandTagline" label="Brand tagline" defaultValue={state.values.brandTagline} maxLength={180} /></div>
            <Field id="supportEmail" label="Support email" type="email" defaultValue={state.values.supportEmail} autoComplete="email" maxLength={320} />
            <Field id="officeName" label="First office" defaultValue={state.values.officeName} required maxLength={200} />
            <Field id="officeCode" label="Office code" defaultValue={state.values.officeCode} required maxLength={30} />
            <Field id="timezone" label="IANA timezone" defaultValue={state.values.timezone} placeholder="America/New_York" required maxLength={100} list={`${listId}-timezones`} />
            <Field id="currencyCode" label="Currency code" defaultValue={state.values.currencyCode} placeholder="USD" required maxLength={3} pattern="[A-Za-z]{3}" list={`${listId}-currencies`} />
            <div className="sm:col-span-2">
              <Field id="practiceAreaName" label="Default practice area" defaultValue={state.values.practiceAreaName} maxLength={200} hint="Defaults to General Practice." />
            </div>
            <Suggestions id={`${listId}-timezones`} kind="timeZone" />
            <Suggestions id={`${listId}-currencies`} kind="currency" />
          </div>

          <div className="mt-8 grid gap-6">
            <LogoPicker initialIcon={state.values.logoIcon} initialColor={state.values.logoColor} />
            <fieldset>
              <legend className="text-sm font-medium">Storefront accent</legend>
              <div className="mt-3 flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
                {STOREFRONT_ACCENT_PRESETS.map((preset) => (
                  <label key={preset.id} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 text-sm focus-within:ring-2 focus-within:ring-ring has-checked:border-border has-checked:bg-background has-checked:font-medium has-checked:shadow-sm")}>
                    <input type="radio" name="accentId" value={preset.id} defaultChecked={state.values.accentId === preset.id} className="size-11 shrink-0 accent-foreground" />
                    <span aria-hidden="true" className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: preset.hex || "transparent" }} />
                    {preset.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {state.message ? (
            <p role="alert" className="mt-6 border-l-2 border-destructive pl-3 text-sm text-destructive">
              {state.message}
            </p>
          ) : null}

          <div className="mt-6 space-y-1">
            <label className={cn("flex min-h-11 items-center gap-3 text-sm", offlineSampleAvailable ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground")}>
              <input type="checkbox" name="seedSyntheticDemo" value="yes" defaultChecked={offlineSampleAvailable && state.values.seedSyntheticDemo} disabled={!offlineSampleAvailable} aria-describedby={`${listId}-sample`} className="size-11 shrink-0" />
              Add sample services, clients and matters
            </label>
            <p id={`${listId}-sample`} className="text-xs text-muted-foreground">
              {offlineSampleAvailable
                ? "Sample records are fictional and stay in this offline test database."
                : "Sample records are available only on an owned offline test database."}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <p className="max-w-md text-xs leading-5 text-muted-foreground">
              No legal, ethical, privacy, retention, or trust-accounting compliance is inferred from these defaults.
            </p>
            <SubmitButton />
          </div>
        </form>
      </div>
    </section>
  );
}

export default FirmSetupForm;
