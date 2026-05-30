"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { OnboardingData, Person } from "@/lib/types";
import { personsApi } from "@/lib/api";
import { useFamilyTreeStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersonCard } from "@/components/person/PersonCard";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Users,
  Baby,
  ChevronRight,
  ChevronLeft,
  Check,
  Search,
  Loader2,
  Plus,
  Trash2,
  TreePine,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Step schemas ──────────────────────────────────────────────────────────────

const selfSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  nickname: z.string().optional(),
  gender: z.enum(["male", "female", "other"]),
  birthDate: z.string().optional(),
});

const parentSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  nickname: z.string().optional(),
});

const siblingSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  nickname: z.string().optional(),
});

type SelfFormValues = z.infer<typeof selfSchema>;
type ParentFormValues = z.infer<typeof parentSchema>;
type SiblingFormValues = z.infer<typeof siblingSchema>;

// ── Step indicator ─────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: "Vous", icon: <User className="w-4 h-4" /> },
  { number: 2, label: "Père", icon: <User className="w-4 h-4" /> },
  { number: 3, label: "Mère", icon: <User className="w-4 h-4" /> },
  { number: 4, label: "Fratrie", icon: <Users className="w-4 h-4" /> },
  { number: 5, label: "Résultats", icon: <Search className="w-4 h-4" /> },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, idx) => (
        <div key={step.number} className="flex items-center">
          <div
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all",
              currentStep > step.number
                ? "bg-primary text-primary-foreground"
                : currentStep === step.number
                  ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {currentStep > step.number ? (
              <Check className="w-4 h-4" />
            ) : (
              step.icon
            )}
          </div>
          <div className="hidden sm:block ml-1.5">
            <p
              className={cn(
                "text-xs font-medium",
                currentStep === step.number
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {step.label}
            </p>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={cn(
                "flex-1 h-0.5 mx-2 sm:mx-3 transition-colors",
                currentStep > step.number ? "bg-primary" : "bg-border"
              )}
              style={{ minWidth: "16px" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OnboardingFlow() {
  const router = useRouter();
  const { toast } = useToast();
  const { addPerson, addRelationship, tree } = useFamilyTreeStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    step: 1,
  });
  const [siblings, setSiblings] = useState<
    Array<{ firstName: string; lastName: string; nickname?: string }>
  >([]);
  const [isOnlyChild, setIsOnlyChild] = useState<boolean | null>(null);
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [searched, setSearched] = useState(false);
  const [newSibling, setNewSibling] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
  });

  // ── Step 1: Self ──────────────────────────────────────────────────────────

  const selfForm = useForm<SelfFormValues>({
    resolver: zodResolver(selfSchema),
    defaultValues: {
      gender: "male",
      firstName: onboardingData.self?.firstName || "",
      lastName: onboardingData.self?.lastName || "",
      nickname: onboardingData.self?.nickname || "",
      birthDate: onboardingData.self?.birthDate || "",
    },
  });

  const genderWatch = selfForm.watch("gender");

  // ── Step 2: Father ────────────────────────────────────────────────────────

  const fatherForm = useForm<ParentFormValues>({
    resolver: zodResolver(parentSchema),
    defaultValues: {
      firstName: onboardingData.father?.firstName || "",
      lastName: onboardingData.father?.lastName || "",
      nickname: onboardingData.father?.nickname || "",
    },
  });

  // ── Step 3: Mother ────────────────────────────────────────────────────────

  const motherForm = useForm<ParentFormValues>({
    resolver: zodResolver(parentSchema),
    defaultValues: {
      firstName: onboardingData.mother?.firstName || "",
      lastName: onboardingData.mother?.lastName || "",
      nickname: onboardingData.mother?.nickname || "",
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStep1 = (data: SelfFormValues) => {
    setOnboardingData((prev) => ({ ...prev, self: data }));
    setCurrentStep(2);
  };

  const handleStep2 = (data: ParentFormValues) => {
    setOnboardingData((prev) => ({ ...prev, father: data }));
    setCurrentStep(3);
  };

  const handleStep3 = (data: ParentFormValues) => {
    setOnboardingData((prev) => ({ ...prev, mother: data }));
    setCurrentStep(4);
  };

  const handleStep4Continue = () => {
    if (isOnlyChild === null) return;
    setOnboardingData((prev) => ({
      ...prev,
      isOnlyChild: isOnlyChild,
      siblings: isOnlyChild ? [] : siblings,
    }));
    handleSearch();
  };

  const handleSearch = async () => {
    setIsLoading(true);
    setCurrentStep(5);
    setSearched(false);

    try {
      const fatherName = onboardingData.father
        ? `${onboardingData.father.firstName} ${onboardingData.father.lastName}`.trim()
        : "";
      const motherName = onboardingData.mother
        ? `${onboardingData.mother.firstName} ${onboardingData.mother.lastName}`.trim()
        : "";
      const siblingNames = (
        onboardingData.isOnlyChild ? [] : siblings
      )
        .map((s) => `${s.firstName} ${s.lastName}`.trim())
        .filter(Boolean);
      const results = await personsApi.search({
        name: `${onboardingData.self?.firstName || ""} ${
          onboardingData.self?.lastName || ""
        }`.trim(),
        parent_names: [fatherName, motherName].filter(Boolean),
        sibling_names: siblingNames,
      });
      setSearchResults(results.map((r) => r.person));
    } catch {
      // Demo: search in existing tree data
      const self = onboardingData.self;
      if (self) {
        const q = `${self.firstName} ${self.lastName}`.toLowerCase();
        const found = tree.persons.filter(
          (p) =>
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
            p.firstName.toLowerCase() === self.firstName.toLowerCase()
        );
        setSearchResults(found);
      } else {
        setSearchResults([]);
      }
    } finally {
      setIsLoading(false);
      setSearched(true);
    }
  };

  const handleAddSibling = () => {
    if (!newSibling.firstName || !newSibling.lastName) return;
    setSiblings((prev) => [...prev, { ...newSibling }]);
    setNewSibling({ firstName: "", lastName: "", nickname: "" });
  };

  const handleRemoveSibling = (idx: number) => {
    setSiblings((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleJoinExisting = (person: Person) => {
    toast({
      title: "Profil trouvé !",
      description: `Vous avez rejoint l'arbre en tant que ${person.firstName} ${person.lastName}.`,
    });
    router.push(`/?focus=${person.id}`);
  };

  const createLocally = () => {
      // Demo / offline mode: create locally in the store
      const self = onboardingData.self!;
      const selfId = `p_${Date.now()}`;
      const selfPerson: Person = {
        id: selfId,
        firstName: self.firstName,
        lastName: self.lastName,
        nicknames: self.nickname ? [self.nickname] : [],
        gender: self.gender,
        birthDate: self.birthDate,
        photos: [],
        audios: [],
        generation: 0,
      };
      addPerson(selfPerson);

      // Add father
      if (onboardingData.father) {
        const fatherId = `p_father_${Date.now()}`;
        addPerson({
          id: fatherId,
          firstName: onboardingData.father.firstName,
          lastName: onboardingData.father.lastName,
          nicknames: onboardingData.father.nickname
            ? [onboardingData.father.nickname]
            : [],
          gender: "male",
          photos: [],
          audios: [],
          generation: -1,
        });
        addRelationship({
          id: `rel_${Date.now()}_1`,
          personAId: fatherId,
          personBId: selfId,
          type: "parent",
        });
      }

      // Add mother
      if (onboardingData.mother) {
        const motherId = `p_mother_${Date.now()}`;
        addPerson({
          id: motherId,
          firstName: onboardingData.mother.firstName,
          lastName: onboardingData.mother.lastName,
          nicknames: onboardingData.mother.nickname
            ? [onboardingData.mother.nickname]
            : [],
          gender: "female",
          photos: [],
          audios: [],
          generation: -1,
        });
        addRelationship({
          id: `rel_${Date.now()}_2`,
          personAId: motherId,
          personBId: selfId,
          type: "parent",
        });
      }

      // Add siblings
      if (!onboardingData.isOnlyChild) {
        siblings.forEach((sib, idx) => {
          const sibId = `p_sib_${Date.now()}_${idx}`;
          addPerson({
            id: sibId,
            firstName: sib.firstName,
            lastName: sib.lastName,
            nicknames: sib.nickname ? [sib.nickname] : [],
            gender: "other",
            photos: [],
            audios: [],
            generation: 0,
          });
          addRelationship({
            id: `rel_${Date.now()}_sib_${idx}`,
            personAId: selfId,
            personBId: sibId,
            type: "sibling",
          });
        });
      }
  };

  const handleCreateNew = async () => {
    setIsLoading(true);
    const self = onboardingData.self;
    try {
      if (!self) throw new Error("missing self");
      // Create the main person via the real backend (requires auth).
      const created = await personsApi.create({
        firstName: self.firstName,
        lastName: self.lastName,
        nicknames: self.nickname ? [self.nickname] : [],
        gender: self.gender,
        birthDate: self.birthDate,
      });
      addPerson({ ...created, generation: 0 });
    } catch {
      // Not authenticated or network unreachable: build the family locally.
      createLocally();
    }

    toast({
      title: "Bienvenue dans l'arbre !",
      description: "Votre profil a été créé avec succès.",
    });
    router.push("/");
    setIsLoading(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">
      <div className="p-6 pb-4 bg-secondary border-b">
        <div className="flex items-center gap-3 mb-1">
          <TreePine className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-serif">Rejoindre l&apos;arbre</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Complétez ces informations pour nous aider à trouver votre position dans l&apos;arbre
        </p>
      </div>

      <div className="p-6">
        <StepIndicator currentStep={currentStep} />

        {/* ── Step 1: Self ── */}
        {currentStep === 1 && (
          <form
            onSubmit={selfForm.handleSubmit(handleStep1)}
            className="space-y-4"
          >
            <div className="mb-4">
              <h2 className="font-semibold text-lg">Qui êtes-vous ?</h2>
              <p className="text-sm text-muted-foreground">
                Commençons par vos informations personnelles
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="s_firstName">
                  Prénom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="s_firstName"
                  placeholder="Kofi"
                  {...selfForm.register("firstName")}
                  className={cn(
                    selfForm.formState.errors.firstName && "border-destructive"
                  )}
                />
                {selfForm.formState.errors.firstName && (
                  <p className="text-xs text-destructive">
                    {selfForm.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s_lastName">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="s_lastName"
                  placeholder="Mensah"
                  {...selfForm.register("lastName")}
                  className={cn(
                    selfForm.formState.errors.lastName && "border-destructive"
                  )}
                />
                {selfForm.formState.errors.lastName && (
                  <p className="text-xs text-destructive">
                    {selfForm.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="s_nickname">Surnom (optionnel)</Label>
              <Input
                id="s_nickname"
                placeholder="Grand frère, Tante Ama..."
                {...selfForm.register("nickname")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Genre <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                {(["male", "female", "other"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => selfForm.setValue("gender", g)}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-sm font-medium transition-colors",
                      genderWatch === g
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    {g === "male" ? "Homme" : g === "female" ? "Femme" : "Autre"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="s_birthDate">Date de naissance (optionnel)</Label>
              <Input
                id="s_birthDate"
                type="date"
                {...selfForm.register("birthDate")}
              />
            </div>

            <Button type="submit" className="w-full mt-2">
              Continuer
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        )}

        {/* ── Step 2: Father ── */}
        {currentStep === 2 && (
          <form
            onSubmit={fatherForm.handleSubmit(handleStep2)}
            className="space-y-4"
          >
            <div className="mb-4">
              <h2 className="font-semibold text-lg">Votre père</h2>
              <p className="text-sm text-muted-foreground">
                Ces informations nous aident à trouver votre lignée
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Prénom <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Kwame"
                  {...fatherForm.register("firstName")}
                  className={cn(
                    fatherForm.formState.errors.firstName && "border-destructive"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Mensah"
                  {...fatherForm.register("lastName")}
                  className={cn(
                    fatherForm.formState.errors.lastName && "border-destructive"
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Surnom (optionnel)</Label>
              <Input
                placeholder="Papa Kwame..."
                {...fatherForm.register("nickname")}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Retour
              </Button>
              <Button type="submit" className="flex-1">
                Continuer
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </form>
        )}

        {/* ── Step 3: Mother ── */}
        {currentStep === 3 && (
          <form
            onSubmit={motherForm.handleSubmit(handleStep3)}
            className="space-y-4"
          >
            <div className="mb-4">
              <h2 className="font-semibold text-lg">Votre mère</h2>
              <p className="text-sm text-muted-foreground">
                Entrez le nom de jeune fille si possible
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Prénom <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Abena"
                  {...motherForm.register("firstName")}
                  className={cn(
                    motherForm.formState.errors.firstName && "border-destructive"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Asante"
                  {...motherForm.register("lastName")}
                  className={cn(
                    motherForm.formState.errors.lastName && "border-destructive"
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Surnom (optionnel)</Label>
              <Input
                placeholder="Maman Abena..."
                {...motherForm.register("nickname")}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(2)}
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Retour
              </Button>
              <Button type="submit" className="flex-1">
                Continuer
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </form>
        )}

        {/* ── Step 4: Siblings ── */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-lg">Frères et sœurs</h2>
              <p className="text-sm text-muted-foreground">
                Avez-vous des frères ou des sœurs ?
              </p>
            </div>

            {/* Only child choice */}
            <div className="flex gap-3">
              <button
                onClick={() => setIsOnlyChild(true)}
                className={cn(
                  "flex-1 py-3 rounded-xl border-2 font-medium text-sm transition-colors",
                  isOnlyChild === true
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/40"
                )}
              >
                <Baby className="w-5 h-5 mx-auto mb-1" />
                Enfant unique
              </button>
              <button
                onClick={() => setIsOnlyChild(false)}
                className={cn(
                  "flex-1 py-3 rounded-xl border-2 font-medium text-sm transition-colors",
                  isOnlyChild === false
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/40"
                )}
              >
                <Users className="w-5 h-5 mx-auto mb-1" />
                J&apos;ai des frères/sœurs
              </button>
            </div>

            {/* Sibling list */}
            {isOnlyChild === false && (
              <div className="space-y-3">
                {siblings.map((sib, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {sib.firstName} {sib.lastName}
                      </p>
                      {sib.nickname && (
                        <p className="text-xs text-muted-foreground">
                          &ldquo;{sib.nickname}&rdquo;
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveSibling(idx)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Add sibling form */}
                <div className="border rounded-xl p-3 space-y-3 bg-accent/30">
                  <p className="text-xs font-medium text-muted-foreground">
                    Ajouter un frère / une sœur
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Prénom"
                      value={newSibling.firstName}
                      onChange={(e) =>
                        setNewSibling((s) => ({
                          ...s,
                          firstName: e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Nom"
                      value={newSibling.lastName}
                      onChange={(e) =>
                        setNewSibling((s) => ({
                          ...s,
                          lastName: e.target.value,
                        }))
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <Input
                    placeholder="Surnom (optionnel)"
                    value={newSibling.nickname}
                    onChange={(e) =>
                      setNewSibling((s) => ({
                        ...s,
                        nickname: e.target.value,
                      }))
                    }
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddSibling}
                    disabled={
                      !newSibling.firstName || !newSibling.lastName
                    }
                    className="w-full text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Ajouter
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(3)}
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Retour
              </Button>
              <Button
                onClick={handleStep4Continue}
                disabled={isOnlyChild === null}
                className="flex-1"
              >
                Rechercher
                <Search className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 5: Search results ── */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-semibold text-lg">Résultats de la recherche</h2>
              <p className="text-sm text-muted-foreground">
                Nous avons cherché{" "}
                <span className="font-medium text-foreground">
                  {onboardingData.self?.firstName} {onboardingData.self?.lastName}
                </span>{" "}
                dans l&apos;arbre
              </p>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Recherche en cours...
                </p>
              </div>
            ) : searched && searchResults.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700 font-medium">
                    {searchResults.length} résultat(s) trouvé(s)
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Êtes-vous l&apos;une de ces personnes ?
                  </p>
                </div>

                <div className="space-y-2">
                  {searchResults.map((person) => (
                    <div key={person.id} className="relative">
                      <PersonCard person={person} />
                      <Button
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={() => handleJoinExisting(person)}
                      >
                        C&apos;est moi !
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCreateNew}
                  disabled={isLoading}
                >
                  {isLoading && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Aucun résultat ne me correspond — Créer mon profil
                </Button>
              </div>
            ) : searched ? (
              <div className="space-y-4">
                <div className="bg-secondary border-border rounded-lg p-4 text-center">
                  <Search className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    Aucun profil trouvé
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vous n&apos;êtes pas encore dans cet arbre généalogique
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleCreateNew}
                  disabled={isLoading}
                >
                  {isLoading && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Créer mon profil dans l&apos;arbre
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setCurrentStep(1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Recommencer
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
