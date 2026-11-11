import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono, Libre_Franklin } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Public site voice: Franklin Gothic, the face of American legal notices and court forms.
const franklin = Libre_Franklin({
  variable: "--font-franklin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Public site display sans (Altair): the wordmark, names and headings. Text stays in Franklin.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
});

// Product fallback only: dashboard routes carry the shared dashboard identity and
// public routes carry firm-owned metadata, so no global title template applies.
export const metadata: Metadata = {
  title: "Openfront Law Firm",
  description: "Openfront Law Firm",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="/favicon.svg" rel="icon" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${franklin.variable} ${bricolage.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
