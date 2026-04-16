import { supabase, STORAGE_BUCKET } from "@/lib/supabase";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function uploadDataUrl(
  dataUrl: string,
  pacienteDni: string,
  prefix: string
): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type.split("/")[1] || "png";
  const path = `${pacienteDni}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFile(
  file: File,
  pacienteDni: string,
  prefix: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${pacienteDni}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
