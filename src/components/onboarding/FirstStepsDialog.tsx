import { useState } from "react";
import { IdCard, Plus, UserPlus, Users, X } from "lucide-react";

interface Props {
  onClose: () => void;
}

const STEPS = [
  {
    icon: IdCard,
    title: "Votre fiche vous représente",
    text: "Elle est au cœur de votre arbre. Retrouvez-la à tout moment avec le bouton viseur de la barre du bas, ou modifiez-la depuis le menu compte → « Ma fiche ».",
  },
  {
    icon: Plus,
    title: "Ajoutez vos proches",
    text: "Avec le bouton « Ajouter », créez les fiches de vos parents, frères et sœurs, conjoint·e, enfants… puis reliez-les entre elles depuis le panneau de chaque fiche.",
  },
  {
    icon: Users,
    title: "Famille directe ou étendue",
    text: "La bascule « Directe / Étendue » affiche soit votre branche familiale proche, soit l'arbre complet avec les alliances et les autres branches.",
  },
  {
    icon: UserPlus,
    title: "Invitez votre famille",
    text: "Depuis le menu compte → « Inviter un proche », envoyez une invitation : chacun peut consulter l'arbre et l'enrichir avec vous.",
  },
];

/**
 * Mini-tutoriel affiché une seule fois après la première connexion (post
 * onboarding). Réaffichable via le menu compte → « Revoir le tutoriel ».
 */
export function FirstStepsDialog({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const { icon: Icon, title, text } = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Bienvenue sur Jabot · {step + 1}/{STEPS.length}
          </p>
          <button
            onClick={onClose}
            aria-label="Fermer le tutoriel"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col items-center gap-3 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-7" />
          </div>
          <h2 className="font-serif text-xl text-foreground">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
        </div>

        {/* Points d'étape */}
        <div className="mt-5 flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Étape ${i + 1}`}
              className={
                i === step
                  ? "h-1.5 w-5 rounded-full bg-primary transition-all"
                  : "size-1.5 rounded-full bg-border transition-all hover:bg-muted-foreground"
              }
            />
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Précédent
            </button>
          ) : (
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Passer
            </button>
          )}
          <button
            onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {isLast ? "C'est parti !" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
