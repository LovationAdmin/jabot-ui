import { useEffect, useRef, useState } from "react";
import { Pencil, Check, Trees } from "lucide-react";
import { cn } from "@/lib/utils";
import { TreeComponent } from "@/lib/treeComponents";

interface TreeTabsProps {
  components: TreeComponent[];
  activeId: string;
  getTabName: (id: string, defaultName: string) => string;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

/**
 * Barre d'onglets horizontale — une tab par composante connexe.
 * Affiché uniquement si l'arbre contient 2+ composantes disconnectées.
 * Double-clic ou crayon pour renommer inline.
 */
export function TreeTabs({ components, activeId, getTabName, onSelect, onRename }: TreeTabsProps) {
  if (components.length <= 1) return null;

  return (
    <div className="z-20 flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-card/85 px-3 backdrop-blur-md">
      <Trees className="size-3.5 shrink-0 text-muted-foreground" />
      {components.map((c) => (
        <Tab
          key={c.id}
          component={c}
          active={c.id === activeId}
          name={getTabName(c.id, c.defaultName)}
          onSelect={() => onSelect(c.id)}
          onRename={(name) => onRename(c.id, name)}
        />
      ))}
    </div>
  );
}

// ── Tab ────────────────────────────────────────────────────────────

interface TabProps {
  component: TreeComponent;
  active: boolean;
  name: string;
  onSelect: () => void;
  onRename: (name: string) => void;
}

function Tab({ component, active, name, onSelect, onRename }: TabProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft si le nom externe change (ex : rechargement)
  useEffect(() => { if (!editing) setDraft(name); }, [name, editing]);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    setEditing(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setDraft(name); setEditing(false); }
  }

  return (
    <div
      onClick={!editing ? onSelect : undefined}
      onDoubleClick={startEdit}
      className={cn(
        "group flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors select-none",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="text-[10px] opacity-60">{component.personIds.size}</span>

      {editing ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKey}
            onClick={(e) => e.stopPropagation()}
            className="w-28 min-w-0 bg-transparent outline-none"
            maxLength={40}
          />
          <button
            onMouseDown={(e) => { e.preventDefault(); commit(); }}
            className="opacity-80 hover:opacity-100"
          >
            <Check className="size-3" />
          </button>
        </>
      ) : (
        <>
          <span className="max-w-[120px] truncate">{name}</span>
          <button
            onClick={startEdit}
            title="Renommer"
            className={cn(
              "opacity-0 transition-opacity group-hover:opacity-70 hover:!opacity-100",
              active && "opacity-50",
            )}
          >
            <Pencil className="size-2.5" />
          </button>
        </>
      )}
    </div>
  );
}
