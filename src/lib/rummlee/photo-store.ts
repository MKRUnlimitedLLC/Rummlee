/** Store a compressed photo in Vercel Blob when the token is set. Otherwise keep the data URL. */
export async function storePhoto(dataUrl: string, name: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || !dataUrl.startsWith("data:image/")) return dataUrl;
  const match = /^data:(image\/[\w.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) return dataUrl;
  try {
    const { put } = await import("@vercel/blob");
    const body = Buffer.from(match[2].replace(/\s/g, ""), "base64");
    const blob = await put(name, body, {
      access: "public",
      contentType: match[1].toLowerCase(),
      token,
      addRandomSuffix: false,
    });
    return blob.url;
  } catch {
    return dataUrl;
  }
}
