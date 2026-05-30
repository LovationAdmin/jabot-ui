import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Connectors } from "@/components/tree/Connectors";
import { PersonCard } from "@/components/tree/PersonCard";
import { EditPanel } from "@/components/tree/EditPanel";
import { Toolbar } from "@/components/tree/Toolbar";
import { MiniMap } from "@/components/tree/MiniMap";
import { useFamilyTreeStore, useAuthStore } from "@/lib/store";
import { Person } from "@/lib/types";
import { LogIn, Plus, TreePine } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jabot — Arbre généalogique" },
      { name: "description", content: "Votre arbre généalogique africain sur un canvas infini." },
    ],
  }),
  component: JabotCanvas,
});

const WORLD = { w: 3000, h: 2000 };

function JabotCanvas() {
  const navigate = useNavigate();
  const { tree, isLoading, loadTree } = useFamilyTreeStore();
  const { isAuthenticated, phone, logout } = useAuthStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 60 });
  const [viewport, setViewport] = useState({ w: 1200, h: 700 });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

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
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-muted-foreground sm:block">{phone}</span>
              <button
                className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                onClick={() => { /* TODO: add person dialog */ }}
              >
                <Plus className="size-3.5" />
                Ajouter
              </button>
              <button
                onClick={logout}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate({ to: "/auth" })}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogIn className="size-3.5" />
              Se connecter
            </button>
          )}
        </div>
      </header>

      <main className="relative flex flex-1 overflow-hidden">
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

          {/* Empty state */}
          {!isLoading && tree.persons.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="text-7xl">🌳</div>
                <h2 className="font-serif text-2xl text-foreground">Commencez votre arbre</h2>
                <p className="max-w-xs text-sm text-muted-foreground">
                  {isAuthenticated
                    ? "Ajoutez votre première personne pour démarrer votre arbre généalogique."
                    : "Connectez-vous pour créer et modifier votre arbre généalogique."}
                </p>
                {isAuthenticated ? (
                  <button className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                    <Plus className="size-4" /> Ajouter une personne
                  </button>
                ) : (
                  <button
                    onClick={() => navigate({ to: "/auth" })}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <LogIn className="size-4" /> Se connecter
                  </button>
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
                <PersonCard key={p.id} person={p} selected={p.id === selectedId} onSelect={setSelectedId} />
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

        <EditPanel person={selected} onClose={() => setSelectedId(null)} isAuthenticated={isAuthenticated} />
      </main>
    </div>
  );
}
