import { useEffect, useRef, useState } from "react";
import { X, Download, FileImage, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Person } from "@/lib/types";
import { SurnameStat } from "@/lib/surnameColors";

interface ExportDialogProps {
  worldRef: React.RefObject<HTMLDivElement | null>;
  persons: Person[];
  surnameStats: SurnameStat[];
  surnameFilter: Set<string>;
  onClose: () => void;
}

type Format = "png" | "pdf";

export function ExportDialog({ worldRef, persons, surnameStats, surnameFilter, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<Format>("png");
  const [applyFilter, setApplyFilter] = useState(surnameFilter.size > 0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  async function doExport() {
    if (!worldRef.current) return;
    setExporting(true);
    setError(null);
    try {
      // Compute bounding box of visible (non-dimmed) persons
      const CARD_W = 208, CARD_H = 112, PADDING = 60;
      const visible = applyFilter && surnameFilter.size > 0
        ? persons.filter((p) => surnameFilter.has((p.lastName ?? "").trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[̀-ͯ]/g, "")))
        : persons;

      if (visible.length === 0) {
        setError("Aucune personne visible à exporter.");
        setExporting(false);
        return;
      }

      const xs = visible.map((p) => p.position?.x ?? 0);
      const ys = visible.map((p) => p.position?.y ?? 0);
      const minX = Math.min(...xs) - PADDING;
      const maxX = Math.max(...xs) + CARD_W + PADDING;
      const minY = Math.min(...ys) - PADDING;
      const maxY = Math.max(...ys) + CARD_H + PADDING;

      const { default: html2canvas } = await import("html2canvas");

      const canvas = await html2canvas(worldRef.current, {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#faf9f7",
        logging: false,
      });

      const filename = `jabot-arbre-${Date.now()}`;

      if (format === "png") {
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${filename}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }, "image/png");
      } else {
        const { jsPDF } = await import("jspdf");
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        const pxW = canvas.width / 2;
        const pxH = canvas.height / 2;
        // A4 landscape if wide, portrait if tall
        const landscape = pxW > pxH;
        const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "px", format: [pxW, pxH] });
        pdf.addImage(imgData, "JPEG", 0, 0, pxW, pxH);
        pdf.save(`${filename}.pdf`);
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError("L'export a échoué. Réessayez ou utilisez une capture d'écran.");
    } finally {
      setExporting(false);
    }
  }

  const hasFilter = surnameFilter.size > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div ref={dialogRef} className="w-[340px] rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Exporter l'arbre</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          Génère une image haute résolution de votre arbre généalogique.
        </p>

        {/* Format */}
        <div className="mt-4 flex gap-2">
          {(["png", "pdf"] as Format[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors",
                format === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {f === "png" ? <FileImage className="size-4" /> : <FileText className="size-4" />}
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Filter option */}
        {hasFilter && (
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-border px-3 py-2.5">
            <input
              type="checkbox"
              checked={applyFilter}
              onChange={(e) => setApplyFilter(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-xs text-foreground">
              Exporter uniquement les noms filtrés
              <span className="ml-1 text-muted-foreground">({surnameFilter.size} nom{surnameFilter.size > 1 ? "s" : ""})</span>
            </span>
          </label>
        )}

        {error && (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        )}

        <button
          onClick={doExport}
          disabled={exporting}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <Download className="size-4" />
          {exporting ? "Export en cours…" : `Télécharger en ${format.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
}
