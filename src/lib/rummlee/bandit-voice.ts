/** Grok voice first. The photo-fill key is the fallback. Neither is required to answer. */

export const BANDIT_VOICE_ID = "ursa";

export function banditVoiceRoute(env: NodeJS.ProcessEnv = process.env): "xai" | "openai" | null {
  if (env.XAI_API_KEY?.trim()) return "xai";
  if (env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

export async function synthesizeBandit(
  text: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const route = banditVoiceRoute(env);
  const spoken = text.trim().slice(0, 600);
  if (!route || !spoken) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response =
      route === "xai"
        ? await fetch("https://api.x.ai/v1/tts", {
            method: "POST",
            signal: controller.signal,
            headers: {
              authorization: `Bearer ${env.XAI_API_KEY}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              text: spoken,
              voice_id: BANDIT_VOICE_ID,
              language: "en",
              speed: 0.96,
            }),
          })
        : await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            signal: controller.signal,
            headers: {
              authorization: `Bearer ${env.OPENAI_API_KEY}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "tts-1-hd",
              voice: "onyx",
              input: spoken,
              response_format: "mp3",
            }),
          });
    if (!response.ok) return null;
    return { bytes: new Uint8Array(await response.arrayBuffer()), mime: "audio/mpeg" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
