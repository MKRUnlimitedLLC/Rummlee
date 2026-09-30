import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { OwnershipForm } from "@/components/launch-forms";
import { LegalPage, LegalSection } from "@/components/legal";

const TITLE = "Rummlee for investors — local commerce marketplace and handoff";
const DESCRIPTION =
  "Growth equity, software and internet. Rummlee is a local commerce marketplace for neighborhood resale and handoff. Beta. Raising $2.5M at $12M pre-money.";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "MKR Unlimited",
      url: "https://rummlee.com/",
      email: "matt@mkr-unlimited.com",
      founder: {
        "@type": "Person",
        name: "Matthew Rau",
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Fargo",
        addressRegion: "ND",
        addressCountry: "US",
      },
    },
    {
      "@type": "WebSite",
      name: "Rummlee",
      url: "https://rummlee.com/",
    },
    {
      "@type": "SoftwareApplication",
      name: "Rummlee",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://rummlee.com/",
      description:
        "Hyperlocal garage, estate, moving, and cleanout marketplace. Local handoff only. No shipping. Beta, with test credits.",
      provider: {
        "@type": "Organization",
        name: "MKR Unlimited",
      },
    },
  ],
};

export const Route = createFileRoute("/investors")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://rummlee.com/investors" },
      { property: "og:image", content: "https://rummlee.com/og.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { "script:ld+json": structuredData },
    ],
  }),
  component: Investors,
});

function Investors() {
  return (
    <LegalPage
      title="Investors"
      lede="A plain-English page for investors and automated deal screeners. Only what is true. September 29, 2026."
    >
      <LegalSection title="The product">
        <p>
          Rummlee is a hyperlocal marketplace for garage sales, estate sales,
          moving sales, and home cleanouts. It is local only. Rummlee never
          ships. There is no carrier, no postage, and no delivery.
        </p>
        <p>
          A neighbor pays in the app. The money is held until both people
          confirm the handoff. The handoff is one of three kinds: an Official
          partner store, a public place, or a private handoff.
        </p>
      </LegalSection>

      <LegalSection title="What is live">
        <p>
          The product is on the web at{" "}
          <a
            href="https://rummlee.com/"
            className="font-medium text-primary-ink underline-offset-4 hover:underline"
          >
            https://rummlee.com
          </a>
          {
            ". The company is MKR Unlimited. The founder is Matthew Rau, in Fargo, North Dakota."
          }
        </p>
        <p>
          Rummlee is in beta. People pay with test credits. It is not a live
          marketplace with reported sales, a user count, or a take-rate history.
          No Official Handoff store is live in production. GameStop is not a
          signed partner.
        </p>
      </LegalSection>

      <LegalSection title="The thesis">
        <p>
          The missing piece in local resale is finishing the deal without a
          stranger on the porch. Official Handoff Locations are that piece: a
          counter that is not either person’s home.
        </p>
        <p>
          The retail thesis is a partner store that already has a counter and
          hours. GameStop is the first retail fit we are aiming at. That is an
          aspirational fit, not a signed deal.
        </p>
      </LegalSection>

      <LegalSection title="The raise">
        <p>
          MKR Unlimited is raising $2.5 million at a $12 million pre-money
          valuation. Write to{" "}
          <a
            href="mailto:matt@mkr-unlimited.com"
            className="font-medium text-primary-ink underline-offset-4 hover:underline"
          >
            matt@mkr-unlimited.com
          </a>
          {"."}
        </p>
        <p>
          The founder builds with AI staff (Grok bots) in short focus blocks.
          The raise is for a real dedicated team.
        </p>
      </LegalSection>

      <OwnershipInterest />
    </LegalPage>
  );
}

function OwnershipInterest() {
  const [done, setDone] = useState<string | null>(null);
  return (
    <LegalSection title="Ownership interest">
      <p>
        This is for a business that wants to talk about owning part of Rummlee.
        It is not an Official Handoff Location application, and it is not the
        consumer waitlist.
      </p>
      <p>
        Email and company are enough. A short note is optional. No street
        address, no phone, and no payment. Rummlee is in beta. Sending this is
        not an offer of shares, an allocation, exclusivity, or a date to close.
        The raise terms above are the only ones stated on this page.
      </p>
      {done ? (
        <p role="status" className="rounded-2xl bg-bg p-4 text-pretty">
          {done}
        </p>
      ) : (
        <OwnershipForm
          idPrefix="ownership"
          onSuccess={(message) => {
            setDone(message);
            toast.success(message);
          }}
        />
      )}
      <p>
        You can also write to{" "}
        <a
          href="mailto:matt@mkr-unlimited.com"
          className="font-medium text-primary-ink underline-offset-4 hover:underline"
        >
          matt@mkr-unlimited.com
        </a>
        .
      </p>
    </LegalSection>
  );
}
