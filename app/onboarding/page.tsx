"use client";

import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OnboardingPage() {
  return (
    <div className="canvas-grid bg-canvas min-h-screen p-4">
      <div className="max-w-2xl mx-auto animate-float-in">
        <Button variant="ghost" size="sm" className="mb-6 text-muted-foreground" asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour à l&apos;arbre
          </Link>
        </Button>

        <div className="flex items-center gap-2.5 mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-base">
            🌳
          </div>
          <span className="font-serif text-2xl">Jabot</span>
          <span className="text-muted-foreground">— Rejoindre l&apos;arbre</span>
        </div>

        <OnboardingFlow />
      </div>
    </div>
  );
}
