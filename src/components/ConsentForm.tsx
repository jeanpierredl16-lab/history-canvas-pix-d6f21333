import { useMemo, useState } from "react";
import type { Paciente, Visita } from "@/lib/supabase";
import { uploadDataUrl } from "@/services/fileService";
import { visitService } from "@/services/visitService";
import { SignaturePad } from "./SignaturePad";

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
  const [firmaPaciente, setFirmaPaciente] = useState<string | null>(null);
  const [firmaMedico, setFirmaMedico] = useState<string | null>(null);
  const [requiereFamiliar, setRequiereFamiliar] = useState(false);
  const [dniFamiliar, setDniFamiliar] = useState("");
  const [firmaFamiliar, setFirmaFamiliar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Visita | null>(null);
  const [medicoId, setMedicoId] = useState<string>(MEDICOS[0].id);
  const [medicoNombre, setMedicoNombre] = useState<string>(MEDICOS[0].nombre);
  const [medicoCmp, setMedicoCmp] = useState<string>(MEDICOS[0].cmp);
  const [medicoRne, setMedicoRne] = useState<string>(MEDICOS[0].rne);

  function selectMedico(id: string) {
    setMedicoId(id);
    const m = MEDICOS.find((x) => x.id === id);
    if (m && id !== "otro") {
      setMedicoNombre(m.nombre);
      setMedicoCmp(m.cmp);
      setMedicoRne(m.rne);
    } else {
      setMedicoNombre("");
      setMedicoCmp("");
      setMedicoRne("");
    }
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
      setSaved(data);
      onSaved(data);
    } catch (e: any) {
      setError(e?.message ?? "Error al registrar");
    } finally {
      setSaving(false);
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

      <div className="max-h-96 overflow-y-auto rounded-lg border bg-white p-4 text-sm leading-relaxed text-foreground">
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
