import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gdqkiqmumuqybtxybhag.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xideb-9ds48WSamyj_7npw_SEerY73k";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const STORAGE_BUCKET = "historias-clinicas";

export type Paciente = {
  id?: string;
  dni: string;
  nombre: string;
  edad: number | null;
  sexo: string | null;
  celular: string | null;
  ocupacion: string | null;
  provincia: string | null;
  distrito: string | null;
  medio: string | null;
  alergias: string | null;
  patologias: string | null;
  n_hijos: number | null;
  created_at?: string;
};

export type Visita = {
  id?: string;
  paciente_dni: string;
  tipo: string;
  monto_pagado: number;
  escleros_hoy: number;
  notas: string | null;
  firma_paciente_url: string | null;
  firma_medico_url: string | null;
  created_at?: string;
};

export type DocumentoGrafico = {
  id?: string;
  paciente_dni: string;
  tipo: "nota_manuscrita" | "registro_antiguo" | "scanner_venoso";
  url: string;
  descripcion: string | null;
  created_at?: string;
};
