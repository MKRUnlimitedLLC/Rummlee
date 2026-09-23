/** Real charges stay off while test credits are the wallet. The package is installed for the live cutover. */
export function stripeStatus() {
  return {
    mode: process.env.STRIPE_SECRET_KEY ? "key-present" : "not-configured",
    tax: process.env.STRIPE_TAX_ENABLED === "1",
    connect: Boolean(process.env.STRIPE_CONNECT_CLIENT_ID),
    charges: false,
  };
}

export async function stripeSdkLoads(): Promise<boolean> {
  if (!process.env.STRIPE_SECRET_KEY) return false;
  await import("stripe");
  return true;
}
