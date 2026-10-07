import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal";
import { publicHead } from "@/lib/rummlee/seo";

export const Route = createFileRoute("/support")({
  head: () => publicHead("/support", "Rummlee support", "Pickup stuck, a listing looks wrong, or you need the account gone. Start here."),
  component: Support,
});

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
          Meet at the handoff the seller offers — official store first, public place as backup, or person to person. Don’t share your
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

      <LegalSection title="Contact">
        <p>
          Account, pickup, and safety questions:{" "}
          <a className="font-medium text-primary-ink" href="mailto:support@rummlee.com">
            support@rummlee.com
          </a>
          . Privacy questions:{" "}
          <a className="font-medium text-primary-ink" href="mailto:privacy@rummlee.com">
            privacy@rummlee.com
          </a>
          . A store that wants to hold packages:{" "}
          <a className="font-medium text-primary-ink" href="mailto:stores@rummlee.com">
            stores@rummlee.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
