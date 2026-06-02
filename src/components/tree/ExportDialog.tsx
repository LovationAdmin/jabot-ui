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

/** Draw the SVG connector layer onto a canvas element and return it. */
async function rasterizeSvg(svgEl: SVGSVGElement): Promise<HTMLCanvasElement> {
  const w = svgEl.width.baseVal.value || parseInt(svgEl.getAttribute("width") ?? "3000");
  const h = svgEl.height.baseVal.value || parseInt(svgEl.getAttribute("height") ?? "2000");

  // Clone and fix context-stroke markers (not supported in standalone SVG images)
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll<SVGPathElement>('[fill="inherit"]').forEach((el) =>
    el.setAttribute("fill", "rgba(80,60,120,0.55)")
  );
  // Ensure the clone has explicit dimensions
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));

  const svgStr = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = url;
  });
  URL.revokeObjectURL(url);

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return c;
}

/** Add a dot-grid background + composite the captured content on top. */
function compositeWithBackground(
  src: HTMLCanvasElement,
  offsetX: number,
  offsetY: number,
): HTMLCanvasElement {
  const scale = 2; // matches html2canvas scale
  const dotRadius = 0.8 * scale;
  const gridStep = 30 * scale;

  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d")!;

  // Background
  ctx.fillStyle = "hsl(270, 18%, 97%)";
  ctx.fillRect(0, 0, out.width, out.height);

  // Dot grid (origin aligned to the world's 0,0 minus the crop offset)
  ctx.fillStyle = "hsla(267, 30%, 46%, 0.13)";
  const startX = ((-offsetX * scale) % gridStep + gridStep) % gridStep;
  const startY = ((-offsetY * scale) % gridStep + gridStep) % gridStep;
  for (let x = startX - gridStep; x <= out.width; x += gridStep) {
    for (let y = startY - gridStep; y <= out.height; y += gridStep) {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Cards + connectors on top
  ctx.drawImage(src, 0, 0);
  return out;
}

export function ExportDialog({ worldRef, persons, surnameStats, surnameFilter, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<Format>("png");
  const [applyFilter, setApplyFilter] = useState(surnameFilter.size > 0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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
      const CARD_W = 208, CARD_H = 112, PADDING = 80;
      const visible = applyFilter && surnameFilter.size > 0
        ? persons.filter((p) =>
            surnameFilter.has(
              (p.lastName ?? "").trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[̀-ͯ]/g, "")
            )
          )
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

      const el = worldRef.current;
      const savedTransform = el.style.transform;
      el.style.transform = "none";

      // Hide dimmed cards when filter is active
      const hiddenEls: HTMLElement[] = [];
      if (applyFilter && surnameFilter.size > 0) {
        const visibleIds = new Set(visible.map((p) => p.id));
        el.querySelectorAll<HTMLElement>("[data-person-id]").forEach((node) => {
          if (!visibleIds.has(node.dataset.personId!)) {
            node.style.visibility = "hidden";
            hiddenEls.push(node);
          }
        });
      }

      // Rasterize the SVG connector layer so html2canvas can include it
      const svgEl = el.querySelector<SVGSVGElement>("svg");
      let svgCanvas: HTMLCanvasElement | null = null;
      if (svgEl) {
        try {
          svgCanvas = await rasterizeSvg(svgEl);
          // Give the canvas the same CSS position as the SVG
          svgCanvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;";
          svgEl.replaceWith(svgCanvas);
        } catch {
          // If rasterization fails, proceed without connectors
        }
      }

      let raw: HTMLCanvasElement;
      try {
        raw = await html2canvas(el, {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          scale: 2,
          useCORS: true,
          allowTaint: false,
          imageTimeout: 8000,
          backgroundColor: null, // we handle the background ourselves
          logging: false,
        });
      } finally {
        el.style.transform = savedTransform;
        hiddenEls.forEach((n) => (n.style.visibility = ""));
        if (svgCanvas && svgEl) svgCanvas.replaceWith(svgEl);
      }

      // Add dot-grid background and composite
      const canvas = compositeWithBackground(raw, minX, minY);

      const filename = `jabot-arbre-${new Date().toISOString().slice(0, 10)}`;

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
        const landscape = pxW > pxH;
        const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "px", format: [pxW, pxH] });
        pdf.addImage(imgData, "JPEG", 0, 0, pxW, pxH);
        pdf.save(`${filename}.pdf`);
      }
      onClose();
    } catch (err) {
      console.error("[Export]", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Export échoué : ${msg}`);
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
          Image haute résolution avec le fond et les traits de parenté.
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

        {hasFilter && (
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-border px-3 py-2.5">
            <input
              type="checkbox"
              checked={applyFilter}
              onChange={(e) => setApplyFilter(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-xs text-foreground">
              Noms filtrés uniquement
              <span className="ml-1 text-muted-foreground">({surnameFilter.size} nom{surnameFilter.size > 1 ? "s" : ""})</span>
            </span>
          </label>
        )}

        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

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
