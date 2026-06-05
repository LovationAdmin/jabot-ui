import { Maximize2, Download, LocateFixed } from "lucide-react";

interface ToolbarProps {
  onCenterSelf: () => void;
  onFitAll: () => void;
  onExport?: () => void;
}

export function Toolbar({ onCenterSelf, onFitAll, onExport }: ToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-2 shadow-float">
        <Btn onClick={onCenterSelf} title="Recentrer sur ma fiche">
          <LocateFixed className="size-4" />
        </Btn>
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn onClick={onFitAll} title="Voir tout l'arbre">
          <Maximize2 className="size-4" />
        </Btn>
        {onExport && (
          <>
            <span className="mx-1 h-5 w-px bg-border" />
            <Btn onClick={onExport} title="Exporter l'arbre (PNG / PDF)">
              <Download className="size-4" />
            </Btn>
          </>
        )}
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
