import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal";

export const Route = createFileRoute("/privacy")({ component: Privacy });

function Privacy() {
  return (
    <LegalPage title="Privacy" lede="Privacy is the product. What we keep, who sees it, and how you erase it. Updated September 21, 2026.">
      <LegalSection title="The short version">
        <p>
          Neighbors see a handle, a neighborhood you pick, and the listing. They do not see your legal name, email, or
          home address. Pickup is at a handoff location the seller offers: official store, public place, and/or in person.
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
            shares when you continue with those. We generate an anonymous handle. Your legal first and last name, and
            your phone, stay on the account. They are never shown to other neighbors.
          </li>
          <li>
            <strong>Profile.</strong> City and neighborhood you pick, optional zip, Rummlee Plus status, and in-app
            test-credit wallet. Legal name and phone are private account fields. Beta pay is simulated. We do not take
            card numbers. We never ask for a street or home address.
          </li>
          <li>
            <strong>Listings.</strong> Titles, descriptions, prices, photos you upload, sale dates, and how you want to
            hand off (an official partner store, a public place, or optional person to person). Photo fill, when it is
            on, sends that photo to suggest a title and category. It is off during beta. It does not set your price.
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
          Account and listing data stay until you close the account. Closing it hides your handle and your messages.
          Orders, fees, and tax amounts stay, because a closed sale is a record. We do not store a photo of your ID
          or a tax number. A payment company would collect those if real payouts turn on.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          You can edit neighborhood on You and sign out at any time. Download my data, on that same page, gives you a
          JSON file of your account, listings, offers, messages, and orders. Other people are handles only. To close
          the login, open You → Delete account. The sale record is not erased. Email support to reopen a closed login.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>Rummlee is not directed at children under 13. Do not create an account for someone that young.</p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>
          Privacy questions belong on Support. Beta pay is test credits only. If we add real card payments or a new
          sign-in method later, this page will say so before we collect anything extra.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
