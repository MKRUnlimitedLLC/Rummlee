import { createFileRoute } from "@tanstack/react-router";
import { handleStripeWebhook } from "@/lib/rummlee/stripe-webhook";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleStripeWebhook(request),
    },
  },
});
