import { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

type SignaturePadProps = {
  label: string;
  onSave: (dataUrl: string | null) => void;
  value?: string | null;
};

export function SignaturePad({ label, onSave, value }: SignaturePadProps) {
  const ref = useRef<SignatureCanvas>(null);

  function clear() {
    ref.current?.clear();
    onSave(null);
  }

  function commit() {
    if (!ref.current || ref.current.isEmpty()) {
      onSave(null);
      return;
    }
    onSave(ref.current.toDataURL("image/png"));
  }

  if (value) {
    return (
      <div className="flex flex-col gap-2 select-none">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className="rounded-xl border-2 border-success/40 bg-white p-2 select-none touch-none">
          <img src={value} alt={label} className="h-32 w-full object-contain select-none" draggable={false} />
        </div>
        <button
          type="button"
          onClick={() => onSave(null)}
          className="self-end text-xs text-muted-foreground underline"
        >
          Volver a firmar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 select-none">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="rounded-xl border-2 border-dashed border-border bg-white select-none touch-none">
        <SignatureCanvas
          ref={ref}
          penColor="#0a0a0a"
          canvasProps={{
            className: "w-full h-32 rounded-xl touch-none select-none",
          }}
          onEnd={commit}
        />
      </div>
      <button
        type="button"
        onClick={clear}
        className="self-end text-xs text-muted-foreground underline"
      >
        Limpiar
      </button>
    </div>
  );
}
