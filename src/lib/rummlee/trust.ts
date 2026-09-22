export const RATING_KEYS = ["showed_up", "as_agreed", "respectful"] as const;
export type RatingKey = (typeof RATING_KEYS)[number];
export type Thumb = "up" | "down";

export function ratingCriteria(role: "buyer" | "seller") {
  return [
    {
      key: "showed_up" as const,
      label: "Showed up",
      hint: role === "buyer" ? "They were there for pickup." : "They came to pick it up.",
    },
    {
      key: "as_agreed" as const,
      label: role === "buyer" ? "As listed" : "As agreed",
      hint:
        role === "buyer"
          ? "The item matched the listing."
          : "They paid and followed the hold — no surprise at the door.",
    },
    {
      key: "respectful" as const,
      label: "Respectful at the handoff",
      hint: "Kind, on time enough, no home-address pressure.",
    },
  ];
}

export function overallThumb(marks: Record<RatingKey, Thumb>): Thumb {
  return RATING_KEYS.every((k) => marks[k] === "up") ? "up" : "down";
}
