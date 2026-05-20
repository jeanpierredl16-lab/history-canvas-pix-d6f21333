import { supabase, type Paciente } from "@/lib/supabase";

export const patientService = {
  async findByDni(dni: string): Promise<Paciente | null> {
    const { data, error } = await supabase
      .from("pacientes")
      .select("*")
      .eq("dni", dni)
      .maybeSingle();
    if (error) throw error;
    return (data as Paciente) ?? null;
  },
  async create(p: Paciente): Promise<Paciente> {
    const { data, error } = await supabase
      .from("pacientes")
      .insert(p)
      .select()
      .single();
    if (error) throw error;
    return data as Paciente;
  },
};