import { Minus, Plus, Maximize2 } from "lucide-react";

interface ToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenterSelf: () => void;
  onFitAll: () => void;
}

export function Toolbar({ zoom, onZoomIn, onZoomOut, onCenterSelf, onFitAll }: ToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-2 shadow-float">
        <Btn onClick={onZoomOut} title="Zoom arrière">
          <Minus className="size-4" />
        </Btn>
        <button
          onClick={onCenterSelf}
          title="Recentrer sur ma fiche"
          className="min-w-[3.5rem] rounded-full px-2 py-1 text-center text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Btn onClick={onZoomIn} title="Zoom avant">
          <Plus className="size-4" />
        </Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn onClick={onFitAll} title="Voir tout l'arbre">
          <Maximize2 className="size-4" />
        </Btn>
      </div>
    </div>
  );
}

function Btn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
