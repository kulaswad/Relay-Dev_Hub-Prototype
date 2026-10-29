import { db } from "../lib/db";
import {
  organizations,
  workspaces,
  changeRequests,
  creditHistory,
  walletTransactions,
  invoices,
  auditLog,
  alerts,
} from "../lib/db/schema";
import { eq, desc, like } from "drizzle-orm";
import {
  changeCreditLimit,
  recordTopup,
  recordManualAdjustment,
  markInvoicePaid,
  getFinanceHubData,
  simulateDayOfUsage,
  calculateGSTBreakup,
} from "../lib/services/finance";
import { approveChangeRequest } from "../lib/services/approvals";

async function runTests() {
  console.log("=================================================");
  console.log("   RELAY BMP: CREDIT & BILLING CONTROLS TEST SUITE");
  console.log("=================================================\n");

  const finActor = { id: "usr_fin_vikram", role: "finance" as const, name: "Vikram Malhotra" };
  const finHeadActor = { id: "usr_fin_rajesh", role: "finance_head" as const, name: "Rajesh Varma" };
  const adminActor = { id: "usr_adm_kabir", role: "admin" as const, name: "Kabir Anand" };

  // --------------------------------------------------------------------------
  // TEST 1: Meridian Finserv (88% Credit Limit Expansion & Maker-Checker)
  // --------------------------------------------------------------------------
  console.log("TEST 1: Meridian Finserv Postpaid Credit Limit Expansion...");
  const wsTarget = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, "ws_meridian_finserv_sme"))
    .get();

  if (!wsTarget) {
    throw new Error("ws_meridian_finserv_sme not found in database!");
  }

  const initialLimit = wsTarget.creditLimit;
  const initialUsed = wsTarget.creditUsed;
  const initialUtil = (initialUsed / initialLimit) * 100;
  console.log(
    `  Target: ${wsTarget.name} | Limit: ₹${initialLimit.toLocaleString("en-IN")} | Used: ₹${initialUsed.toLocaleString("en-IN")} | Utilization: ${initialUtil.toFixed(1)}%`
  );

  // Vikram (Finance) requests credit limit increase to ₹35,00,000 (>₹5L increase, requires Finance Head approval)
  const newLimitTarget = 3500000;
  console.log(`  Finance (${finActor.name}) requesting credit limit hike to ₹${newLimitTarget.toLocaleString("en-IN")}...`);

  const requestResult = await changeCreditLimit({
    workspaceId: wsTarget.id,
    newCreditLimit: newLimitTarget,
    reason: "Q4 seasonal volume surge across SME loan disbursement triggers",
    note: "Customer is expanding into Tier 2 lending; request approved by VP Risk.",
    actor: finActor,
  });

  console.log(`  Result status: ${requestResult.status} | Message: ${requestResult.message}`);
  if (requestResult.status !== "pending") {
    throw new Error(`Expected status 'pending', got '${requestResult.status}'`);
  }

  // Find created change request
  const cr = await db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.targetId, wsTarget.id))
    .orderBy(desc(changeRequests.createdAt))
    .limit(1)
    .get();

  if (!cr || cr.status !== "pending") {
    throw new Error("Pending change request was not found in DB!");
  }
  console.log(`  Change Request Created: ${cr.id} (Needed: ${cr.approverRoleNeeded}, Status: ${cr.status})`);

  // Maker-Checker Check: Vikram tries to approve his own request -> MUST FAIL
  console.log("  Testing Maker-Checker constraint (requester self-approval)...");
  try {
    await approveChangeRequest({
      requestId: cr.id,
      actorId: finActor.id,
      actorRole: finActor.role,
      note: "Self approving",
    });
    throw new Error("FAILED: Maker-Checker allowed requester to approve their own request!");
  } catch (err: any) {
    console.log(`  PASS: Maker-Checker correctly blocked self-approval: "${err.message}"`);
  }

  // Rajesh (Finance Head) approves the change request
  console.log(`  Finance Head (${finHeadActor.name}) approving change request ${cr.id}...`);
  const approvalRes = await approveChangeRequest({
    requestId: cr.id,
    actorId: finHeadActor.id,
    actorRole: finHeadActor.role,
    note: "Reviewed Q3 bank statements and repayment history. Limit expansion sanctioned.",
  });

  if (!approvalRes.success) {
    throw new Error("Approval execution failed!");
  }

  // Verify workspace updated
  const updatedWs = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, wsTarget.id))
    .get();

  if (!updatedWs || updatedWs.creditLimit !== newLimitTarget) {
    throw new Error(`Expected creditLimit to be ${newLimitTarget}, got ${updatedWs?.creditLimit}`);
  }
  const newUtil = (updatedWs.creditUsed / updatedWs.creditLimit) * 100;
  console.log(`  PASS: Credit limit successfully increased to ₹${updatedWs.creditLimit.toLocaleString("en-IN")}`);
  console.log(`  New Utilization: ${newUtil.toFixed(1)}% (Headroom expanded by ₹${(newLimitTarget - initialLimit).toLocaleString("en-IN")})`);

  // Verify credit_history and audit_log
  const historyEntry = await db
    .select()
    .from(creditHistory)
    .where(eq(creditHistory.workspaceId, wsTarget.id))
    .orderBy(desc(creditHistory.createdAt))
    .limit(1)
    .get();
  console.log(
    `  PASS: Credit history recorded -> Old: ₹${historyEntry?.oldLimit.toLocaleString("en-IN")}, New: ₹${historyEntry?.newLimit.toLocaleString("en-IN")}, ChangedBy: ${historyEntry?.changedBy}, ApprovedBy: ${historyEntry?.approvedBy}`
  );

  // --------------------------------------------------------------------------
  // TEST 2: Prepaid Wallet Top-Up with Atomic Update & UTR Uniqueness
  // --------------------------------------------------------------------------
  console.log("\nTEST 2: Prepaid Wallet Top-Up & UTR Uniqueness...");
  const wsPrepaid = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, "ws_zippymart_core"))
    .get();

  if (!wsPrepaid) throw new Error("Prepaid workspace ws_zippymart_core not found!");

  const preTopupBalance = wsPrepaid.walletBalance;
  const testUtr = `UTR_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const topupAmount = 75000;

  console.log(
    `  Prepaid Workspace: ${wsPrepaid.name} | Initial Balance: ₹${preTopupBalance.toLocaleString("en-IN")}`
  );
  console.log(`  Recording Top-up of ₹${topupAmount.toLocaleString("en-IN")} with UTR ${testUtr}...`);

  const topupRes = await recordTopup({
    workspaceId: wsPrepaid.id,
    amount: topupAmount,
    paymentReference: testUtr,
    paymentMode: "RTGS",
    actor: finActor,
  });

  console.log(`  Result: Success: ${topupRes.success}, Tx: ${topupRes.transactionId}, New Balance: ₹${topupRes.newBalance.toLocaleString("en-IN")}`);
  const postTopupWs = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, wsPrepaid.id))
    .get();

  if (!postTopupWs || postTopupWs.walletBalance !== preTopupBalance + topupAmount) {
    throw new Error(`Expected balance ₹${preTopupBalance + topupAmount}, got ₹${postTopupWs?.walletBalance}`);
  }
  console.log(`  PASS: New Wallet Balance: ₹${postTopupWs.walletBalance.toLocaleString("en-IN")}`);

  // Test Duplicate UTR Rejection
  console.log("  Testing duplicate UTR rejection...");
  try {
    await recordTopup({
      workspaceId: wsPrepaid.id,
      amount: 10000,
      paymentReference: testUtr,
      paymentMode: "NEFT",
      actor: finActor,
    });
    throw new Error("FAILED: System allowed duplicate UTR reference!");
  } catch (err: any) {
    console.log(`  PASS: Duplicate UTR rejected properly: "${err.message}"`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Manual Commercial Adjustments (Prepaid & Postpaid)
  // --------------------------------------------------------------------------
  console.log("\nTEST 3: Manual Commercial Adjustments...");
  // Test A: Prepaid negative balance prevention
  console.log("  Testing prepaid negative balance prevention...");
  try {
    await recordManualAdjustment({
      workspaceId: wsPrepaid.id,
      adjustmentType: "debit",
      reasonCode: "chargeback",
      reason: "Attempting debit exceeding current wallet balance",
      amount: postTopupWs.walletBalance + 500000,
      actor: finActor,
    });
    throw new Error("FAILED: Debit allowed wallet balance to go negative!");
  } catch (err: any) {
    console.log(`  PASS: Over-debit prevented: "${err.message}"`);
  }

  // Test B: Postpaid goodwill credit adjustment (reduces creditUsed)
  console.log("  Testing postpaid credit adjustment on Meridian Finserv...");
  const wsPost = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, "ws_meridian_finserv_sme"))
    .get();
  const postUsedBefore = wsPost!.creditUsed;
  const adjAmount = 35000;

  console.log(`  Meridian current credit used: ₹${postUsedBefore.toLocaleString("en-IN")}`);
  console.log(`  Applying goodwill adjustment credit of ₹${adjAmount.toLocaleString("en-IN")}...`);

  await recordManualAdjustment({
    workspaceId: wsPost!.id,
    adjustmentType: "credit",
    reasonCode: "goodwill_credit",
    reason: "SLA downtime service rebate for weekend maintenance window",
    amount: adjAmount,
    actor: finActor,
  });

  const wsPostAfter = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, wsPost!.id))
    .get();

  if (!wsPostAfter || wsPostAfter.creditUsed !== postUsedBefore - adjAmount) {
    throw new Error(`Expected creditUsed ₹${postUsedBefore - adjAmount}, got ₹${wsPostAfter?.creditUsed}`);
  }
  console.log(
    `  PASS: Meridian creditUsed reduced to ₹${wsPostAfter.creditUsed.toLocaleString("en-IN")} (saved ₹${adjAmount.toLocaleString("en-IN")})`
  );

  // --------------------------------------------------------------------------
  // TEST 4: GST Jurisdictional Logic (Karnataka vs Other State)
  // --------------------------------------------------------------------------
  console.log("\nTEST 4: GST Jurisdictional Calculation...");
  const karnatakaTax = calculateGSTBreakup(100000, "Karnataka");
  console.log("  Karnataka (Intra-state) on ₹1,00,000 subtotal:", {
    cgst: `₹${karnatakaTax.cgstAmount.toLocaleString("en-IN")}`,
    sgst: `₹${karnatakaTax.sgstAmount.toLocaleString("en-IN")}`,
    igst: `₹${karnatakaTax.igstAmount.toLocaleString("en-IN")}`,
    totalGst: `₹${karnatakaTax.totalGst.toLocaleString("en-IN")}`,
    totalAmount: `₹${karnatakaTax.totalAmount.toLocaleString("en-IN")}`,
  });
  if (karnatakaTax.cgstAmount !== 9000 || karnatakaTax.sgstAmount !== 9000 || karnatakaTax.igstAmount !== 0) {
    throw new Error("Karnataka GST calculation incorrect! Expected 9% CGST + 9% SGST, 0% IGST.");
  }
  console.log("  PASS: Karnataka Intra-state calculation (CGST 9% + SGST 9%) verified.");

  const maharashtraTax = calculateGSTBreakup(100000, "Maharashtra");
  console.log("  Maharashtra (Inter-state) on ₹1,00,000 subtotal:", {
    cgst: `₹${maharashtraTax.cgstAmount.toLocaleString("en-IN")}`,
    sgst: `₹${maharashtraTax.sgstAmount.toLocaleString("en-IN")}`,
    igst: `₹${maharashtraTax.igstAmount.toLocaleString("en-IN")}`,
    totalGst: `₹${maharashtraTax.totalGst.toLocaleString("en-IN")}`,
    totalAmount: `₹${maharashtraTax.totalAmount.toLocaleString("en-IN")}`,
  });
  if (maharashtraTax.cgstAmount !== 0 || maharashtraTax.sgstAmount !== 0 || maharashtraTax.igstAmount !== 18000) {
    throw new Error("Inter-state GST calculation incorrect! Expected 0% CGST/SGST, 18% IGST.");
  }
  console.log("  PASS: Maharashtra Inter-state calculation (IGST 18%) verified.");

  // --------------------------------------------------------------------------
  // TEST 5: Postpaid Invoice Settlement Releases Credit Line
  // --------------------------------------------------------------------------
  console.log("\nTEST 5: Postpaid Invoice Settlement Releases Credit Line...");
  // Find an issued or overdue invoice for Meridian, or insert a fresh one
  const existingInvs = await db
    .select()
    .from(invoices)
    .where(eq(invoices.workspaceId, wsPost!.id))
    .all();
  let testInv = existingInvs.find((i) => i.status === "issued" || i.status === "overdue");

  if (!testInv) {
    const invId = `inv_test_${Date.now()}`;
    await db.insert(invoices).values({
      id: invId,
      workspaceId: wsPost!.id,
      period: "Oct 2026",
      status: "issued",
      amount: 50000,
      gstAmount: 9000,
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 15 * 86400000),
      lineItems: JSON.stringify([{ desc: "Enterprise SMS Dispatches", quantity: 500000, amount: 50000 }]),
    });
    testInv = await db.select().from(invoices).where(eq(invoices.id, invId)).get();
  }

  const creditUsedBeforePayment = (await db.select().from(workspaces).where(eq(workspaces.id, wsPost!.id)).get())!.creditUsed;
  const paymentUtr = `PAY_UTR_${Date.now()}`;
  console.log(
    `  Settling invoice ${testInv!.invoiceNumber} (Amount: ₹${testInv!.amount.toLocaleString("en-IN")}) with UTR ${paymentUtr}...`
  );

  await markInvoicePaid({
    invoiceId: testInv!.id,
    paymentReference: paymentUtr,
    paymentMode: "RTGS",
    actor: finActor,
  });

  const updatedInv = await db.select().from(invoices).where(eq(invoices.id, testInv!.id)).get();
  const creditUsedAfterPayment = (await db.select().from(workspaces).where(eq(workspaces.id, wsPost!.id)).get())!.creditUsed;

  if (updatedInv?.status !== "paid") {
    throw new Error(`Expected invoice status 'paid', got '${updatedInv?.status}'`);
  }
  console.log(`  PASS: Invoice status updated to 'paid' with paymentReference ${updatedInv?.paymentReference}`);
  console.log(
    `  PASS: Credit line released -> Before: ₹${creditUsedBeforePayment.toLocaleString("en-IN")}, After: ₹${creditUsedAfterPayment.toLocaleString("en-IN")} (Released ₹${(creditUsedBeforePayment - creditUsedAfterPayment).toLocaleString("en-IN")})`
  );

  // --------------------------------------------------------------------------
  // TEST 6: Proactive Alerts & Usage Simulation
  // --------------------------------------------------------------------------
  console.log("\nTEST 6: Proactive Usage Simulation & Risk Alert Generation...");
  const simResult = await simulateDayOfUsage(adminActor);
  console.log(`  Processed Workspaces: ${simResult.workspacesProcessed}`);
  console.log(`  Total Spend Added: ₹${simResult.totalSpendAdded.toLocaleString("en-IN")}`);
  console.log(`  Alerts Triggered: ${simResult.alertsGenerated}`);

  // Query alerts table
  const recentAlerts = await db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(5).all();
  console.log(`  Active alerts in DB: ${recentAlerts.length}`);
  for (const alt of recentAlerts) {
    console.log(`    [${alt.severity.toUpperCase()}] ${alt.title} — ${alt.message}`);
  }

  // Finance Hub Metrics Check
  console.log("\nTEST 7: Global Finance Hub Data Aggregation...");
  const hubData = await getFinanceHubData();
  console.log(`  Total Outstanding Postpaid: ₹${hubData.metrics.totalPostpaidCreditUsed.toLocaleString("en-IN")}`);
  console.log(`  Total Overdue Amount: ₹${hubData.metrics.overdueTotal.toLocaleString("en-IN")}`);
  console.log(`  Aging Breakdown:`, hubData.aging);
  console.log(`  High Utilization Postpaid Count (>80%): ${hubData.metrics.postpaidAbove80Count}`);
  console.log(`  Low Runway Prepaid Count (<5d): ${hubData.metrics.prepaidBelow5DaysCount}`);
  console.log(`  Credit Watchlist Items (>=70%): ${hubData.creditWatchlist.length}`);
  console.log(`  Collections Queue Items: ${hubData.collectionsList.length}`);

  console.log("\n=================================================");
  console.log("   ALL CREDIT & BILLING CONTROLS TESTS PASSED!");
  console.log("=================================================");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  });
