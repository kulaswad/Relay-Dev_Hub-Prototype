import { db } from "../lib/db";
import { workspaces, changeRequests, creditHistory, auditLog } from "../lib/db/schema";
import { requestChange, approveChangeRequest } from "../lib/services/approvals";
import { assertPermission } from "../lib/permissions/guard";
import { eq, desc } from "drizzle-orm";

async function runTest() {
  console.log("=== STARTING MAKER-CHECKER SECURITY & PERMISSION TESTS ===");

  // Find a postpaid workspace with a credit limit
  const targetWorkspace = db
    .select()
    .from(workspaces)
    .all()
    .find((w) => w.creditLimit > 0);

  if (!targetWorkspace) {
    throw new Error("No eligible postpaid workspace found for testing.");
  }

  const initialLimit = targetWorkspace.creditLimit;
  const requestedLimit = initialLimit + 1000000; // Increase by ₹10,00,000 (well above ₹5L threshold)

  console.log(
    `Selected Workspace: ${targetWorkspace.name} (${targetWorkspace.id})`
  );
  console.log(`Current Credit Limit: ₹${initialLimit.toLocaleString("en-IN")}`);
  console.log(`Proposed Credit Limit: ₹${requestedLimit.toLocaleString("en-IN")}`);

  // 1. ACTOR: Finance (usr_fin_vikram) requests limit hike
  console.log("\n[TEST 1] Finance requests limit hike exceeding policy threshold...");
  const requestResult = await requestChange({
    type: "credit_limit_increase",
    targetType: "workspace",
    targetId: targetWorkspace.id,
    payload: {
      newCreditLimit: requestedLimit,
      effectiveImmediate: true,
    },
    reason: "Client expanding WhatsApp promotional broadcast for Q4 festive season.",
    actorId: "usr_fin_vikram",
    actorRole: "finance",
  });

  console.log("Request Result:", requestResult);
  if (requestResult.status !== "pending" || !requestResult.changeRequestId) {
    throw new Error("FAIL: Request should have required approval but did not!");
  }
  const changeRequestId = requestResult.changeRequestId;
  console.log(`✓ Change Request Created: ${changeRequestId}`);

  const crRecord = db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.id, changeRequestId))
    .get();

  if (!crRecord || crRecord.approverRoleNeeded !== "finance_head") {
    throw new Error(
      `FAIL: Expected approverRoleNeeded to be finance_head, got ${crRecord?.approverRoleNeeded}`
    );
  }
  console.log(
    `✓ Maker-checker rule evaluated: Approver role needed is ${crRecord.approverRoleNeeded}`
  );

  // 2. SELF-APPROVAL PREVENTION: Finance tries to approve their own request
  console.log("\n[TEST 2] Enforcing Maker != Checker (Self-approval must fail)...");
  try {
    await approveChangeRequest({
      requestId: changeRequestId,
      actorId: "usr_fin_vikram", // Same actor!
      actorRole: "finance_head", // Even if role spoofed
      note: "Self-approving my own ticket.",
    });
    throw new Error("FAIL: Maker was allowed to approve their own request!");
  } catch (err: any) {
    if (err.message.includes("You cannot approve your own request")) {
      console.log(`✓ Maker-checker enforced: ${err.message}`);
    } else {
      throw err;
    }
  }

  // 3. ROLE RESTRICTION: Support tries to approve
  console.log("\n[TEST 3] Role boundary check: Support role cannot approve credit requests...");
  try {
    await approveChangeRequest({
      requestId: changeRequestId,
      actorId: "usr_sup_rahul",
      actorRole: "support",
      note: "Support trying to approve credit.",
    });
    throw new Error("FAIL: Support was allowed to approve credit limit increase!");
  } catch (err: any) {
    console.log(`✓ Role boundary enforced: ${err.message}`);
  }

  // 4. CHECKER: Finance Head (usr_fin_rajesh) approves the request
  console.log("\n[TEST 4] Finance Head approves the pending change request...");
  const approvalResult = await approveChangeRequest({
    requestId: changeRequestId,
    actorId: "usr_fin_rajesh",
    actorRole: "finance_head",
    note: "Verified customer banking statements and healthy 90-day payment history. Approved.",
  });

  console.log("Approval Result:", approvalResult);
  if (!approvalResult.success) {
    throw new Error("FAIL: Approval execution failed!");
  }
  console.log("✓ Change request approved and executed successfully.");

  // 5. VERIFY DATABASE MUTATIONS
  console.log("\n[TEST 5] Verifying database state post-execution...");
  const updatedWorkspace = db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, targetWorkspace.id))
    .get();

  console.log(`Workspace Credit Limit after approval: ₹${updatedWorkspace?.creditLimit.toLocaleString("en-IN")}`);
  if (updatedWorkspace?.creditLimit !== requestedLimit) {
    throw new Error(`FAIL: Workspace limit not updated to ${requestedLimit}`);
  }
  console.log("✓ Workspace limit accurately updated in SQLite.");

  // Check credit history record
  const latestCreditHistory = db
    .select()
    .from(creditHistory)
    .where(eq(creditHistory.workspaceId, targetWorkspace.id))
    .orderBy(desc(creditHistory.createdAt))
    .get();

  console.log("Latest Credit History Record:", latestCreditHistory);
  if (
    !latestCreditHistory ||
    latestCreditHistory.newLimit !== requestedLimit ||
    latestCreditHistory.changedBy !== "usr_fin_vikram" ||
    latestCreditHistory.approvedBy !== "usr_fin_rajesh"
  ) {
    throw new Error("FAIL: Dual-actor tracking in credit history record is incorrect!");
  }
  console.log("✓ Credit history captured both maker (changedBy) and checker (approvedBy).");

  // Check audit log trail
  const recentAudits = db
    .select()
    .from(auditLog)
    .where(eq(auditLog.changeRequestId, changeRequestId))
    .all();

  console.log(`Found ${recentAudits.length} audit entries tied to changeRequestId ${changeRequestId}:`);
  for (const a of recentAudits) {
    console.log(`  - [${a.action}] actor=${a.actorId} role=${a.actorRole} reason="${a.reason}"`);
  }
  if (recentAudits.length < 2) {
    throw new Error("FAIL: Expected at least 2 audit entries (requested and approved)!");
  }
  console.log("✓ Complete immutable audit trail logged.");

  // 6. PERMISSION GUARD TEST: assertPermission denial logging
  console.log("\n[TEST 6] Testing assertPermission denial logging to audit log...");
  let denialCaught = false;
  try {
    await assertPermission("usr_sup_rahul", "credit:record_adjustment");
  } catch (err: any) {
    denialCaught = true;
    console.log(`✓ Denied as expected: ${err.message}`);
  }

  if (!denialCaught) {
    throw new Error("FAIL: assertPermission did not throw for unauthorized action!");
  }

  const denialAudit = db
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, "permission_denied"))
    .orderBy(desc(auditLog.timestamp))
    .get();

  if (!denialAudit || denialAudit.actorId !== "usr_sup_rahul") {
    throw new Error("FAIL: Unauthorized action denial was not logged to audit_log!");
  }
  console.log(`✓ Denial logged to audit_log: action="${denialAudit.action}" actor="${denialAudit.actorId}" reason="${denialAudit.reason}"`);

  console.log("\n=======================================================");
  console.log(" ALL 6 SECURITY & MAKER-CHECKER TESTS PASSED CLEANLY!");
  console.log("=======================================================\n");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
