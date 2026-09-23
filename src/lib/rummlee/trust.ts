export const RATING_KEYS = ["showed_up", "as_agreed", "respectful"] as const;
export type RatingKey = (typeof RATING_KEYS)[number];
export type Thumb = "up" | "down";

export function ratingCriteria(role: "buyer" | "seller") {
  const rows: { key: string; label: string; hint: string }[] = [
    {
      key: "showed_up",
      label: "Showed up",
      hint: role === "buyer" ? "They were there for pickup." : "They came to pick it up.",
    },
    {
      key: "as_agreed",
      label: role === "buyer" ? "As listed" : "As agreed",
      hint:
        role === "buyer"
          ? "The item matched the listing."
          : "They paid and followed the hold — no surprise at the door.",
    },
    {
      key: "respectful",
      label: "Respectful at the handoff",
      hint: "Kind, on time enough, no home-address pressure.",
    },
  ];
  if (role === "buyer") {
    rows.push({
      key: "packaged",
      label: "Packed for handoff",
      hint: "Outer box when it fits. As-is only if a box would not help. Down if it was loose, leaking, or not what they said.",
    });
  }
  return rows;
}

export function overallThumb(marks: { showed_up: Thumb; as_agreed: Thumb; respectful: Thumb; packaged?: Thumb | null }): Thumb {
  const values = [marks.showed_up, marks.as_agreed, marks.respectful, marks.packaged].filter(
    (mark): mark is Thumb => mark === "up" || mark === "down",
  );
  return values.every((mark) => mark === "up") ? "up" : "down";
}