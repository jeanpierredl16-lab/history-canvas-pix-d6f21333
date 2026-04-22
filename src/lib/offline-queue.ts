import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { supabase, STORAGE_BUCKET, type Visita } from "@/lib/supabase";

/**
 * Offline queue for visits + their associated drawings/signatures.
 * Stored in IndexedDB so that closing the tab won't lose data.
 */

export type PendingDoc = {
  tipo: "nota_manuscrita" | "registro_antiguo" | "scanner_venoso";
  descripcion: string | null;
  /** dataURL (base64) — small enough to live in IDB */
  dataUrl: string;
};

export type PendingVisita = {
  id: string; // local uuid
  createdAt: number;
  paciente_dni: string;
  visita: Omit<Visita, "id" | "created_at" | "firma_paciente_url" | "firma_medico_url">;
  firmaPacienteDataUrl?: string | null;
  firmaMedicoDataUrl?: string | null;
  documentos?: PendingDoc[];
  /** sync state */
  status: "pending" | "syncing" | "error";
  lastError?: string;
};

interface FleboDB extends DBSchema {
  visitas: {
    key: string;
    value: PendingVisita;
  };
}

let _db: Promise<IDBPDatabase<FleboDB>> | null = null;
function getDB() {
  if (!_db) {
    _db = openDB<FleboDB>("flebo-offline", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("visitas")) {
          db.createObjectStore("visitas", { keyPath: "id" });
        }
      },
    });
  }
  return _db;
}

function uid() {
  return (crypto as any).randomUUID?.() ?? `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueVisita(
  v: Omit<PendingVisita, "id" | "createdAt" | "status">
): Promise<PendingVisita> {
  const db = await getDB();
  const item: PendingVisita = {
    ...v,
    id: uid(),
    createdAt: Date.now(),
    status: "pending",
  };
  await db.put("visitas", item);
  notify();
  return item;
}

export async function listPending(): Promise<PendingVisita[]> {
  const db = await getDB();
  const all = await db.getAll("visitas");
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function countPending(): Promise<number> {
  const db = await getDB();
  return db.count("visitas");
}

async function updateItem(item: PendingVisita) {
  const db = await getDB();
  await db.put("visitas", item);
  notify();
}

async function removeItem(id: string) {
  const db = await getDB();
  await db.delete("visitas", id);
  notify();
}

/** dataURL → Blob (used inside the worker without DOM helpers) */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function uploadDataUrlOnce(dataUrl: string, dni: string, prefix: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type.split("/")[1] || "png";
  const path = `${dni}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Try to upload one queued item. */
async function syncOne(item: PendingVisita): Promise<void> {
  item.status = "syncing";
  await updateItem(item);
  try {
    let firmaPacUrl: string | null = null;
    let firmaMedUrl: string | null = null;
    if (item.firmaPacienteDataUrl)
      firmaPacUrl = await uploadDataUrlOnce(item.firmaPacienteDataUrl, item.paciente_dni, "firma-paciente");
    if (item.firmaMedicoDataUrl)
      firmaMedUrl = await uploadDataUrlOnce(item.firmaMedicoDataUrl, item.paciente_dni, "firma-medico");

    const { error: vErr } = await supabase.from("visitas").insert({
      ...item.visita,
      firma_paciente_url: firmaPacUrl,
      firma_medico_url: firmaMedUrl,
    });
    if (vErr) throw vErr;

    if (item.documentos?.length) {
      for (const d of item.documentos) {
        const url = await uploadDataUrlOnce(d.dataUrl, item.paciente_dni, d.tipo);
        const { error: dErr } = await supabase.from("documentos_graficos").insert({
          paciente_dni: item.paciente_dni,
          tipo: d.tipo,
          url,
          descripcion: d.descripcion,
        });
        if (dErr) throw dErr;
      }
    }

    await removeItem(item.id);
  } catch (e: any) {
    item.status = "error";
    item.lastError = e?.message ?? String(e);
    await updateItem(item);
    throw e;
  }
}

let syncing = false;
export async function syncNow(): Promise<{ ok: number; failed: number }> {
  if (syncing) return { ok: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: 0, failed: 0 };
  syncing = true;
  let ok = 0;
  let failed = 0;
  try {
    const items = await listPending();
    for (const it of items) {
      try {
        await syncOne(it);
        ok++;
      } catch {
        failed++;
      }
    }
  } finally {
    syncing = false;
    notify();
  }
  return { ok, failed };
}

/* ---------- subscription ---------- */
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribeQueue(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Install global listeners that auto-sync when the network returns. */
let installed = false;
export function installAutoSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("online", () => {
    void syncNow();
  });
  // Periodic retry while online (every 60s)
  setInterval(() => {
    if (navigator.onLine) void syncNow();
  }, 60_000);
  // Initial sweep on load
  if (navigator.onLine) void syncNow();
}