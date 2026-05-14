import Stripe from "stripe";
import { getStripeSecretKey } from "./config";

let cached: Stripe | undefined;

/**
 * Return a singleton Stripe client. Calling code must guard with `isStripeConfigured()` (or this
 * function returning undefined). We never instantiate the client without a key so test/dev hosts
 * that never set STRIPE_SECRET_KEY can keep importing the billing modules.
 */
export function getStripeClient(): Stripe | undefined {
  if (cached) return cached;
  const key = getStripeSecretKey();
  if (!key) return undefined;
  cached = new Stripe(key, {
    appInfo: {
      name: "abanoteassistant",
      url: "https://abanoteassistant.com",
    },
  });
  return cached;
}
