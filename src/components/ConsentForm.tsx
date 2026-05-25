import { useMemo, useState } from "react";
import type { Paciente, Visita } from "@/lib/supabase";
import { uploadDataUrl } from "@/services/fileService";
import { visitService } from "@/services/visitService";
import { SignaturePad } from "./SignaturePad";
import { useDraft, isOffline } from "@/lib/drafts";
import { generateConsentimientoPdf } from "@/lib/pdf";

type Props = {
  paciente: Paciente;
  onSaved: (v: Visita) => void;
};

type Medico = { id: string; nombre: string; cmp: string; rne: string };

const MEDICOS: Medico[] = [
  {
    id: "evelyn",
    nombre: "Dra. Evelyn Yngrid Gamarra Flores",
    cmp: "045045",
    rne: "050936",
  },
  { id: "otro", nombre: "Otro (editar manualmente)", cmp: "", rne: "" },
];

export function ConsentForm({ paciente, onSaved }: Props) {
  const draftKey = `flebo:draft:consent:${paciente.dni}`;
  type Draft = {
    firmaPaciente: string | null;
    firmaMedico: string | null;
    firmaFamiliar: string | null;
    requiereFamiliar: boolean;
    dniFamiliar: string;
    medicoId: string;
    medicoNombre: string;
    medicoCmp: string;
    medicoRne: string;
  };
  const [draft, setDraft, clearDraft] = useDraft<Draft>(draftKey, {
    firmaPaciente: null,
    firmaMedico: null,
    firmaFamiliar: null,
    requiereFamiliar: false,
    dniFamiliar: "",
    medicoId: MEDICOS[0].id,
    medicoNombre: MEDICOS[0].nombre,
    medicoCmp: MEDICOS[0].cmp,
    medicoRne: MEDICOS[0].rne,
  });
  const firmaPaciente = draft.firmaPaciente;
  const firmaMedico = draft.firmaMedico;
  const firmaFamiliar = draft.firmaFamiliar;
  const requiereFamiliar = draft.requiereFamiliar;
  const dniFamiliar = draft.dniFamiliar;
  const medicoId = draft.medicoId;
  const medicoNombre = draft.medicoNombre;
  const medicoCmp = draft.medicoCmp;
  const medicoRne = draft.medicoRne;
  const setFirmaPaciente = (v: string | null) => setDraft((d) => ({ ...d, firmaPaciente: v }));
  const setFirmaMedico = (v: string | null) => setDraft((d) => ({ ...d, firmaMedico: v }));
  const setFirmaFamiliar = (v: string | null) => setDraft((d) => ({ ...d, firmaFamiliar: v }));
  const setRequiereFamiliar = (fn: (v: boolean) => boolean) =>
    setDraft((d) => ({ ...d, requiereFamiliar: fn(d.requiereFamiliar) }));
  const setDniFamiliar = (v: string) => setDraft((d) => ({ ...d, dniFamiliar: v }));
  const setMedicoNombre = (v: string) => setDraft((d) => ({ ...d, medicoNombre: v }));
  const setMedicoCmp = (v: string) => setDraft((d) => ({ ...d, medicoCmp: v }));
  const setMedicoRne = (v: string) => setDraft((d) => ({ ...d, medicoRne: v }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Visita | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  function selectMedico(id: string) {
    const m = MEDICOS.find((x) => x.id === id);
    setDraft((d) => ({
      ...d,
      medicoId: id,
      medicoNombre: m && id !== "otro" ? m.nombre : "",
      medicoCmp: m && id !== "otro" ? m.cmp : "",
      medicoRne: m && id !== "otro" ? m.rne : "",
    }));
  }

  const valido = useMemo(() => {
    if (!firmaPaciente || !firmaMedico) return false;
    if (!medicoNombre.trim() || !medicoCmp.trim() || !medicoRne.trim()) return false;
    if (requiereFamiliar) {
      if (!firmaFamiliar) return false;
      if (!/^\d{8}$/.test(dniFamiliar.trim())) return false;
    }
    return true;
  }, [firmaPaciente, firmaMedico, requiereFamiliar, firmaFamiliar, dniFamiliar, medicoNombre, medicoCmp, medicoRne]);

  async function registrar() {
    setError(null);
    if (!valido) {
      setError("Faltan firmas o datos obligatorios.");
      return;
    }
    if (isOffline()) {
      alert(
        "Sin conexión. El consentimiento queda guardado en la tablet. Reintenta el envío cuando vuelva la señal."
      );
      return;
    }
    setSaving(true);
    try {
      const [urlPac, urlMed, urlFam] = await Promise.all([
        uploadDataUrl(firmaPaciente!, paciente.dni, "firma-paciente"),
        uploadDataUrl(firmaMedico!, paciente.dni, "firma-medico"),
        requiereFamiliar && firmaFamiliar
          ? uploadDataUrl(firmaFamiliar, paciente.dni, "firma-familiar")
          : Promise.resolve(null as unknown as string),
      ]);

      const payload: any = {
        paciente_dni: paciente.dni,
        tipo: "Consentimiento Escleroterapia",
        monto_pagado: 0,
        escleros_hoy: 0,
        notas: `Consentimiento informado firmado — Médico: ${medicoNombre} (CMP ${medicoCmp} / RNE ${medicoRne})`,
        medico_nombre: medicoNombre,
        medico_cmp: medicoCmp,
        medico_rne: medicoRne,
        firma_paciente_url: urlPac,
        firma_medico_url: urlMed,
        firma_familiar_url: requiereFamiliar ? urlFam : null,
        dni_familiar: requiereFamiliar ? dniFamiliar.trim() : null,
        acepta_terminos: true,
        created_at: new Date().toISOString(),
      };

      const data = await visitService.create(payload);
      clearDraft();
      setSaved(data);
      onSaved(data);
    } catch (e: any) {
      const msg = e?.message ?? "Error al registrar";
      setError(
        /network|fetch|failed/i.test(msg)
          ? "Sin conexión estable. El avance quedó guardado en la tablet."
          : msg
      );
    } finally {
      setSaving(false);
    }
  }

  async function descargarPdf() {
    setPdfBusy(true);
    try {
      await generateConsentimientoPdf({
        paciente,
        medicoNombre,
        medicoCmp,
        medicoRne,
        firmaPacienteUrl: saved?.firma_paciente_url ?? firmaPaciente!,
        firmaMedicoUrl: saved?.firma_medico_url ?? firmaMedico!,
        firmaFamiliarUrl:
          (saved as any)?.firma_familiar_url ?? (requiereFamiliar ? firmaFamiliar : null),
        dniFamiliar: requiereFamiliar ? dniFamiliar : null,
        fecha: saved?.created_at ?? new Date().toISOString(),
      });
    } catch (e: any) {
      alert("No se pudo generar el PDF: " + (e?.message ?? "error desconocido"));
    } finally {
      setPdfBusy(false);
    }
  }

  if (saved) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border-2 border-success/40 bg-success/10 p-5 text-center">
          <p className="text-3xl">✓</p>
          <p className="mt-2 text-lg font-semibold text-success">Documento Firmado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Registrado el {new Date(saved.created_at!).toLocaleString("es-PE")}
          </p>
          <button
            onClick={descargarPdf}
            disabled={pdfBusy}
            className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow disabled:opacity-50"
          >
            {pdfBusy ? "Generando PDF…" : "📄 Descargar Consentimiento (PDF)"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {saved.firma_paciente_url && (
            <FirmaView label="Paciente" url={saved.firma_paciente_url} />
          )}
          {saved.firma_medico_url && (
            <FirmaView label="Médico" url={saved.firma_medico_url} />
          )}
          {(saved as any).firma_familiar_url && (
            <FirmaView
              label={`Familiar — DNI ${(saved as any).dni_familiar ?? ""}`}
              url={(saved as any).firma_familiar_url}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Médico Tratante
          </span>
          <select
            value={medicoId}
            onChange={(e) => selectMedico(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {MEDICOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Nombre</span>
            <input
              value={medicoNombre}
              onChange={(e) => setMedicoNombre(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">CMP</span>
            <input
              value={medicoCmp}
              onChange={(e) => setMedicoCmp(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">R.N.E.</span>
            <input
              value={medicoRne}
              onChange={(e) => setMedicoRne(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border bg-white p-4 text-sm leading-relaxed text-foreground select-none touch-none">
        <h4 className="text-center text-base font-bold">
          CONSENTIMIENTO INFORMADO PARA ESCLEROTERAPIA
        </h4>
        <p className="mt-3">
          <strong>1.-</strong> Yo <strong>{paciente.nombre}</strong> con D.N.I. N°{" "}
          <strong>{paciente.dni}</strong> habiéndome explicado detalladamente en términos
          que puedo comprender, cuáles son los objetivos, las características, y los
          eventuales efectos indeseables de la ESCLEROTERAPIA, autorizo a{" "}
          <strong>{medicoNombre || "[Médico]"}</strong> con habilidad CMP{" "}
          <strong>{medicoCmp || "[CMP]"}</strong> / R.N.E.{" "}
          <strong>{medicoRne || "[RNE]"}</strong> a realizarme dicho procedimiento.
        </p>
        <p className="mt-3">
          <strong>2.-</strong> Se me explicó el procedimiento, el cual consiste en la
          inyección de la sustancia esclerosante (Polidocanol) al interior de las venas
          varicosas produciendo el cierre permanente de dicha vena. Se realiza de forma
          ambulatoria en el consultorio y no requiere uso de anestesia.
        </p>
        <p className="mt-3">
          <strong>3.-</strong> Estoy en conocimiento de los posibles riesgos del
          tratamiento de escleroterapia, que son los que se describen en las publicaciones
          médicas, todas las cuales me fueron informadas, siendo las más frecuentes:
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            Reacciones alérgicas locales o generales producidas por el medicamento
            esclerosante.
          </li>
          <li>Tromboflebitis superficial.</li>
          <li>
            Ulceración de la piel producida por la extravasación del producto
            esclerosante.
          </li>
          <li>
            Pigmentación transitoria o permanente de color café sobre las áreas tratadas.
          </li>
          <li>Aparición de manchas venosas o "Matting" sobre las áreas tratadas.</li>
          <li>
            Aparición de equimosis o "morados" transitorios en las áreas tratadas.
          </li>
          <li>
            Aparición de ampollas o "peladuras" producidas por la presión del vendaje
            elástico o los esparadrapos sobre la piel. Muchos de los riesgos están
            condicionados por el NO USO o MAL USO DEL VENDAJE COMPRESIVO que se indica en
            todo tratamiento con escleroterapia.
          </li>
        </ul>
        <p className="mt-3">
          <strong>4.-</strong> Estoy en conocimiento de que hacer el tratamiento
          esclerosante en una zona determinada no impide que aparezcan nuevas varices o
          arañitas en otra zona.
        </p>
        <p className="mt-3">
          <strong>5.-</strong> Doy mi consentimiento a la fotografía científica antes,
          durante y después del tratamiento, que será de propiedad del médico tratante.
        </p>
        <p className="mt-3">
          <strong>6.-</strong> Doy fe de no haber omitido o alterado datos al relatar mis
          antecedentes médicos y quirúrgicos, referentes a mi estado previo de salud.
        </p>
        <p className="mt-3">
          <strong>7.-</strong> Al firmar este documento reconozco que los he leído o que
          me ha sido leído y explicado y comprendo perfectamente su contenido. Se me ha
          dado oportunidad de formular preguntas las cuales han sido respondidas o
          explicadas en forma satisfactoria por tal motivo doy mi consentimiento para la
          realización del procedimiento y firmo a continuación.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-secondary/30 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">¿Requiere firma de familiar?</p>
          <p className="text-xs text-muted-foreground">
            Activa si el paciente requiere acompañante.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={requiereFamiliar}
          onClick={() => setRequiereFamiliar((v) => !v)}
          className={`relative h-7 w-12 rounded-full transition ${
            requiereFamiliar ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
              requiereFamiliar ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {requiereFamiliar && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            DNI del Familiar
          </span>
          <input
            value={dniFamiliar}
            onChange={(e) => setDniFamiliar(e.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric"
            placeholder="8 dígitos"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
      )}

      <div className={`grid gap-4 ${requiereFamiliar ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <SignaturePad
          label="Firma del Paciente *"
          value={firmaPaciente}
          onSave={setFirmaPaciente}
        />
        <SignaturePad
          label="Firma del Médico *"
          value={firmaMedico}
          onSave={setFirmaMedico}
        />
        {requiereFamiliar && (
          <SignaturePad
            label="Firma del Familiar *"
            value={firmaFamiliar}
            onSave={setFirmaFamiliar}
          />
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        onClick={registrar}
        disabled={!valido || saving}
        className="w-full rounded-full bg-primary px-5 py-3.5 text-base font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Registrando…" : "Registrar Visita y Firmar"}
      </button>

      <button
        type="button"
        onClick={descargarPdf}
        disabled={!valido || pdfBusy}
        className="w-full rounded-full border-2 border-primary/30 bg-card px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
      >
        {pdfBusy ? "Generando PDF…" : "📄 Vista previa / Descargar PDF (membretado)"}
      </button>
    </div>
  );
}

function FirmaView({ label, url }: { label: string; url: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-2">
      <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <img src={url} alt={label} className="h-28 w-full object-contain" />
    </div>
  );
}
