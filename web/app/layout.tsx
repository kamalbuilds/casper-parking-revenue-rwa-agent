import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const ClientProviders = nextDynamic(
  () =>
    import("@/components/ClientProviders").then((mod) => mod.ClientProviders),
  { ssr: false }
);

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Parking Revenue RWA Agent",
  description:
    "Agent-verified parking revenue reports settled on Casper with on-chain proof.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${plexSans.variable} ${plexMono.variable}`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
