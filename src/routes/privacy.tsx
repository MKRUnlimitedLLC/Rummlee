import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal";

export const Route = createFileRoute("/privacy")({ component: Privacy });

function Privacy() {
  return (
    <LegalPage title="Privacy" lede="Privacy is the product. What we keep, who sees it, and how you erase it. Updated September 21, 2026.">
      <LegalSection title="The short version">
        <p>
          Neighbors see a handle, a neighborhood you pick, and the listing. They do not see your legal name, email, or
          home address. Handoff is at an official partner store by default. A public place is backup. Person to person
          is optional and still does not put your address on the listing.
        </p>
      </LegalSection>

      <LegalSection title="Who this covers">
        <p>
          Rummlee is a neighborhood-sale marketplace for cities and suburbs across the U.S. This policy applies to the
          web app, the Home Screen version on iPhone, and any App Store listing of the same product.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account.</strong> Email if you sign up that way, or the name and email your Google or X account
            shares when you continue with those. We generate an anonymous handle. Your real name is never shown to
            other neighbors.
          </li>
          <li>
            <strong>Profile.</strong> Neighborhood you pick, optional zip, Premium status, and in-app wallet balance.
          </li>
          <li>
            <strong>Listings.</strong> Titles, descriptions, prices, photos you upload, sale dates, and how you want to
            hand off (an official partner store, a public place, or optional person to person).
          </li>
          <li>
            <strong>Deals.</strong> Offers, messages, pickup codes, and whether both of you confirmed the handoff.
          </li>
          <li>
            <strong>Device.</strong> A session cookie (or a short-lived sign-in token in preview) so you stay signed in.
            We do not collect precise GPS. Neighborhood is something you choose.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use it">
        <p>
          To run the marketplace: show your listings, hold an offer, message the other neighbor, and confirm pickup.
          Wallet credits are in-app balances for those deals — not a bank account, and not sent to a card network from
          this app today.
        </p>
        <p>We do not sell personal information, and we do not run third-party ads in the app.</p>
      </LegalSection>

      <LegalSection title="Who sees what">
        <p>
          Other people see your handle, the neighborhood you chose, your listings, and messages you send them. They do
          not see your email, legal name, or wallet. Listings show an official partner store or a public place, not a home address.
          Pickup codes are only for the two people on that order.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          Account and listing data stay until you delete them or delete the account. If you remove an account, we erase
          your profile, listings, messages, offers, orders, wallet history, and sign-in records tied to you.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          You can edit neighborhood on You, take listings down by managing a sale, and sign out at any time. To erase
          everything, open You → Delete account. That is permanent.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>Rummlee is not directed at children under 13. Do not create an account for someone that young.</p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>
          Privacy questions belong on Support. If we add real card payments or a new sign-in method later, this page
          will say so before we collect anything extra.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
