"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

interface OtpInputProps {
  onSubmit: (otp: string) => void;
  onResend: () => void;
  onBack: () => void;
  isLoading: boolean;
  phone: string;
}

export function OtpInput({
  onSubmit,
  onResend,
  onBack,
  isLoading,
  phone,
}: OtpInputProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];

    // Handle paste
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6);
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || "";
      }
      setOtp(newOtp);
      // Focus last filled or next empty
      const lastIdx = Math.min(digits.length, 5);
      inputRefs.current[lastIdx]?.focus();

      if (digits.length === 6) {
        onSubmit(digits);
      }
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next on input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (newOtp.every((d) => d !== "")) {
      onSubmit(newOtp.join(""));
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setResendCooldown(30);
    setOtp(["", "", "", "", "", ""]);
    inputRefs.current[0]?.focus();
    onResend();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length === 6) {
      onSubmit(code);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* OTP boxes */}
      <div className="flex gap-2 justify-center">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={6} // allow paste
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="otp-input"
            style={{ width: "3rem", height: "3.5rem" }}
            autoComplete={i === 0 ? "one-time-code" : "off"}
          />
        ))}
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || otp.some((d) => !d)}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Vérification...
          </>
        ) : (
          "Vérifier le code"
        )}
      </Button>

      {/* Resend */}
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Vous n&apos;avez pas reçu le code ?
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleResend}
          disabled={resendCooldown > 0 || isLoading}
          className="text-primary"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          {resendCooldown > 0
            ? `Renvoyer dans ${resendCooldown}s`
            : "Renvoyer le code"}
        </Button>
      </div>

      {/* Back */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="w-full text-muted-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
        Changer de numéro
      </Button>

      {/* Demo hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-xs text-amber-700">
          <strong>Mode démo :</strong> Utilisez le code <strong>123456</strong>
        </p>
      </div>
    </form>
  );
}
