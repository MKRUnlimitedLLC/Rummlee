export type BriefSection = { title: string; body: string[] };

export type LeadBrief = {
  id: string;
  name: string;
  city: string;
  kicker: string;
  sections: BriefSection[];
};

export function briefForFriend(model: LeadBrief, name: string, city: string): LeadBrief {
  const who = name.trim() || "New friend";
  const where = city.trim() || "City Tricia assigns";
  return {
    ...model,
    id: `friend-${who.toLowerCase()}`,
    name: who,
    city: where,
    sections: model.sections.map((section, index) =>
      index === 0
        ? {
            title: "Your city",
            body: [`${who}, your city area is ${where}. That city was assigned to you. Stay inside it unless you are reassigned.`],
          }
        : section,
    ),
  };
}
