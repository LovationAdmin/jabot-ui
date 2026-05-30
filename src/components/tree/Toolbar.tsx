import { Minus, Plus, Maximize2 } from "lucide-react";

interface ToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function Toolbar({ zoom, onZoomIn, onZoomOut, onReset }: ToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/90 px-3 py-2 shadow-float backdrop-blur-md">
        <Btn onClick={onZoomOut} title="Zoom arrière">
          <Minus className="size-3.5" />
        </Btn>
        <button
          onClick={onReset}
          title="Recentrer (100%)"
          className="min-w-[3.5rem] rounded-full px-2 py-1 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Btn onClick={onZoomIn} title="Zoom avant">
          <Plus className="size-3.5" />
        </Btn>
        <span className="mx-1 h-4 w-px bg-border" />
        <Btn onClick={onReset} title="Recentrer">
          <Maximize2 className="size-3.5" />
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
      className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
