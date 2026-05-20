import { supabase, type DocumentoGrafico } from "@/lib/supabase";

export const documentService = {
  async listByDni(dni: string): Promise<DocumentoGrafico[]> {
    const { data, error } = await supabase
      .from("documentos_graficos")
      .select("*")
      .eq("paciente_dni", dni)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as DocumentoGrafico[];
  },
  async create(doc: Omit<DocumentoGrafico, "id" | "created_at">): Promise<void> {
    const { error } = await supabase.from("documentos_graficos").insert(doc);
    if (error) throw error;
  },
};