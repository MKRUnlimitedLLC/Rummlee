import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal";

export const Route = createFileRoute("/support")({ component: Support });

function Support() {
  return (
    <LegalPage
      title="Support"
      lede="Pickup stuck, listing looks wrong, or you need the account gone? Start here."
    >
      <LegalSection title="Talk to the other neighbor">
        <p>
          Offers, times, and “is this still available?” belong in{" "}
          <Link to="/inbox" className="font-medium text-primary-ink underline-offset-4 hover:underline">
            Inbox
          </Link>
          . Pickup codes live on the order. Both of you scan or type the code to release the hold.
        </p>
      </LegalSection>

      <LegalSection title="Safety">
        <p>
          Meet at a handoff location the seller offers — official store, public place, or in person. Don’t share your
          real name, home address, or the pickup code with anyone who isn’t on that order. Leave if you feel off, and
          don’t confirm.
        </p>
      </LegalSection>

      <LegalSection title="Account and data">
        <p>
          Neighborhood and wallet are on{" "}
          <Link to="/you" className="font-medium text-primary-ink underline-offset-4 hover:underline">
            You
          </Link>
          . Sign out is on that page. Delete account is at the bottom — it hides your handle,
          listings, messages, and wallet. That matches Apple’s account-deletion rule.
        </p>
      </LegalSection>

      <LegalSection title="Install on iPhone">
        <p>
          After you publish Rummlee, open it in Safari, tap Share, then Add to Home Screen. That uses your live app —
          no TestFlight needed. The App Store listing is a separate step that uses your Apple Developer account.
        </p>
      </LegalSection>

      <LegalSection title="App Store listing">
        <p>
          Seller: your Apple Developer team. Category: Shopping. Age: 12+ (user-generated listings and in-app credits).
          Privacy and terms URLs are this app’s /privacy and /terms pages. Support URL is this page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
