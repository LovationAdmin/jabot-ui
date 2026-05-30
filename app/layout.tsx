import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
