"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Phone } from "lucide-react";

interface PhoneInputProps {
  onSubmit: (phone: string) => void;
  isLoading: boolean;
}

// Top African countries with phone codes
const COUNTRY_CODES = [
  { code: "+225", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "+221", flag: "🇸🇳", name: "Sénégal" },
  { code: "+237", flag: "🇨🇲", name: "Cameroun" },
  { code: "+242", flag: "🇨🇬", name: "Congo" },
  { code: "+243", flag: "🇨🇩", name: "Congo RDC" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+228", flag: "🇹🇬", name: "Togo" },
  { code: "+229", flag: "🇧🇯", name: "Bénin" },
  { code: "+226", flag: "🇧🇫", name: "Burkina Faso" },
  { code: "+223", flag: "🇲🇱", name: "Mali" },
  { code: "+224", flag: "🇬🇳", name: "Guinée" },
  { code: "+222", flag: "🇲🇷", name: "Mauritanie" },
  { code: "+227", flag: "🇳🇪", name: "Niger" },
  { code: "+212", flag: "🇲🇦", name: "Maroc" },
  { code: "+213", flag: "🇩🇿", name: "Algérie" },
  { code: "+216", flag: "🇹🇳", name: "Tunisie" },
  { code: "+20", flag: "🇪🇬", name: "Égypte" },
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+255", flag: "🇹🇿", name: "Tanzanie" },
  { code: "+256", flag: "🇺🇬", name: "Ouganda" },
  { code: "+27", flag: "🇿🇦", name: "Afrique du Sud" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+32", flag: "🇧🇪", name: "Belgique" },
  { code: "+41", flag: "🇨🇭", name: "Suisse" },
  { code: "+1", flag: "🇺🇸", name: "États-Unis" },
];

export function PhoneInput({ onSubmit, isLoading }: PhoneInputProps) {
  const [countryCode, setCountryCode] = useState("+225");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\s/g, "").replace(/-/g, "");
    if (cleanPhone) {
      onSubmit(`${countryCode}${cleanPhone}`);
    }
  };

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">Numéro de téléphone</Label>
        <div className="flex gap-2">
          <Select value={countryCode} onValueChange={setCountryCode}>
            <SelectTrigger className="w-[140px] flex-shrink-0">
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  <span>{selectedCountry?.flag}</span>
                  <span className="text-sm">{countryCode}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {COUNTRY_CODES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  <span className="flex items-center gap-2">
                    <span>{country.flag}</span>
                    <span>{country.name}</span>
                    <span className="text-muted-foreground ml-auto">
                      {country.code}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="phone"
              type="tel"
              placeholder="07 00 00 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-9"
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Nous vous enverrons un code de vérification par SMS
        </p>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || !phone.trim()}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Envoi en cours...
          </>
        ) : (
          "Recevoir le code"
        )}
      </Button>

      {/* Demo note */}
      <div className="bg-secondary border-border rounded-lg p-3">
        <p className="text-xs text-muted-foreground">
          <strong>Mode démo :</strong> Entrez n&apos;importe quel numéro et utilisez le code{" "}
          <strong>123456</strong> pour vous connecter.
        </p>
      </div>
    </form>
  );
}
