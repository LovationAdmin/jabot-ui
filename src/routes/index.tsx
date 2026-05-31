import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Connectors } from "@/components/tree/Connectors";
import { PersonCard } from "@/components/tree/PersonCard";
import { EditPanel } from "@/components/tree/EditPanel";
import { Toolbar } from "@/components/tree/Toolbar";
import { MiniMap } from "@/components/tree/MiniMap";
import { PersonFormDialog } from "@/components/tree/PersonFormDialog";
import { AccountMenu } from "@/components/tree/AccountMenu";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";
import { useFamilyTreeStore, useAuthStore } from "@/lib/store";
import { personsApi } from "@/lib/api";
import { Person } from "@/lib/types";
import { LogIn, TreePine, Plus, Search, X } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jabot — Arbre genealogique" },
      { name: "description", content: "Votre arbre genealogique africain sur un canvas infini." },
    ],
  }),
  component: JabotCanvas,
});

const WORLD = { w: 3000, h: 2000 };

type FormState = { mode: "create" | "edit"; person?: Person | null } | null;

function JabotCanvas() {
  const navigate = useNavigate();
  const { tree, isLoading, error: treeError, loadTree, getPersonById, addPerson } = useFamilyTreeStore();
  const { isAuthenticated, onboarded, personId, logout } = useAuthStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 60 });
  const [viewport, setViewport] = useState({ w: 1200, h: 700 });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  // L'onboarding s'affiche une seule fois : connecte mais pas encore rattache.
  const showOnboarding = isAuthenticated && !onboarded;

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Si notre fiche est isolee (aucun lien), /tree l'exclut : on la recupere
  // pour que l'utilisateur retrouve toujours sa propre fiche apres connexion.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !personId) return;
    if (getPersonById(personId)) return;
    personsApi
      .getAll()
      .then((persons) => {
        const me = persons.find((p) => p.id === personId);
        if (me) addPerson(me);
      })
      .catch(() => { /* silencieux */ });
  }, [isLoading, isAuthenticated, personId, getPersonById, addPerson]);

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const update = () => setViewport({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-card]")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPan({ x: dragRef.current.panX + (e.clientX - dragRef.current.startX), y: dragRef.current.panY + (e.clientY - dragRef.current.startY) });
    };
    const onUp = () => (dragRef.current = null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 30) {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      return;
    }
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.0015;
    const next = Math.min(2.5, Math.max(0.3, zoom * (1 + delta)));
    const worldX = (mx - pan.x) / zoom;
    const worldY = (my - pan.y) / zoom;
    setPan({ x: mx - worldX * next, y: my - worldY * next });
    setZoom(next);
  };

  const zoomBy = useCallback(
    (factor: number) => {
      setZoom((z) => {
        const next = Math.min(2.5, Math.max(0.3, z * factor));
        const cx = viewport.w / 2;
        const cy = viewport.h / 2;
        const worldX = (cx - pan.x) / z;
        const worldY = (cy - pan.y) / z;
        setPan({ x: cx - worldX * next, y: cy - worldY * next });
        return next;
      });
    },
    [pan.x, pan.y, viewport.w, viewport.h],
  );

  const reset = () => { setZoom(1); setPan({ x: 80, y: 60 }); };

  const selected: Person | null = tree.persons.find((p) => p.id === selectedId) ?? null;

  const editMyCard = () => {
    const me = personId ? getPersonById(personId) : undefined;
    if (me) setForm({ mode: "edit", person: me });
  };

  const centerOnPerson = (pid: string) => {
    const p = getPersonById(pid) ?? tree.persons.find((x) => x.id === pid);
    const wx = p?.position?.x ?? 0;
    const wy = p?.position?.y ?? 0;
    setZoom(1);
    setPan({ x: viewport.w / 2 - wx - 104, y: viewport.h / 2 - wy - 50 });
    setSelectedId(pid);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-canvas text-foreground">
      {/* Header */}
      <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/85 px-5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <TreePine className="size-4" />
          </div>
          <h1 className="font-serif text-xl leading-none text-foreground">Jabot</h1>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <button
                onClick={() => setForm({ mode: "create" })}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="size-4" />
                <span className="hidden sm:block">Ajouter</span>
              </button>
              <AccountMenu onEditMyCard={editMyCard} />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen((o) => !o)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Search className="size-3.5" />
                <span className="hidden sm:block">Rechercher</span>
              </button>
              <button
                onClick={() => navigate({ to: "/auth" })}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <LogIn className="size-3.5" />
                <span className="hidden sm:block">Rejoindre</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="relative flex flex-1 overflow-hidden">
        {/* Banner visiteur */}
        {!isAuthenticated && tree.persons.length > 0 && !searchOpen && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-3">
            <div className="pointer-events-auto glass flex items-center gap-2 rounded-full border border-border px-3 py-1.5 shadow-float">
              <span className="hidden text-sm text-muted-foreground sm:block">Visiteur — parcourez librement,</span>
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Search className="size-3.5" /> Rechercher
              </button>
              <button
                onClick={() => navigate({ to: "/auth" })}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <LogIn className="size-3.5" /> Creer ma fiche
              </button>
            </div>
          </div>
        )}

        {/* Overlay recherche */}
        {searchOpen && (
          <div className="absolute inset-x-0 top-0 z-20 flex justify-center pt-3 px-4">
            <div className="glass w-full max-w-md rounded-2xl border border-border shadow-float">
              <div className="flex items-center gap-2 px-4 py-3">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un proche par nom…"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
              {searchQuery.trim().length > 0 && (
                <div className="max-h-64 overflow-y-auto border-t border-border px-2 pb-2">
                  {tree.persons
                    .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase().trim()))
                    .slice(0, 8)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { centerOnPerson(p.id); setSearchOpen(false); setSearchQuery(""); }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {p.firstName?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{p.firstName} {p.lastName}</p>
                          {p.cityOfOrigin && <p className="text-xs text-muted-foreground">{p.cityOfOrigin}</p>}
                        </div>
                      </button>
                    ))}
                  {tree.persons.filter((p) =>
                    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase().trim())
                  ).length === 0 && (
                    <p className="px-3 py-3 text-sm text-muted-foreground">Aucun résultat pour « {searchQuery} »</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onWheel={onWheel}
          onClick={(e) => { if (!(e.target as HTMLElement).closest("[data-card]")) setSelectedId(null); }}
          className="canvas-grid relative flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        >
          {/* Loading */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Chargement…</p>
              </div>
            </div>
          )}

          {/* Empty state — erreur réseau */}
          {!isLoading && tree.persons.length === 0 && treeError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="text-6xl">⚠️</div>
                <h2 className="font-serif text-2xl text-foreground">Impossible de charger l'arbre</h2>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Le serveur est momentanement inaccessible. Verifiez votre connexion et reessayez.
                </p>
                <button
                  onClick={() => loadTree()}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Reessayer
                </button>
              </div>
            </div>
          )}

          {/* Empty state — arbre vraiment vide */}
          {!isLoading && tree.persons.length === 0 && !treeError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="text-7xl">🌳</div>
                <h2 className="font-serif text-2xl text-foreground">L'arbre est encore vide</h2>
                <p className="max-w-xs text-sm text-muted-foreground">
                  {isAuthenticated
                    ? "Ajoutez des personnes pour demarrer l'arbre genealogique."
                    : "Connectez-vous pour vous ajouter et presenter votre famille."}
                </p>
                {isAuthenticated ? (
                  <button
                    onClick={() => setForm({ mode: "create" })}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Plus className="size-4" /> Ajouter une personne
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => setSearchOpen(true)}
                      className="flex w-56 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Search className="size-4" /> Rechercher un proche
                    </button>
                    <button
                      onClick={() => navigate({ to: "/auth" })}
                      className="flex w-56 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <LogIn className="size-4" /> Creer ma fiche
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* World */}
          {!isLoading && tree.persons.length > 0 && (
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
                width: WORLD.w,
                height: WORLD.h,
              }}
              className="absolute left-0 top-0"
            >
              <Connectors persons={tree.persons} relationships={tree.relationships} />
              {tree.persons.map((p) => (
                <PersonCard key={p.id} person={p} selected={p.id === selectedId} onSelect={setSelectedId} isAuthenticated={isAuthenticated} />
              ))}
            </div>
          )}

          <Toolbar zoom={zoom} onZoomIn={() => zoomBy(1.15)} onZoomOut={() => zoomBy(1 / 1.15)} onReset={reset} />

          {tree.persons.length > 0 && (
            <MiniMap
              persons={tree.persons}
              selectedId={selectedId}
              viewport={{ x: pan.x, y: pan.y, w: viewport.w, h: viewport.h, zoom }}
              worldBounds={WORLD}
            />
          )}
        </div>

        <EditPanel
          person={selected}
          allPersons={tree.persons}
          relationships={tree.relationships}
          onClose={() => setSelectedId(null)}
          onSelectPerson={setSelectedId}
          isAuthenticated={isAuthenticated}
          onEdit={(p) => setForm({ mode: "edit", person: p })}
        />
      </main>

      {showOnboarding && <OnboardingDialog onCompleted={centerOnPerson} />}
      {form && <PersonFormDialog mode={form.mode} person={form.person} onClose={() => setForm(null)} />}
    </div>
  );
}
