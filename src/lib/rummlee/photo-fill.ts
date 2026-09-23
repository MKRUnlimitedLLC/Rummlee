import { CATEGORIES, CONDITIONS, HAULS, PHOTO_FILL_ENABLED } from "./constants";

const CATEGORY_IDS = new Set(CATEGORIES.map((category) => category.id));
const HAUL_IDS = new Set(HAULS.map((haul) => haul.id));
const CONDITION_IDS = new Set<string>(CONDITIONS);

export type PhotoSuggestion = {
  title: string;
  category: string;
  condition: string;
  haul: string;
};

/** Suggests listing fields from a photo. Never returns a price or a weight. Refuses while the beta switch is off. */
export async function suggestFromPhoto(photoUrl: string): Promise<PhotoSuggestion> {
  if (!PHOTO_FILL_ENABLED) throw new Error("Photo fill is off during beta.");
  if (!photoUrl.startsWith("data:image/") && !photoUrl.startsWith("https://")) {
    throw new Error("Use a photo from your camera.");
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Photo fill is not configured.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Look at this one item for a neighborhood sale listing.",
                "Return JSON with title, category, condition, haul.",
                `category must be one of: ${[...CATEGORY_IDS].join(", ")}.`,
                `condition must be one of: ${[...CONDITION_IDS].join(", ")}.`,
                `haul must be one of: ${[...HAUL_IDS].join(", ")}. bag means it fits in a bag. one means one person can carry it. two means two people. truck means it needs a truck.`,
                "title is 2 to 6 words, no price, no address, no person's name.",
                "If you cannot tell the item, title is empty.",
                "Do not include price, weight, or a street address.",
              ].join(" "),
            },
            { type: "image_url", image_url: { url: photoUrl } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) throw new Error("Photo fill didn't work. Type the item in.");
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = body.choices?.[0]?.message?.content ?? "";
  let parsed: { title?: string; category?: string; condition?: string; haul?: string };
  try {
    parsed = JSON.parse(raw) as { title?: string; category?: string; condition?: string; haul?: string };
  } catch {
    throw new Error("Photo fill didn't work. Type the item in.");
  }
  const title = (parsed.title ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!title) throw new Error("Couldn't tell what this is. Type it in.");
  const category = CATEGORY_IDS.has(parsed.category as (typeof CATEGORIES)[number]["id"]) ? parsed.category! : "other";
  const condition = CONDITION_IDS.has(parsed.condition ?? "") ? parsed.condition! : "Good";
  const haul = HAUL_IDS.has(parsed.haul as (typeof HAULS)[number]["id"]) ? parsed.haul! : "one";
  return { title, category, condition, haul };
}
