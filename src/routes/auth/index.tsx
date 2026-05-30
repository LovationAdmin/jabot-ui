import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "@/lib/store";
import { authApi } from "@/lib/api";
import { ArrowLeft, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/auth/")({
  head: () => ({ meta: [{ title: "Connexion — Jabot" }] }),
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
      setError("Impossible d'envoyer le code. Verifiez votre numero.");
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
      login(result.token, result.userId, phone, { personId: result.personId, onboarded: result.onboarded });
      setStep("success");
      setTimeout(() => navigate({ to: "/" }), 1500);
    } catch {
      setError("Code incorrect. Verifiez et reessayez.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="canvas-grid flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour a l'arbre
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-float">
          <div className="mb-6 flex items-center justify-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary text-2xl text-primary-foreground">
              🌳
            </div>
            <span className="font-serif text-3xl text-foreground">Jabot</span>
          </div>

          {step === "phone" && (
            <>
              <div className="mb-6 text-center">
                <h1 className="font-serif text-2xl text-foreground">Presenter ma famille</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Entrez votre numero pour recevoir un code
                </p>
              </div>
              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Numero de telephone
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
                  className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isLoading ? "Envoi…" : "Recevoir le code"}
                </button>
              </form>
            </>
          )}

          {step === "otp" && (
            <>
              <div className="mb-6 text-center">
                <h1 className="font-serif text-2xl text-foreground">Verification</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Code envoye au{" "}
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
                    Code a 6 chiffres
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
                  className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isLoading ? "Verification…" : "Valider"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  Modifier le numero
                </button>
              </form>
            </>
          )}

          {step === "success" && (
            <div className="py-4 text-center">
              <CheckCircle className="mx-auto mb-3 size-16 text-green-500" />
              <h1 className="font-serif text-2xl text-foreground">Connexion reussie !</h1>
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
