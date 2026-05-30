import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { ArrowLeft, CheckCircle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth/")({
  component: AuthPage,
});

type Step = "phone" | "otp" | "success";

function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [phoneInput, setPhoneInput] = useState("+221");
  const [otpInput, setOtpInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const result = await authApi.requestOtp(phoneInput);
      setPhone(phoneInput);
      setStep("otp");
      if (result.devCode) setDevCode(result.devCode);
    } catch {
      setError("Impossible d'envoyer le code. Vérifiez votre numéro.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const result = await authApi.verifyOtp(phone, otpInput);
      login(result.token, result.userId, phone);
      setStep("success");
      setTimeout(() => navigate({ to: "/" }), 1500);
    } catch {
      setError("Code incorrect. Vérifiez et réessayez.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="canvas-grid flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour aux arbres
        </Link>

        <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-float">
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="brand-gradient grid size-12 place-items-center rounded-2xl text-white shadow-sm">
              <Sparkles className="size-6" />
            </div>
            <span className="font-display text-3xl font-bold tracking-tight text-foreground">Jabot</span>
          </div>

          {step === "phone" && (
            <>
              <div className="mb-6 text-center">
                <h1 className="font-display text-2xl font-bold text-foreground">Connexion</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Entrez votre numéro pour recevoir un code
                </p>
              </div>
              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Numéro de téléphone
                  </label>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="+221 77 000 00 00"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="brand-gradient w-full rounded-xl py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? "Envoi…" : "Recevoir le code"}
                </button>
              </form>
            </>
          )}

          {step === "otp" && (
            <>
              <div className="mb-6 text-center">
                <h1 className="font-display text-2xl font-bold text-foreground">Vérification</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Code envoyé au{" "}
                  <span className="font-medium text-foreground">{phone}</span>
                </p>
                {devCode && (
                  <div className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Mode test — code :{" "}
                    <span className="font-mono font-bold tracking-widest">{devCode}</span>
                  </div>
                )}
              </div>
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Code à 6 chiffres
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={isLoading || otpInput.length < 6}
                  className="brand-gradient w-full rounded-xl py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isLoading ? "Vérification…" : "Valider"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  Modifier le numéro
                </button>
              </form>
            </>
          )}

          {step === "success" && (
            <div className="py-4 text-center">
              <CheckCircle className="mx-auto mb-3 size-16 text-green-500" />
              <h1 className="font-display text-2xl font-bold text-foreground">Connexion réussie !</h1>
              <p className="mt-1 text-sm text-muted-foreground">Redirection en cours…</p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          En vous connectant, vous acceptez nos{" "}
          <span className="underline underline-offset-2">conditions d'utilisation</span>.
        </p>
      </div>
    </div>
  );
}
