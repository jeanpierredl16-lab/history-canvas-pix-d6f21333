import { supabase, STORAGE_BUCKET } from "@/lib/supabase";

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  const ext = mime.split("/")[1] || "png";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), ext };
}

async function uploadBlob(path: string, blob: Blob, contentType: string): Promise<string> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, { upsert: true, contentType });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadDataUrl(
  dataUrl: string,
  pacienteDni: string,
  prefix: string,
): Promise<string> {
  const { blob, ext } = dataUrlToBlob(dataUrl);
  const path = `${pacienteDni}/${prefix}-${Date.now()}.${ext}`;
  return uploadBlob(path, blob, blob.type);
}

export async function uploadFile(
  file: File,
  pacienteDni: string,
  prefix: string,
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${pacienteDni}/${prefix}-${Date.now()}.${ext}`;
  return uploadBlob(path, file, file.type || "application/octet-stream");
}