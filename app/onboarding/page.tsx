"use client";

import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { Trees, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-6 text-muted-foreground" asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour à l&apos;arbre
          </Link>
        </Button>

        <div className="flex items-center gap-2 mb-8">
          <Trees className="w-7 h-7 text-primary" />
          <span className="font-bold text-xl">Jabot</span>
          <span className="text-muted-foreground">— Rejoindre l&apos;arbre</span>
        </div>

        <OnboardingFlow />
      </div>
    </div>
  );
}
