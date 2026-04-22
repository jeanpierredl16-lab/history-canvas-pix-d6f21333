import { useEffect, useState } from "react";
import { countPending, listPending, subscribeQueue, syncNow } from "@/lib/offline-queue";

export function SyncBadge() {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Awaited<ReturnType<typeof listPending>>>([]);

  async function refresh() {
    setCount(await countPending());
    if (open) setItems(await listPending());
  }

  useEffect(() => {
    refresh();
    const unsub = subscribeQueue(refresh);
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => {
      unsub();
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function forzarSync() {
    setBusy(true);
    await syncNow();
    setBusy(false);
  }

  if (count === 0 && online) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        {!online && (
          <div className="rounded-full bg-warning/90 px-4 py-2 text-xs font-semibold text-warning-foreground shadow-lg">
            ● Sin conexión — los registros se guardan localmente
          </div>
        )}
        {count > 0 && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium shadow-lg ring-1 ring-border hover:bg-secondary"
          >
            <span className="flex h-2.5 w-2.5 rounded-full bg-warning animate-pulse" />
            {count} pendiente{count > 1 ? "s" : ""} de sincronizar
          </button>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Cola de sincronización</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              {online
                ? "Conectado. Puedes forzar la subida ahora o esperar a que el proceso automático lo haga."
                : "Sin conexión. Los registros se subirán automáticamente cuando vuelva el internet."}
            </p>

            <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {items.length === 0 && (
                <li className="rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">
                  No hay registros pendientes.
                </li>
              )}
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      DNI {it.paciente_dni} · {it.visita.tipo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(it.createdAt).toLocaleString("es-PE")}
                      {it.documentos?.length
                        ? ` · ${it.documentos.length} doc${it.documentos.length > 1 ? "s" : ""}`
                        : ""}
                    </p>
                    {it.status === "error" && (
                      <p className="mt-1 text-xs text-destructive">
                        Error: {it.lastError}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                      it.status === "syncing"
                        ? "bg-primary/15 text-primary"
                        : it.status === "error"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-warning/20 text-warning-foreground"
                    }`}
                  >
                    {it.status === "syncing"
                      ? "Subiendo"
                      : it.status === "error"
                        ? "Reintentar"
                        : "Pendiente"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Cerrar
              </button>
              <button
                onClick={forzarSync}
                disabled={!online || busy || count === 0}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow disabled:opacity-50"
              >
                {busy ? "Sincronizando…" : "Sincronizar ahora"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}