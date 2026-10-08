import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal";
import { publicHead } from "@/lib/rummlee/seo";

export const Route = createFileRoute("/support")({
  head: () => publicHead("/support", "Rummlee support", "Stuck on a pickup, spotted a listing that looks wrong, or want your account gone? Start here."),
  component: Support,
});

function Support() {
  return (
    <LegalPage
      title="Support"
      lede="Stuck on a pickup, spotted a listing that looks wrong, or want your account gone? Start here."
    >
      <LegalSection title="Talk to the other neighbor">
        <p>
          Offers, timing, and “is this still available?” all go in{" "}
          <Link to="/inbox" className="font-medium text-primary-ink underline-offset-4 hover:underline">
            Inbox
          </Link>
          . Your pickup code is on the order. You both scan or type the code to release the hold.
        </p>
      </LegalSection>

      <LegalSection title="Safety">
        <p>
          Meet at the handoff the seller offers: an official store first, a public place as backup, or person to person. Don’t share your real name, home address, or pickup code with anyone who isn’t on that order. If something feels off, leave, and don’t confirm the pickup.
        </p>
      </LegalSection>

      <LegalSection title="Account and data">
        <p>
          Your neighborhood and wallet are on{" "}
          <Link to="/you" className="font-medium text-primary-ink underline-offset-4 hover:underline">
            You
          </Link>
          , and so is Sign out. Delete account is at the bottom of that page. It hides your handle, listings, messages, and wallet, which is what Apple’s account-deletion rule asks for.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          For account, pickup, or safety questions, write to{" "}
          <a className="font-medium text-primary-ink" href="mailto:support@rummlee.com">
            support@rummlee.com
          </a>
          . Privacy questions go to{" "}
          <a className="font-medium text-primary-ink" href="mailto:privacy@rummlee.com">
            privacy@rummlee.com
          </a>
          . Run a store that wants to hold packages? Write to{" "}
          <a className="font-medium text-primary-ink" href="mailto:stores@rummlee.com">
            stores@rummlee.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
