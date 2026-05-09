// Webhook externo (Google Apps Script) para almacenamiento de archivos.
// Reemplazar CODIGO_SECRETO_AQUI por el deployment ID real del Apps Script.
const UPLOAD_WEBHOOK_URL =
  "https://script.google.com/macros/s/CODIGO_SECRETO_AQUI/exec";

function splitDataUrl(dataUrl: string): { mime: string; base64: string } {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/png";
  return { mime, base64 };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function postToWebhook(filename: string, base64: string): Promise<string> {
  const res = await fetch(UPLOAD_WEBHOOK_URL, {
    method: "POST",
    body: JSON.stringify({ filename, base64 }),
  });
  if (!res.ok) {
    throw new Error(`Webhook upload failed: ${res.status}`);
  }
  const json = (await res.json()) as { success?: boolean; url?: string; error?: string };
  if (!json.success || !json.url) {
    throw new Error(json.error || "Webhook did not return a URL");
  }
  return json.url;
}

export async function uploadDataUrl(
  dataUrl: string,
  pacienteDni: string,
  prefix: string
): Promise<string> {
  const { mime, base64 } = splitDataUrl(dataUrl);
  const ext = mime.split("/")[1] || "png";
  const filename = `${pacienteDni}/${prefix}-${Date.now()}.${ext}`;
  return postToWebhook(filename, base64);
}

export async function uploadFile(
  file: File,
  pacienteDni: string,
  prefix: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${pacienteDni}/${prefix}-${Date.now()}.${ext}`;
  const base64 = await fileToBase64(file);
  return postToWebhook(filename, base64);
}
