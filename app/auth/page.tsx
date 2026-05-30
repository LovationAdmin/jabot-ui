"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { OtpInput } from "@/components/auth/OtpInput";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

type Step = "phone" | "otp" | "success";

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handlePhoneSubmit = async (phoneNumber: string) => {
    setIsLoading(true);
    try {
      await authApi.requestOtp(phoneNumber);
      setPhone(phoneNumber);
      setStep("otp");
    } catch {
      // In dev mode, simulate OTP sending
      setPhone(phoneNumber);
      setStep("otp");
      toast({
        title: "Code OTP envoyé",
        description: `Un code a été envoyé au ${phoneNumber} (mode démo: utilisez 123456)`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (otp: string) => {
    setIsLoading(true);
    try {
      const result = await authApi.verifyOtp(phone, otp);
      login(result.token, result.userId, phone);
      setStep("success");
      setTimeout(() => {
        if (result.isNewUser) {
          router.push("/onboarding");
        } else {
          router.push("/");
        }
      }, 1500);
    } catch {
      // Demo mode: accept 123456
      if (otp === "123456") {
        const demoToken = "demo_token_" + Date.now();
        const demoUserId = "demo_user";
        login(demoToken, demoUserId, phone);
        setStep("success");
        setTimeout(() => router.push("/"), 1500);
      } else {
        toast({
          title: "Code incorrect",
          description: "Le code OTP est incorrect. En mode démo, utilisez 123456.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="canvas-grid bg-canvas min-h-screen flex items-center justify-center p-4">
      <div className="relative w-full max-w-md animate-float-in">
        {/* Back button */}
        <Button variant="ghost" size="sm" className="mb-6 text-muted-foreground" asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour à l&apos;arbre
          </Link>
        </Button>

        <div className="bg-card rounded-2xl shadow-float border p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-lg">
                🌳
              </div>
              <span className="font-serif text-3xl text-foreground">Jabot</span>
            </div>

            {step === "phone" && (
              <>
                <h1 className="font-serif text-2xl text-foreground">Connexion</h1>
                <p className="text-muted-foreground text-sm">
                  Entrez votre numéro de téléphone pour recevoir un code de vérification
                </p>
              </>
            )}

            {step === "otp" && (
              <>
                <h1 className="font-serif text-2xl text-foreground">Vérification</h1>
                <p className="text-muted-foreground text-sm">
                  Entrez le code à 6 chiffres envoyé au{" "}
                  <span className="font-medium text-foreground">{phone}</span>
                </p>
              </>
            )}

            {step === "success" && (
              <>
                <div className="flex justify-center">
                  <CheckCircle className="w-16 h-16 text-green-500" />
                </div>
                <h1 className="font-serif text-2xl text-foreground">Connexion réussie !</h1>
                <p className="text-muted-foreground text-sm">Redirection en cours...</p>
              </>
            )}
          </div>

          {/* Form steps */}
          {step === "phone" && (
            <PhoneInput onSubmit={handlePhoneSubmit} isLoading={isLoading} />
          )}

          {step === "otp" && (
            <OtpInput
              onSubmit={handleOtpSubmit}
              onResend={() => handlePhoneSubmit(phone)}
              isLoading={isLoading}
              phone={phone}
              onBack={() => setStep("phone")}
            />
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          En vous connectant, vous acceptez nos conditions d&apos;utilisation et notre politique de confidentialité.
        </p>
      </div>
    </div>
  );
}
