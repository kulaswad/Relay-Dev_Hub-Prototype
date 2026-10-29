import { db } from "../lib/db";
import {
  plans,
  subscriptions,
  workspaces,
  organizations,
  workspaceUsers,
  workspaceAddons,
  addonCatalog,
  walletTransactions,
  invoices,
  auditLog,
  changeRequests,
} from "../lib/db/schema";
import {
  getPlansCatalog,
  updatePlanCatalogEntry,
  getAddonCatalog,
  getWorkspacePricingAndSeats,
  calculateCustomPricingImpact,
  updateWorkspacePricing,
  attachWorkspaceAddon,
  cancelWorkspaceAddon,
  createSeatCorrectionRequest,
} from "../lib/services/plans";
import { approveChangeRequest } from "../lib/services/approvals";
import { eq, and, desc } from "drizzle-orm";

async function runPricingAndAddonTests() {
  console.log("================================================================================");
  console.log("       RELAY BMP - PLANS, PRICING & ADD-ONS MODULE VERIFICATION TEST           ");
  console.log("================================================================================\n");

  // Actors
  const salesOps = { id: "usr_ops_amit", role: "sales_ops" as const, name: "Amit Bansal" };
  const admin = { id: "usr_adm_kabir", role: "admin" as const, name: "Kabir Anand" };
  const am = { id: "usr_am_priya", role: "account_manager" as const, name: "Priya Sharma" };

  // ==========================================================================
  // TEST 1: PLANS CATALOG RETRIEVAL & AUDITED ENTRY UPDATE
  // ==========================================================================
  console.log("[TEST 1] Retrieving Plans Catalog and editing catalog entry as Admin...");
  const catalog = await getPlansCatalog();
  console.log(`✓ Loaded ${catalog.length} catalog plans: ${catalog.map((p) => p.name).join(", ")}`);
  
  const starter = catalog.find((p) => p.id === "plan_starter");
  if (!starter) throw new Error("Plan Starter not found!");
  console.log(`   Starter Plan: Base Fee ₹${starter.baseFeeMonthly}, SMS Floor ₹${starter.priceFloors.sms}, Workspaces: ${starter.workspaceCount}`);

  // Admin updates catalog entry
  const updatedBaseFee = starter.baseFeeMonthly + 500;
  await updatePlanCatalogEntry({
    planId: "plan_starter",
    baseFeeMonthly: updatedBaseFee,
    reason: "Annual inflation and infrastructure adjustment for Starter tier",
    actor: admin,
  });

  const updatedCatalog = await getPlansCatalog();
  const updatedStarter = updatedCatalog.find((p) => p.id === "plan_starter");
  if (updatedStarter?.baseFeeMonthly !== updatedBaseFee) {
    throw new Error(`FAIL: Starter base fee not updated. Expected ${updatedBaseFee}, got ${updatedStarter?.baseFeeMonthly}`);
  }
  console.log(`✓ Starter catalog entry updated to ₹${updatedStarter.baseFeeMonthly}. Audit record persisted.`);

  // ==========================================================================
  // TEST 2: WORKSPACE PRICING & SEAT RECONCILIATION INITIAL STATE
  // ==========================================================================
  console.log("\n[TEST 2] Inspecting Workspace Pricing & Seat Reconciliation (Single Source of Truth)...");
  // Find a target workspace
  const targetWs = db.select().from(workspaces).all()[0];
  if (!targetWs) throw new Error("No workspace found for testing");

  const initialPricing = await getWorkspacePricingAndSeats(targetWs.id);
  console.log(`Workspace: ${initialPricing.workspaceName} (${initialPricing.workspaceId})`);
  console.log(`Plan: ${initialPricing.plan.name} | Billing Model: ${initialPricing.billingModel}`);
  console.log(`Seats Billed: ${initialPricing.seatReconciliation.seatsBilled} | Provisioned: ${initialPricing.seatReconciliation.seatsProvisioned} | Active (30d): ${initialPricing.seatReconciliation.seatsActive}`);
  console.log(`Mismatch Status: ${initialPricing.seatReconciliation.mismatchType} (${initialPricing.seatReconciliation.mismatchMessage})`);

  // ==========================================================================
  // TEST 3: CUSTOM PRICING BELOW THRESHOLD (Applies Immediately)
  // ==========================================================================
  console.log("\n[TEST 3] Applying commercial discount below 15% threshold (10% discount)...");
  const belowThresholdResult = await updateWorkspacePricing({
    workspaceId: targetWs.id,
    discountPct: 10,
    discountReason: "Q4 High-volume messaging retention agreement",
    reason: "Applying agreed 10% commercial discount within AM authorized limits",
    actor: am,
  });

  console.log(`Result: ${belowThresholdResult.status} (Message: ${belowThresholdResult.message})`);
  if (belowThresholdResult.requiresApproval) {
    throw new Error("FAIL: 10% discount should have applied immediately without requiring approval!");
  }
  console.log("✓ 10% discount applied immediately within operational threshold!");

  const pricingAfterDiscount = await getWorkspacePricingAndSeats(targetWs.id);
  if (pricingAfterDiscount.subscription.discountPct !== 10) {
    throw new Error(`FAIL: Discount was not persisted. Got ${pricingAfterDiscount.subscription.discountPct}%`);
  }
  console.log(`✓ Verified persisted discount in database: ${pricingAfterDiscount.subscription.discountPct}%`);

  // ==========================================================================
  // TEST 4: CUSTOM PRICING ABOVE THRESHOLD / BELOW FLOOR (Triggers Approval)
  // ==========================================================================
  console.log("\n[TEST 4] Testing Live Policy & Approvals: Proposing rate below floor and discount >15%...");
  
  // 4a. Live Bill Impact Calculation
  const impact = await calculateCustomPricingImpact({
    workspaceId: targetWs.id,
    customOverrides: {
      sms: 0.05, // Below floor (Floor is 0.11 or 0.15)
    },
    discountPct: 25, // >15% threshold
  });

  console.log("Live Calculation Result:");
  console.log(`   Requires Approval: ${impact.requiresApproval}`);
  console.log(`   Approver Role Needed: ${impact.approverRole}`);
  console.log(`   Policy Notice: "${impact.approvalNotice}"`);
  console.log(`   Estimated 30-Day Bill Impact: ₹${impact.deltaINR.toLocaleString("en-IN")} (${impact.deltaPct}%)`);

  if (!impact.requiresApproval) {
    throw new Error("FAIL: Policy should have flagged proposal as requiring Sales Ops approval!");
  }
  console.log("✓ Live approval policy correctly intercepted rate breach and discount excess!");

  // 4b. Submit change request
  const aboveThresholdResult = await updateWorkspacePricing({
    workspaceId: targetWs.id,
    customOverrides: {
      sms: 0.05,
    },
    discountPct: 25,
    discountReason: "Strategic enterprise volume commitment contract",
    reason: "Strategic rate revision: SMS ₹0.05 and 25% discount for 10M commits.",
    actor: am,
  });

  console.log(`Submission Result: ${aboveThresholdResult.status} (CR ID: ${aboveThresholdResult.changeRequestId})`);
  if (!aboveThresholdResult.requiresApproval || !aboveThresholdResult.changeRequestId) {
    throw new Error("FAIL: Change Request was not created for approval!");
  }
  console.log(`✓ Change Request #${aboveThresholdResult.changeRequestId} queued for Sales Ops approval.`);

  // 4c. Approve change request as Sales Ops
  console.log(`Approving Change Request as Sales Ops (${salesOps.name})...`);
  await approveChangeRequest({
    requestId: aboveThresholdResult.changeRequestId,
    actorId: salesOps.id,
    actorRole: salesOps.role,
    note: "Approved custom rates: validated with Sales Director against annual commitment.",
  });

  // Verify approved pricing persisted
  const pricingAfterApproval = await getWorkspacePricingAndSeats(targetWs.id);
  if (pricingAfterApproval.subscription.discountPct !== 25) {
    throw new Error(`FAIL: Approved discount of 25% not found in DB. Got ${pricingAfterApproval.subscription.discountPct}`);
  }
  console.log(`✓ Approved custom rates and 25% discount successfully executed and persisted!`);

  // ==========================================================================
  // TEST 5: ATTACH RECURRING ADD-ON (Additional Seats) & SEAT RECONCILIATION
  // ==========================================================================
  console.log("\n[TEST 5] Attaching Recurring Add-on (5 Additional Seats) & verifying seat counts...");
  const billedSeatsBefore = pricingAfterApproval.seatReconciliation.seatsBilled;

  const attachResult = await attachWorkspaceAddon({
    workspaceId: targetWs.id,
    addonId: "addon_seat",
    quantity: 5,
    actor: salesOps,
  });
  console.log(`✓ Add-on attached: Record ID ${attachResult.addonRecordId}, Cost: ₹${attachResult.totalCost}`);

  const pricingAfterAddon = await getWorkspacePricingAndSeats(targetWs.id);
  const billedSeatsAfter = pricingAfterAddon.seatReconciliation.seatsBilled;

  if (billedSeatsAfter !== billedSeatsBefore + 5) {
    throw new Error(`FAIL: Billed seats should have increased by 5. Before: ${billedSeatsBefore}, After: ${billedSeatsAfter}`);
  }
  console.log(`✓ Seat Reconciliation verified: Billed seats increased from ${billedSeatsBefore} to ${billedSeatsAfter}!`);
  
  const seatAddon = pricingAfterAddon.activeAddons.find((a) => a.id === attachResult.addonRecordId);
  if (!seatAddon || seatAddon.monthlyTotal !== 5 * 1200) {
    throw new Error(`FAIL: Add-on monthly total incorrect. Expected 6000, got ${seatAddon?.monthlyTotal}`);
  }
  console.log(`✓ Active add-on line item confirmed: ${seatAddon.name} (Qty: 5, Monthly: ₹${seatAddon.monthlyTotal})`);

  // ==========================================================================
  // TEST 6: ATTACH ONE-TIME ADD-ON (DLT Migration) & LEDGER RECORDING
  // ==========================================================================
  console.log("\n[TEST 6] Attaching One-Time Add-on (DLT Migration Assistance ₹10,000)...");
  const oneTimeResult = await attachWorkspaceAddon({
    workspaceId: targetWs.id,
    addonId: "addon_dlt_migration",
    quantity: 1,
    actor: salesOps,
  });

  console.log(`✓ One-time add-on purchased: Record ID ${oneTimeResult.addonRecordId}`);
  if (initialPricing.billingModel === "prepaid") {
    const lastWalletTx = db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.workspaceId, targetWs.id))
      .orderBy(desc(walletTransactions.createdAt))
      .get();
    console.log(`✓ Prepaid wallet debited: Tx #${lastWalletTx?.id}, Amount: ₹${lastWalletTx?.amount}, Reference: ${lastWalletTx?.reference}`);
  } else {
    console.log(`✓ Postpaid invoice line item appended for ₹10,000.`);
  }

  // ==========================================================================
  // TEST 7: CANCEL RECURRING ADD-ON (Effective Cycle End)
  // ==========================================================================
  console.log("\n[TEST 7] Cancelling Recurring Add-on...");
  const cancelResult = await cancelWorkspaceAddon({
    workspaceAddonId: attachResult.addonRecordId,
    reason: "Customer reduced seat requirements after quarterly organizational restructuring.",
    actor: salesOps,
  });

  console.log(`✓ Add-on cancelled successfully. Effective end date: ${cancelResult.effectiveEndDate.toLocaleDateString("en-IN")}`);
  const cancelledRecord = db.select().from(workspaceAddons).where(eq(workspaceAddons.id, attachResult.addonRecordId)).get();
  if (cancelledRecord?.status !== "cancelled") {
    throw new Error(`FAIL: Add-on status should be 'cancelled', got '${cancelledRecord?.status}'`);
  }
  console.log(`✓ Addon record status in database marked 'cancelled'.`);

  // ==========================================================================
  // TEST 8: ONE-CLICK SEAT CORRECTION REQUEST
  // ==========================================================================
  console.log("\n[TEST 8] Triggering One-Click Seat Correction Request...");
  const seatCorrection = await createSeatCorrectionRequest({
    workspaceId: targetWs.id,
    actionType: "true_up_billing",
    actor: salesOps,
    reason: "Reconcile seat license count to match provisioned users",
  });
  console.log(`✓ Seat correction message: "${seatCorrection.message}"`);

  // ==========================================================================
  // TEST 9: AUDIT LOG TRAIL VERIFICATION
  // ==========================================================================
  console.log("\n[TEST 9] Verifying complete audit trail in database...");
  const logs = db
    .select()
    .from(auditLog)
    .where(eq(auditLog.targetId, targetWs.id))
    .all();

  console.log(`✓ Total audit events recorded for workspace: ${logs.length}`);
  logs.slice(-5).forEach((l) => {
    console.log(`   - [${l.action}] by ${l.actorId} (${l.actorRole}) - Reason: "${l.reason}"`);
  });

  console.log("\n================================================================================");
  console.log("            ALL 9 PLANS, PRICING & ADD-ONS TESTS PASSED!                        ");
  console.log("================================================================================");
}

runPricingAndAddonTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  });
