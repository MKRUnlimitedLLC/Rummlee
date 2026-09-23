const MAX_EDGE = 1280;
const MIN_EDGE = 480;
const TARGET_CHARS = 250_000;
const HARD_CHARS = 1_400_000;

let webpOk: boolean | null = null;

/** Shrink a phone photo to WebP, or JPEG when the browser cannot encode WebP. Canvas output drops location data. */
export async function compressPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error("Use a photo.");
  }
  if (file.size > 20 * 1024 * 1024) throw new Error("That photo is too large. Choose one under 20 MB.");
  if (/heic|heif/i.test(file.type) || /\.heic$|\.heif$/i.test(file.name)) {
    throw new Error("Save that phone photo as a JPEG or WebP, then choose it again.");
  }
  const bitmap = await decodePhoto(file);
  try {
    const mime = photoMime();
    let edge = Math.min(MAX_EDGE, Math.max(bitmap.width, bitmap.height));
    let quality = 0.82;
    let last = "";
    for (let attempt = 0; attempt < 8; attempt++) {
      last = encodePhoto(bitmap, edge, quality, mime);
      if (last.length <= TARGET_CHARS) return last;
      if (quality > 0.52) quality = Math.round((quality - 0.1) * 100) / 100;
      else edge = Math.max(MIN_EDGE, Math.round(edge * 0.75));
    }
    if (last.length >= HARD_CHARS) throw new Error("Could not shrink that photo. Try another.");
    return last;
  } finally {
    bitmap.close();
  }
}

function photoMime(): "image/webp" | "image/jpeg" {
  if (webpOk === null) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    webpOk = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpOk ? "image/webp" : "image/jpeg";
}

async function decodePhoto(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        /* fall through to Image */
      }
    }
  }
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that photo.");
  ctx.drawImage(img, 0, 0);
  return createImageBitmap(canvas);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read that photo."));
    };
    img.src = objectUrl;
  });
}

function encodePhoto(bitmap: ImageBitmap, maxEdge: number, quality: number, mime: "image/webp" | "image/jpeg") {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that photo.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL(mime, quality);
  if (mime === "image/webp" && !url.startsWith("data:image/webp")) {
    return canvas.toDataURL("image/jpeg", quality);
  }
  return url;
}
