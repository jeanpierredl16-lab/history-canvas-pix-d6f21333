import { supabase, type Visita } from "@/lib/supabase";

export const visitService = {
  async listByDni(dni: string): Promise<Visita[]> {
    const { data, error } = await supabase
      .from("visitas")
      .select("*")
      .eq("paciente_dni", dni)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Visita[];
  },
  async create(payload: Partial<Visita> & { paciente_dni: string }): Promise<Visita> {
    const { data, error } = await supabase
      .from("visitas")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as Visita;
  },
};