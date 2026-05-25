import jsPDF from "jspdf";
import letterhead from "@/assets/letterhead.png";
import type { Paciente, Visita, DocumentoGrafico } from "@/lib/supabase";

// A4 portrait en mm
const A4 = { w: 210, h: 297 };
const M = { x: 18, top: 38, bottom: 28 }; // márgenes evitando el header/footer del membrete

/** Carga la imagen membretada como dataURL (la cachea entre invocaciones). */
let letterheadDataUrl: string | null = null;
async function getLetterhead(): Promise<string> {
  if (letterheadDataUrl) return letterheadDataUrl;
  const res = await fetch(letterhead);
  const blob = await res.blob();
  letterheadDataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  return letterheadDataUrl;
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function addLetterhead(doc: jsPDF) {
  const bg = await getLetterhead();
  doc.addImage(bg, "PNG", 0, 0, A4.w, A4.h, undefined, "FAST");
}

function safe(v: any): string {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

function newPage(doc: jsPDF) {
  doc.addPage("a4", "portrait");
}

async function newPageWithLetterhead(doc: jsPDF) {
  newPage(doc);
  await addLetterhead(doc);
}

/** Texto con salto de página automático. Devuelve el nuevo y. */
async function drawText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; maxWidth?: number } = {}
): Promise<number> {
  const size = opts.size ?? 10;
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text, opts.maxWidth ?? A4.w - M.x * 2);
  const lineH = size * 0.45;
  for (const ln of lines) {
    if (y + lineH > A4.h - M.bottom) {
      await newPageWithLetterhead(doc);
      y = M.top;
    }
    doc.text(ln, x, y);
    y += lineH;
  }
  return y;
}

