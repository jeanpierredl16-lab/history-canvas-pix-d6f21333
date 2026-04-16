import { useEffect, useRef, useState } from "react";
import { supabase, type DocumentoGrafico, type Paciente, type Visita } from "@/lib/supabase";
import { uploadDataUrl, uploadFile } from "@/lib/upload";
import { DrawingCanvas } from "./DrawingCanvas";
import { SignaturePad } from "./SignaturePad";
import legMap from "@/assets/leg-veins-map.png";

const TARIFA = 170;

const TRATAMIENTOS = ["Escleroterapia", "Trombectomía", "Control", "Consulta"];

const CONSENT_TEXT = `Yo, el/la paciente, declaro haber sido informado(a) de los procedimientos a realizarse en la clínica Flebo Perú, sus beneficios, riesgos y alternativas. Autorizo voluntariamente el tratamiento descrito y la conservación digital de mis datos clínicos, fotografías y documentos asociados, los cuales serán tratados con confidencialidad conforme a la Ley de Protección de Datos Personales del Perú (Ley N° 29733).`;

type Props = {
  paciente: Paciente;
  onChangePaciente: () => void;
};

type Modal = null | "nota" | "scanner";

export function PatientDashboard({ paciente, onChangePaciente }: Props) {
  const [tab, setTab] = useState<"evolucion" | "tratamiento">("evolucion");
  const [docs, setDocs] = useState<DocumentoGrafico[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // Tratamiento state
  const [tipo, setTipo] = useState<string>("Escleroterapia");
  const [monto, setMonto] = useState<string>("");
  const [notas, setNotas] = useState<string>("");
  const [firmaPac, setFirmaPac] = useState<string | null>(null);
  const [firmaMed, setFirmaMed] = useState<string | null>(null);
  const [aceptaConsent, setAceptaConsent] = useState(false);
  const [savingVisita, setSavingVisita] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const [d, v] = await Promise.all([
      supabase
        .from("documentos_graficos")
        .select("*")
        .eq("paciente_dni", paciente.dni)
        .order("created_at", { ascending: false }),
      supabase
        .from("visitas")
        .select("*")
        .eq("paciente_dni", paciente.dni)
        .order("created_at", { ascending: false }),
    ]);
    if (d.data) setDocs(d.data as DocumentoGrafico[]);
    if (v.data) setVisitas(v.data as Visita[]);
  }

  useEffect(() => {
    load();
  }, [paciente.dni]);

  async function saveDoc(
    dataUrlOrFile: string | File,
    tipoDoc: DocumentoGrafico["tipo"],
    descripcion: string
  ) {
    setBusy(true);
    try {
      const url =
        typeof dataUrlOrFile === "string"
          ? await uploadDataUrl(dataUrlOrFile, paciente.dni, tipoDoc)
          : await uploadFile(dataUrlOrFile, paciente.dni, tipoDoc);
      const { error } = await supabase.from("documentos_graficos").insert({
        paciente_dni: paciente.dni,
        tipo: tipoDoc,
        url,
        descripcion,
      });
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert("Error al guardar: " + e.message);
    } finally {
      setBusy(false);
      setModal(null);
    }
  }

  async function onPickPhotos(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const url = await uploadFile(f, paciente.dni, "registro_antiguo");
        await supabase.from("documentos_graficos").insert({
          paciente_dni: paciente.dni,
          tipo: "registro_antiguo",
          url,
          descripcion: "Registro antiguo (papel)",
        });
      }
      await load();
    } catch (e: any) {
      alert("Error subiendo fotos: " + e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function guardarVisita() {
    setMsg(null);
    if (!monto || isNaN(+monto)) {
      setMsg("Ingresa un monto válido");
      return;
    }
    if (!aceptaConsent) {
      setMsg("El paciente debe aceptar el consentimiento");
      return;
    }
    setSavingVisita(true);
    try {
      const montoNum = +monto;
      const escleros = +(montoNum / TARIFA).toFixed(2);
      let firmaPacUrl: string | null = null;
      let firmaMedUrl: string | null = null;
      if (firmaPac)
        firmaPacUrl = await uploadDataUrl(firmaPac, paciente.dni, "firma-paciente");
      if (firmaMed)
        firmaMedUrl = await uploadDataUrl(firmaMed, paciente.dni, "firma-medico");

      const { error } = await supabase.from("visitas").insert({
        paciente_dni: paciente.dni,
        tipo,
        monto_pagado: montoNum,
        escleros_hoy: escleros,
        notas: notas || null,
        firma_paciente_url: firmaPacUrl,
        firma_medico_url: firmaMedUrl,
      });
      if (error) throw error;
      setMsg("✓ Visita registrada");
      setMonto("");
      setNotas("");
      setFirmaPac(null);
      setFirmaMed(null);
      setAceptaConsent(false);
      await load();
    } catch (e: any) {
      setMsg("Error: " + e.message);
    } finally {
      setSavingVisita(false);
    }
  }

  const equivalencia = monto && !isNaN(+monto) ? (+monto / TARIFA).toFixed(2) : "0";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Patient header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-card p-6 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Paciente
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {paciente.nombre}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            DNI {paciente.dni}
            {paciente.edad ? ` · ${paciente.edad} años` : ""}
            {paciente.sexo ? ` · ${paciente.sexo}` : ""}
            {paciente.celular ? ` · ${paciente.celular}` : ""}
          </p>
        </div>
        <button
          onClick={onChangePaciente}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          Cambiar paciente
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 rounded-full bg-secondary p-1.5 w-fit">
        {([
          ["evolucion", "Evolución & Documentos"],
          ["tratamiento", "Tratamiento & Caja"],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
              tab === k
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "evolucion" && (
        <div className="space-y-6">
          {/* Action buttons */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <ActionCard
              title="Nueva Nota a Mano"
              desc="Escribe con el lápiz en un lienzo blanco"
              onClick={() => setModal("nota")}
              icon="✍️"
            />
            <ActionCard
              title="Digitalizar Historia Física"
              desc="Toma foto a hojas antiguas de papel"
              onClick={() => fileRef.current?.click()}
              icon="📷"
              loading={busy}
            />
            <ActionCard
              title="Scanner Venoso"
              desc="Mapa de piernas — várices y trombos"
              onClick={() => setModal("scanner")}
              icon="🦵"
            />
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => onPickPhotos(e.target.files)}
          />

          {/* Documents history */}
          <div className="rounded-3xl bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Historial de documentos</h2>
            {docs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aún no hay documentos. Crea una nota o digitaliza una historia.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {docs.map((d) => (
                  <a
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative overflow-hidden rounded-xl border border-border bg-white"
                  >
                    <img
                      src={d.url}
                      alt={d.descripcion ?? d.tipo}
                      className="aspect-[3/4] w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-xs font-medium text-white">
                      {tipoLabel(d.tipo)}
                      <br />
                      <span className="text-[10px] opacity-80">
                        {new Date(d.created_at!).toLocaleDateString("es-PE")}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Visit history */}
          <div className="rounded-3xl bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Visitas anteriores</h2>
            {visitas.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin visitas registradas.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {visitas.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="font-medium">{v.tipo}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.created_at!).toLocaleString("es-PE")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">S/ {v.monto_pagado}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.escleros_hoy} sesiones
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "tratamiento" && (
        <div className="space-y-6 rounded-3xl bg-card p-6 shadow-sm md:p-8">
          <div>
            <h2 className="text-lg font-semibold">Tratamiento de hoy</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {TRATAMIENTOS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`rounded-full border-2 px-5 py-3 text-sm font-medium transition ${
                    tipo === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">
                Monto pagado (S/)
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-2xl font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div className="flex flex-col justify-end gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">
                Equivale a (S/ {TARIFA} c/u)
              </span>
              <div className="rounded-xl bg-accent/40 px-4 py-3 text-2xl font-semibold text-accent-foreground">
                {equivalencia} sesiones
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">
              Notas del tratamiento
            </span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Consentimiento informado
            </h3>
            <div className="mt-2 max-h-32 overflow-y-auto rounded-xl border border-border bg-secondary/50 p-4 text-sm leading-relaxed text-muted-foreground">
              {CONSENT_TEXT}
            </div>
            <label className="mt-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={aceptaConsent}
                onChange={(e) => setAceptaConsent(e.target.checked)}
                className="h-5 w-5 rounded"
              />
              <span className="text-sm font-medium">
                El paciente acepta los términos y condiciones
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SignaturePad
              label="Firma del paciente"
              value={firmaPac}
              onSave={setFirmaPac}
            />
            <SignaturePad
              label="Firma del médico"
              value={firmaMed}
              onSave={setFirmaMed}
            />
          </div>

          {msg && (
            <p
              className={`rounded-lg p-3 text-sm ${
                msg.startsWith("✓")
                  ? "bg-success/15 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {msg}
            </p>
          )}

          <button
            onClick={guardarVisita}
            disabled={savingVisita}
            className="w-full rounded-full bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50"
          >
            {savingVisita ? "Guardando…" : "Registrar visita"}
          </button>
        </div>
      )}

      {/* Modals */}
      {modal === "nota" && (
        <Modal title="Nota manuscrita" onClose={() => setModal(null)}>
          <DrawingCanvas
            width={900}
            height={1100}
            onCancel={() => setModal(null)}
            onSave={(d) => saveDoc(d, "nota_manuscrita", "Nota a mano")}
          />
        </Modal>
      )}
      {modal === "scanner" && (
        <Modal title="Scanner venoso" onClose={() => setModal(null)}>
          <DrawingCanvas
            width={768}
            height={1024}
            backgroundImage={legMap}
            showColorTools
            onCancel={() => setModal(null)}
            onSave={(d) => saveDoc(d, "scanner_venoso", "Mapa venoso")}
          />
        </Modal>
      )}
    </div>
  );
}

function tipoLabel(t: DocumentoGrafico["tipo"]) {
  if (t === "nota_manuscrita") return "Nota manuscrita";
  if (t === "registro_antiguo") return "Registro antiguo";
  return "Scanner venoso";
}

function ActionCard({
  title,
  desc,
  icon,
  onClick,
  loading,
}: {
  title: string;
  desc: string;
  icon: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="group flex flex-col items-start gap-2 rounded-3xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md disabled:opacity-50"
    >
      <span className="text-3xl">{icon}</span>
      <span className="text-base font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground">
        {loading ? "Subiendo…" : desc}
      </span>
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
