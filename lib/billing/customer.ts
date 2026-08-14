import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getBillingCustomerForOwner, saveBillingCustomer } from "@/lib/db/billing";
import { getStripe } from "./stripe";

function customerKey(userId: string) {
  return createHash("sha256").update(`ether:${userId}`).digest("hex");
}

export async function getOrCreateStripeCustomer(userId: string) {
  const existing = await getBillingCustomerForOwner(userId);
  if (existing) return existing.stripeCustomerId;

  const customer = await getStripe().customers.create(
    { metadata: { ether_owner_key: customerKey(userId) } },
    { idempotencyKey: `ether-customer-${customerKey(userId)}` },
  );
  await saveBillingCustomer(userId, customer.id);
  return customer.id;
}

export async function deleteStripeCustomerForOwner(userId: string) {
  const customer = await getBillingCustomerForOwner(userId);
  if (!customer) return;
  await getStripe().customers.del(customer.stripeCustomerId);
}

export function checkoutIntegrationIdentifier() {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  return `ether_account_${[...randomBytes(8)].map((byte) => letters[byte % letters.length]).join("")}`;
}
