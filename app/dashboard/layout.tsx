import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

import { getStorefrontSettings, NEUTRAL_FIRM_NAME } from "@/features/storefront/lib/storefront-settings";

export async function generateMetadata(): Promise<Metadata> {
  const name = (await getStorefrontSettings()).firmName || NEUTRAL_FIRM_NAME;
  return { title: { absolute: `${name} staff` }, description: `Staff dashboard for ${name}.` };
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <Toaster />
    </ThemeProvider>
  );
}
