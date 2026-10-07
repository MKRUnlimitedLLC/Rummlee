import type { BriefSection, LeadBrief } from "./bandit-types";

/** Server only. The browser receives this after the code is accepted. Check the listing flow before changing a claim. */

export const BANDIT_UPDATED = "September 28, 2026";

const PRODUCT: BriefSection[] = [
  {
    title: "What Rummlee is",
    body: [
      "The good stuff, before Saturday. People list neighborhood finds for the city and the suburbs. Buyers pay in the app. Nothing ships.",
      "The handoff is the product. A new listing starts at an official store handoff. The seller can also offer a public place as backup or a person-to-person handoff. Over 50 lb, not in a box, or a truck stays off the store counter and is in person only. The street or address shows after someone pays. Before that, a listing shows a rough distance, never a home address. Neighbors see a handle, not a legal name.",
    ],
  },
  {
    title: "What a market lead does",
    body: [
      "Tricia assigns you one city area. You invite people you know in that area. You look for stores that can hold a package at the counter: staffed, public, and a fit for the neighborhood.",
      "You do not own the store. You do not run the counter. You do not cover another lead’s city.",
    ],
  },
  {
    title: "What you do not say",
    body: [
      "This is not a job, not a share of the company, and not an offer. Pay is not on this page. Do not promise anyone money.",
      "The public site is a beta on test credits. No real card is charged. Do not say the city is live.",
    ],
  },
];

function lead(id: string, name: string, city: string): LeadBrief {
  return {
    id,
    name,
    city,
    kicker: "Market lead",
    sections: [
      {
        title: "Your city",
        body: [`${name}, your city area is ${city}. Tricia assigned it. Stay inside it unless she reassigns you.`],
      },
    ],
  };
}

export const TRICIA: LeadBrief = {
  id: "tricia",
  name: "Tricia",
  city: "Assigns the city",
  kicker: "Assigns each market lead",
  sections: [
    {
      title: "Your job",
      body: [
        "You are not a market lead for a city. You assign the city area before a friend starts. One friend, one area. No overlap unless you reassign someone.",
      ],
    },
    {
      title: "The models",
      body: [
        "Kirstin has Fargo–Moorhead. Diane has Chicago. Erin has Minneapolis–Saint Paul. A new friend gets the same briefing, with the city you write in.",
      ],
    },
  ],
};

export const SHARED = PRODUCT;

export const MODELS: LeadBrief[] = [
  lead("kirstin", "Kirstin", "Fargo–Moorhead"),
  lead("diane", "Diane", "Chicago"),
  lead("erin", "Erin", "Minneapolis–Saint Paul"),
];

export const DESK = [
  { href: "/bandit/explain", label: "Explain Rummlee to someone new" },
  { href: "/bandit/rummlee-tricia.html", label: "Deck: Rummlee for Tricia" },
  { href: "/bandit/tricia-rummlee-briefing.html", label: "Deck: briefing" },
  { href: "/bandit/TRICIA-GROK-COMPANION.txt", label: "Grok companion" },
  { href: "/bandit/TRICIA-RUMMLEE-COMPANION.txt", label: "Rummlee companion" },
] as const;
