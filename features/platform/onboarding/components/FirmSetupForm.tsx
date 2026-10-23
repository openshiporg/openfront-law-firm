"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useOnboardingApi } from "../hooks/useOnboardingApi";
import { useFormStatus } from "react-dom";

import { getSyntheticSeedAvailability, type OnboardingState } from "../actions/onboarding";
import seed from "../lib/seed.json";
import { Logo } from "@/features/dashboard/components/Logo";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ErrorBanner, Notice, Panel, StatusDot, Track, fieldClass, labelClass, pillPrimaryClass, trackClass, trackItemClass } from "@/features/platform/components/ui";
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
    <button type="submit" disabled={pending} className={pillPrimaryClass}>
      {pending ? "Creating firm…" : "Create firm workspace"}
    </button>
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
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={inputId} className={labelClass}>
        <span>
          {label}
          {required ? null : <span className="font-normal text-muted-foreground/80"> · optional</span>}
        </span>
        <input
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
          className={fieldClass}
        />
      </label>
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
    <section className="bg-background px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3"><SidebarTrigger className="size-11" /><Logo aria-hidden="true" /></div>
        <header className="mt-8 flex min-w-0 flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Firm setup</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Establish the first firm workspace</h1>
          </div>
          <Track label="Setup sections" className="hidden sm:inline-flex">
            <a href="#setup-firm" className={trackItemClass(false)}>Firm</a>
            <a href="#setup-office" className={trackItemClass(false)}>Office</a>
            <a href="#setup-brand" className={trackItemClass(false)}>Brand</a>
          </Track>
        </header>

        <form action={action} className="mt-6 space-y-6">
          <Panel id="setup-firm" title="Firm">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="firmName" label="Legal firm name" defaultValue={state.values.firmName} autoComplete="organization" required maxLength={200} />
              <Field id="firmSlug" label="Workspace slug" defaultValue={state.values.firmSlug} placeholder="your-firm" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" hint="Lowercase letters, numbers and single hyphens." />
              <Field id="firmDisplayName" label="Display brand" defaultValue={state.values.firmDisplayName} maxLength={120} hint="Defaults to the legal firm name." />
              <Field id="firmShortName" label="Short brand" defaultValue={state.values.firmShortName} maxLength={40} />
              <div className="sm:col-span-2"><Field id="brandTagline" label="Brand tagline" defaultValue={state.values.brandTagline} maxLength={180} /></div>
              <div className="sm:col-span-2"><Field id="supportEmail" label="Support email" type="email" defaultValue={state.values.supportEmail} autoComplete="email" maxLength={320} /></div>
            </div>
          </Panel>

          <Panel id="setup-office" title="First office">
            <div className="grid gap-4 sm:grid-cols-2">
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
          </Panel>

          <Panel id="setup-brand" title="Brand" bodyClassName="space-y-6">
            <LogoPicker initialIcon={state.values.logoIcon} initialColor={state.values.logoColor} />
            <fieldset className="min-w-0">
              <legend className="mb-3 text-sm font-semibold text-foreground">Storefront accent</legend>
              <div className={cn(trackClass, "flex w-full sm:inline-flex sm:w-auto")}>
                {STOREFRONT_ACCENT_PRESETS.map((preset) => (
                  <label key={preset.id} className={cn(trackItemClass(false), "cursor-pointer focus-within:ring-2 focus-within:ring-ring/50 has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-checked:ring-1 has-checked:ring-black/5 dark:has-checked:bg-zinc-800 dark:has-checked:ring-white/10")}>
                    <input type="radio" name="accentId" value={preset.id} defaultChecked={state.values.accentId === preset.id} className="sr-only" />
                    <span aria-hidden="true" className={cn("size-3 rounded-full ring-1 ring-black/10", !preset.hex && "bg-[conic-gradient(from_0deg,#f87171,#facc15,#4ade80,#60a5fa,#c084fc,#f87171)]")} style={preset.hex ? { backgroundColor: preset.hex } : undefined} />
                    {preset.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </Panel>

          <Panel title="Sample data" bodyClassName="space-y-2">
            <label className={cn("flex min-h-11 items-center gap-3 text-sm font-medium", offlineSampleAvailable ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted-foreground")}>
              <input type="checkbox" name="seedSyntheticDemo" value="yes" defaultChecked={offlineSampleAvailable && state.values.seedSyntheticDemo} disabled={!offlineSampleAvailable} aria-describedby={`${listId}-sample`} className="size-5 shrink-0 accent-foreground" />
              Add sample services, clients and matters
            </label>
            <p id={`${listId}-sample`} className="flex items-center gap-2 text-xs text-muted-foreground">
              <StatusDot tone={offlineSampleAvailable ? "emerald" : "zinc"} />
              {offlineSampleAvailable
                ? "Sample records are fictional and stay in this offline test database."
                : "Sample records are available only on an owned offline test database."}
            </p>
          </Panel>

          {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}

          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Notice className="sm:max-w-md">No legal, ethical, privacy, retention or trust-accounting compliance is inferred from these defaults.</Notice>
            <Track className="self-start sm:self-auto">
              <SubmitButton />
            </Track>
          </div>
        </form>
      </div>
    </section>
  );
}

export default FirmSetupForm;
