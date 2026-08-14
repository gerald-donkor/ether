import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  grantPurchaseCredits,
  readCreditBalance,
  reserveGenerationCapacity,
  reversePurchaseCredits,
  settleGenerationCredits,
} from "../lib/db/billing";
import { getDb } from "../lib/db/index";
import { creditLedger, creditReservations, usageEvents } from "../lib/db/schema";

test("credits cannot overspend and grants, settlement and reversals are idempotent", async () => {
  const suffix = crypto.randomUUID();
  const owner = `billing-owner-${suffix}`;
  const other = `billing-other-${suffix}`;
  const operations = [crypto.randomUUID(), crypto.randomUUID()];
  const db = getDb();

  try {
    assert.equal(await readCreditBalance(owner), 10);
    const results = await Promise.all(operations.map((operationId) => reserveGenerationCapacity({
      userId: owner,
      operationId,
      model: "synthetic",
      imageCount: 6,
      providerUnits: 1,
      creditCost: 1,
    })));
    assert.equal(results.filter((result) => result.status === "accepted").length, 1);
    assert.equal(results.filter((result) => result.status === "insufficient_credits").length, 1);

    const acceptedIndex = results.findIndex((result) => result.status === "accepted");
    const acceptedOperation = operations[acceptedIndex];
    assert.ok(acceptedOperation);
    assert.equal(await settleGenerationCredits(acceptedOperation, 3), 3);
    assert.equal(await settleGenerationCredits(acceptedOperation, 3), 3);
    assert.equal(await readCreditBalance(owner), 7);
    assert.equal(await readCreditBalance(other), 10);

    const objectId = `pi_${suffix}`;
    await grantPurchaseCredits({ userId: owner, credits: 100, reason: "top_up_grant", stripeEventId: `evt_grant_${suffix}`, stripeObjectId: objectId });
    await grantPurchaseCredits({ userId: owner, credits: 100, reason: "top_up_grant", stripeEventId: `evt_grant_duplicate_${suffix}`, stripeObjectId: objectId });
    assert.equal(await readCreditBalance(owner), 107);
    await reversePurchaseCredits({ stripeObjectId: objectId, stripeEventId: `evt_refund_${suffix}`, reason: "refund_reversal", maximumCredits: 40 });
    await reversePurchaseCredits({ stripeObjectId: objectId, stripeEventId: `evt_refund_${suffix}`, reason: "refund_reversal", maximumCredits: 40 });
    assert.equal(await readCreditBalance(owner), 67);
  } finally {
    await db.delete(creditLedger).where(eq(creditLedger.userId, owner));
    await db.delete(creditLedger).where(eq(creditLedger.userId, other));
    await db.delete(creditReservations).where(eq(creditReservations.userId, owner));
    await db.delete(usageEvents).where(eq(usageEvents.userId, owner));
  }
});
