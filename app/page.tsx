"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CanvasSidebar } from "@/components/canvas/CanvasSidebar";
import { PersonSheet } from "@/components/person/PersonSheet";
import { useFamilyTreeStore } from "@/lib/store";
import { useAuthStore } from "@/lib/store";
import { Person } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus, Trees } from "lucide-react";
import Link from "next/link";

// Dynamic import to avoid SSR issues with React Flow
const FamilyCanvas = dynamic(() => import("@/components/canvas/FamilyCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[hsl(40,25%,95%)]">
      <div className="text-center space-y-3">
        <Trees className="w-12 h-12 text-primary mx-auto animate-pulse" />
        <p className="text-muted-foreground font-medium">Chargement de l&apos;arbre...</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const { selectedPersonId, setSelectedPerson, getPersonById } = useFamilyTreeStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedPerson, setSelectedPersonState] = useState<Person | null>(null);

  useEffect(() => {
    if (selectedPersonId) {
      const person = getPersonById(selectedPersonId);
      if (person) {
        setSelectedPersonState(person);
        setSheetOpen(true);
      }
    } else {
      setSheetOpen(false);
    }
  }, [selectedPersonId, getPersonById]);

  const handleCloseSheet = () => {
    setSheetOpen(false);
    setSelectedPerson(null);
    setSelectedPersonState(null);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-14 border-b bg-white/90 backdrop-blur-sm flex items-center justify-between px-4 z-10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Trees className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg text-foreground tracking-tight">Jabot</span>
          <span className="text-muted-foreground text-sm hidden sm:block">— Arbre Généalogique</span>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Button size="sm" variant="outline" asChild>
              <Link href="/onboarding">
                <UserPlus className="w-4 h-4 mr-1" />
                Ajouter un membre
              </Link>
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" asChild>
                <Link href="/auth">
                  <LogIn className="w-4 h-4 mr-1" />
                  Connexion
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/onboarding">Me rejoindre</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <CanvasSidebar />
        <FamilyCanvas />
      </div>

      {/* Person detail sheet */}
      {selectedPerson && (
        <PersonSheet
          person={selectedPerson}
          open={sheetOpen}
          onClose={handleCloseSheet}
          isAuthenticated={isAuthenticated}
        />
      )}
    </div>
  );
}
