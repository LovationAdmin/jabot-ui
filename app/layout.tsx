import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jabot — Arbre Généalogique Familial",
  description:
    "Explorez et construisez votre arbre généalogique familial. Une plateforme dédiée aux familles africaines pour préserver et partager leur histoire.",
  openGraph: {
    title: "Jabot — Arbre Généalogique",
    description: "Préservez et partagez l'histoire de votre famille.",
    locale: "fr_FR",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
