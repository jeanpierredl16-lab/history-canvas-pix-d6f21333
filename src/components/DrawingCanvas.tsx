import { useRef, useEffect, useState } from "react";
import { draftStore } from "@/lib/drafts";

type DrawingCanvasProps = {
  width?: number;
  height?: number;
  backgroundImage?: string;
  showColorTools?: boolean;
  /** Clave única para autoguardar el dibujo en localStorage (p.ej. dni+contexto). */
  draftKey?: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
};

export function DrawingCanvas({
  width = 900,
  height = 1100,
  backgroundImage,
  showColorTools = false,
  draftKey,
  onSave,
  onCancel,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState<string>(
    showColorTools ? "oklch(0.5 0.2 240)" : "#0a0a0a"
  );
  const [lineWidth, setLineWidth] = useState(showColorTools ? 2.5 : 2);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const autosaveT = useRef<number | null>(null);

  useEffect(() => {
    if (!backgroundImage || !bgCanvasRef.current) return;
    const ctx = bgCanvasRef.current.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, width, height);
      // Cover-fit the image
      const ratio = Math.min(width / img.width, height / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = (width - w) / 2;
      const y = (height - h) / 2;
      ctx.drawImage(img, x, y, w, h);
    };
    img.src = backgroundImage;
  }, [backgroundImage, width, height]);

  // Restaurar trazo persistido al montar
  useEffect(() => {
    if (!draftKey) return;
    const saved = draftStore.get(`flebo:draft:canvas:${draftKey}`);
    if (!saved || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, width, height);
    img.src = saved;
  }, [draftKey, width, height]);

  function persistDraft() {
    if (!draftKey || !canvasRef.current) return;
    if (autosaveT.current) window.clearTimeout(autosaveT.current);
    autosaveT.current = window.setTimeout(() => {
      try {
        draftStore.set(
          `flebo:draft:canvas:${draftKey}`,
          canvasRef.current!.toDataURL("image/png")
        );
      } catch {
        /* quota */
      }
    }, 600);
  }

  function getPoint(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * width,
      y: ((e.clientY - rect.top) / rect.height) * height,
    };
  }

  function start(e: React.PointerEvent) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPoint.current = getPoint(e);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = getPoint(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPoint.current!.x, lastPoint.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
  }
  function end() {
    drawing.current = false;
    lastPoint.current = null;
    persistDraft();
  }

  function clear() {
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.clearRect(0, 0, width, height);
    if (draftKey) draftStore.remove(`flebo:draft:canvas:${draftKey}`);
  }

  function save() {
    // Merge bg + drawing into one canvas
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    if (bgCanvasRef.current) ctx.drawImage(bgCanvasRef.current, 0, 0);
    if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0);
    if (draftKey) draftStore.remove(`flebo:draft:canvas:${draftKey}`);
    onSave(out.toDataURL("image/png"));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {showColorTools && (
          <>
            <button
              type="button"
              onClick={() => setColor("oklch(0.5 0.2 240)")}
              className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-medium transition ${
                color.includes("240")
                  ? "border-medical-blue bg-medical-blue/10"
                  : "border-border bg-card"
              }`}
            >
              <span className="h-4 w-4 rounded-full bg-medical-blue" />
              Várices (azul)
            </button>
            <button
              type="button"
              onClick={() => setColor("oklch(0.55 0.24 25)")}
              className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-medium transition ${
                color.includes("25")
                  ? "border-medical-red bg-medical-red/10"
                  : "border-border bg-card"
              }`}
            >
              <span className="h-4 w-4 rounded-full bg-medical-red" />
              Trombos (rojo)
            </button>
          </>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          Grosor
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={clear}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          Limpiar
        </button>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-2xl border-2 border-border bg-white shadow-inner select-none touch-none"
        style={{ aspectRatio: `${width}/${height}` }}
      >
        {backgroundImage && (
          <canvas
            ref={bgCanvasRef}
            width={width}
            height={height}
            className="absolute inset-0 h-full w-full select-none"
          />
        )}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="relative h-full w-full touch-none select-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border bg-card px-6 py-3 font-medium hover:bg-secondary"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