function fechaLarga(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ──────────────────────────────────────────────────────────────────
// HISTORIA CLÍNICA
// ──────────────────────────────────────────────────────────────────
export async function generateHistoriaPdf(
  paciente: Paciente,
  visitas: Visita[],
  docs: DocumentoGrafico[]
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await addLetterhead(doc);

  let y = M.top;
  y = await drawText(doc, "HISTORIA CLÍNICA", M.x, y, { size: 16, bold: true });
  y = await drawText(
    doc,
    `Emitido el ${new Date().toLocaleString("es-PE")}`,
    M.x,
    y + 1,
    { size: 9 }
  );
  y += 4;

  y = await drawText(doc, "Datos del Paciente", M.x, y, { size: 12, bold: true });
  y += 1;
  const pairs: Array<[string, string]> = [
    ["Nombre", safe(paciente.nombre)],
    ["DNI", safe(paciente.dni)],
    ["Edad", safe(paciente.edad)],
    ["Sexo", safe(paciente.sexo)],
    ["Celular", safe(paciente.celular)],
    ["Ocupación", safe(paciente.ocupacion)],
    ["Procedencia", [paciente.provincia, paciente.distrito].filter(Boolean).join(" — ") || "—"],
    ["Medio", safe(paciente.medio)],
    ["N° de Hijos", safe(paciente.n_hijos)],
    ["Alergias", safe(paciente.alergias)],
    ["Patologías", safe(paciente.patologias)],
  ];
  for (const [k, v] of pairs) {
    y = await drawText(doc, `${k}: ${v}`, M.x, y, { size: 10 });
  }

  y += 4;
  y = await drawText(doc, "Historial de Procedimientos", M.x, y, { size: 12, bold: true });
  y += 1;
  if (!visitas.length) {
    y = await drawText(doc, "Sin registros.", M.x, y, { size: 10 });
  } else {
    for (const v of visitas) {
      const line = `• ${fechaLarga(v.created_at)} — ${safe(v.tipo)} · Escleros: ${
        v.escleros_hoy ?? 0
      } · Trombectomías: ${(v as any).trombectomias_hoy ?? 0}`;
      y = await drawText(doc, line, M.x, y, { size: 10 });
      if ((v as any).notas) {
        y = await drawText(doc, `   ${(v as any).notas}`, M.x, y, { size: 9 });
      }
    }
  }

  // Esquemas / notas gráficas → cada uno en su propia página
  for (const d of docs) {
    const dataUrl = await urlToDataUrl(d.url);
    if (!dataUrl) continue;
    await newPageWithLetterhead(doc);
    let py = M.top;
    py = await drawText(doc, tipoLabel(d.tipo), M.x, py, { size: 14, bold: true });
    py = await drawText(
      doc,
      `${safe(d.descripcion)} — ${fechaLarga(d.created_at)}`,
      M.x,
      py + 1,
      { size: 9 }
    );
    py += 3;
    const maxW = A4.w - M.x * 2;
    const maxH = A4.h - py - M.bottom;
    doc.addImage(dataUrl, "PNG", M.x, py, maxW, maxH, undefined, "FAST");
  }

  doc.save(`historia-${paciente.dni}.pdf`);
}

function tipoLabel(t: DocumentoGrafico["tipo"]): string {
  if (t === "nota_manuscrita") return "Nota manuscrita";
  if (t === "registro_antiguo") return "Registro antiguo";
  return "Scanner venoso";
}

// ──────────────────────────────────────────────────────────────────
// CONSENTIMIENTO INFORMADO
// ──────────────────────────────────────────────────────────────────
export type ConsentPdfInput = {
  paciente: Paciente;
  medicoNombre: string;
  medicoCmp: string;
  medicoRne: string;
  firmaPacienteUrl: string;
  firmaMedicoUrl: string;
  firmaFamiliarUrl?: string | null;
  dniFamiliar?: string | null;
  fecha?: string | null;
};

export async function generateConsentimientoPdf(input: ConsentPdfInput): Promise<void> {
  const {
    paciente,
    medicoNombre,
    medicoCmp,
    medicoRne,
    firmaPacienteUrl,
    firmaMedicoUrl,
    firmaFamiliarUrl,
    dniFamiliar,
    fecha,
  } = input;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await addLetterhead(doc);
  let y = M.top;

  y = await drawText(doc, "CONSENTIMIENTO INFORMADO PARA ESCLEROTERAPIA", M.x, y, {
    size: 14,
    bold: true,
  });
  y = await drawText(doc, fechaLarga(fecha ?? new Date().toISOString()), M.x, y + 1, {
    size: 9,
  });
  y += 4;

  const clauses = [
    `1.- Yo ${paciente.nombre} con D.N.I. N° ${paciente.dni} habiéndome explicado detalladamente en términos que puedo comprender, cuáles son los objetivos, las características, y los eventuales efectos indeseables de la ESCLEROTERAPIA, autorizo a ${medicoNombre} con habilidad CMP ${medicoCmp} / R.N.E. ${medicoRne} a realizarme dicho procedimiento.`,
    "2.- Se me explicó el procedimiento, el cual consiste en la inyección de la sustancia esclerosante (Polidocanol) al interior de las venas varicosas produciendo el cierre permanente de dicha vena. Se realiza de forma ambulatoria en el consultorio y no requiere uso de anestesia.",
    "3.- Estoy en conocimiento de los posibles riesgos del tratamiento de escleroterapia, que son los que se describen en las publicaciones médicas, todas las cuales me fueron informadas, siendo las más frecuentes: reacciones alérgicas, tromboflebitis superficial, ulceración de la piel, pigmentación transitoria o permanente, aparición de manchas venosas o 'Matting', equimosis y ampollas por la presión del vendaje compresivo.",
    "4.- Estoy en conocimiento de que hacer el tratamiento esclerosante en una zona determinada no impide que aparezcan nuevas várices o arañitas en otra zona.",
    "5.- Doy mi consentimiento a la fotografía científica antes, durante y después del tratamiento, que será de propiedad del médico tratante.",
    "6.- Doy fe de no haber omitido o alterado datos al relatar mis antecedentes médicos y quirúrgicos, referentes a mi estado previo de salud.",
    "7.- Al firmar este documento reconozco que los he leído o que me ha sido leído y explicado y comprendo perfectamente su contenido.",
  ];
  for (const c of clauses) {
    y = await drawText(doc, c, M.x, y, { size: 10 });
    y += 1.5;
  }

  // Firmas al pie — si no caben, salta a página nueva
  const sigBlockH = 55;
  if (y + sigBlockH > A4.h - M.bottom) {
    await newPageWithLetterhead(doc);
    y = M.top;
  }
  y += 6;

  const firmaPaciente = await urlToDataUrl(firmaPacienteUrl);
  const firmaMedico = await urlToDataUrl(firmaMedicoUrl);
  const firmaFamiliar = firmaFamiliarUrl ? await urlToDataUrl(firmaFamiliarUrl) : null;

  const cols = firmaFamiliar ? 3 : 2;
  const colW = (A4.w - M.x * 2) / cols;
  const sigW = colW - 8;
  const sigH = 28;

  function drawFirma(idx: number, label: string, sub: string, img: string | null) {
    const x = M.x + idx * colW + 4;
    if (img) doc.addImage(img, "PNG", x, y, sigW, sigH, undefined, "FAST");
    doc.setDrawColor(120);
    doc.line(x, y + sigH + 2, x + sigW, y + sigH + 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label, x, y + sigH + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(sub, x, y + sigH + 12);
  }

  drawFirma(0, "Paciente", `${paciente.nombre} · DNI ${paciente.dni}`, firmaPaciente);
  drawFirma(1, "Médico Tratante", `${medicoNombre} · CMP ${medicoCmp} / RNE ${medicoRne}`, firmaMedico);
  if (firmaFamiliar) {
    drawFirma(2, "Familiar", `DNI ${dniFamiliar ?? "—"}`, firmaFamiliar);
  }

  doc.save(`consentimiento-${paciente.dni}.pdf`);
}