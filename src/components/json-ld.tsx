const GRAPH = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Rummlee",
      legalName: "Rummlee Corp",
      url: "https://rummlee.com/",
      logo: "https://rummlee.com/icon-512.png",
      description:
        "Pre-launch local marketplace. Neighbors sell used household items. Official store handoff first. Nothing ships.",
      foundingLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Fargo",
          addressRegion: "ND",
          addressCountry: "US",
        },
      },
      areaServed: "US",
      email: "support@rummlee.com",
      contactPoint: {
        "@type": "ContactPoint",
        email: "support@rummlee.com",
        contactType: "customer support",
        areaServed: "US",
        availableLanguage: "English",
      },
      knowsAbout: ["local marketplace", "neighborhood sale", "peer-to-peer pickup"],
    },
    {
      "@type": "WebSite",
      name: "Rummlee",
      url: "https://rummlee.com/",
      description:
        "The good stuff, before Saturday. A pre-launch local marketplace. Handoff method patent pending. Not an issued patent.",
    },
  ],
};

export function JsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(GRAPH) }} />;
}
