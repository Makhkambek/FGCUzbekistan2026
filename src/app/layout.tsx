import type { Metadata } from "next";
import { Geist, Geist_Mono, Barlow_Condensed, IBM_Plex_Sans, IBM_Plex_Mono, Roboto } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display-screen only (see src/app/display) — copied from the provided
// FGC Match/Playoffs Display.html reference files, which use exactly this
// three-font system (Barlow Condensed for headlines/scores, IBM Plex Sans
// for names, IBM Plex Mono for labels/data) — not used on the light
// SFRC-styled pages.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// The public board only — FIRST Global's own results page is set in Roboto,
// and the board is meant to read as the same family of page.
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "FGC Uzbekistan 2026 · Scoring",
  description: "Live scores and rankings for the FIRST Global Challenge Uzbekistan 2026 event",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${barlowCondensed.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} ${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
