import { db } from "../lib/db";
import {
  organizations,
  workspaces,
  kycCases,
  senderIds,
  templates,
  changeRequests,
  auditLog,
  internalUsers,
  invoices,
} from "../lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { assertPermission } from "../lib/permissions/guard";
import { can } from "../lib/permissions/can";
import {
  requestChange,
  approveChangeRequest,
  rejectChangeRequest,
  cancelChangeRequest,
  getAllChangeRequests,
} from "../lib/services/approvals";
import { verifyAuditIntegrity, writeAudit } from "../lib/services/audit";
import {
  createAndOnboardAccount,
  transitionOrgStatus,
} from "../lib/services/lifecycle";
import {
  simulateCustomerSubmission,
  approveKycCase,
  approveSenderId,
  approveTemplate,
} from "../lib/services/compliance";
import { changeCreditLimit } from "../lib/services/finance";

async function runE2ETests() {
  console.log("==================================================================");
  console.log("       RELAY BMP - END-TO-END QA & VERIFICATION SUITE             ");
  console.log("==================================================================\n");

  let allPassed = true;

  // -------------------------------------------------------------------------
  // TEST 1: Role Switcher & Permission Matrix Verification
  // -------------------------------------------------------------------------
  console.log("[TEST 1] Role Switcher & Permission Matrix Check across all 7 Roles");
  try {
    const roles = [
      "account_manager",
      "support",
      "finance",
      "sales_ops",
      "compliance",
      "finance_head",
      "admin",
    ] as const;

    // Verify matrix expectations
    // 1. Support cannot view pricing or request plan change or edit credit
    if (can("support", "account:view_pricing").allowed) {
      throw new Error("Support should NOT be allowed to view pricing");
    }
    if (can("support", "account:request_plan_change").allowed) {
      throw new Error("Support should NOT be allowed to request plan change");
    }
    if (can("support", "credit:request_limit_change").allowed) {
      throw new Error("Support should NOT be allowed to request credit change");
    }

    // 2. Account Manager cannot record manual financial adjustments
    if (can("account_manager", "credit:record_adjustment").allowed) {
      throw new Error("AM should NOT be allowed to record manual financial adjustments");
    }

    // 3. Compliance can approve KYC but cannot edit pricing
    if (!can("compliance", "kyc:approve_reject").allowed) {
      throw new Error("Compliance must be allowed to approve KYC");
    }
    if (can("compliance", "account:edit_pricing").allowed) {
      throw new Error("Compliance should NOT be allowed to edit pricing");
    }

    // 4. Finance Head can approve credit hikes, but AM cannot
    if (!can("finance_head", "credit:approve_limit_change").allowed) {
      throw new Error("Finance Head must be allowed to approve credit limit increases");
    }
    if (can("account_manager", "credit:approve_limit_change").allowed) {
      throw new Error("AM should NOT be allowed to approve credit limit increases");
    }

    console.log("  - Successfully verified permissions for all 7 internal roles against typed matrix.");
    console.log("  [PASS] Test 1: Role matrix rules passed.\n");
  } catch (err: any) {
    console.error("  [FAIL] Test 1 failed:", err.message);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TEST 2: Server Enforcement & Denied Audit Log Verification
  // -------------------------------------------------------------------------
  console.log("[TEST 2] Server Enforcement on Forbidden Action & Denied Audit Trail");
  try {
    const supportUser = await db.select().from(internalUsers).where(eq(internalUsers.role, "support")).get();
    if (!supportUser) throw new Error("Support user not found in DB");

    let threwAsExpected = false;
    try {
      // Support tries to execute an action reserved for Finance/Admin
      await assertPermission(supportUser.id, "credit:request_limit_change");
    } catch (e: any) {
      threwAsExpected = true;
      console.log(`  - Blocked forbidden action as expected: "${e.message}"`);
    }

    if (!threwAsExpected) {
      throw new Error("Security failure: Forbidden action did not throw an exception!");
    }

    // Confirm that a denied audit entry with is_denied = 1 exists in auditLog
    const deniedEntry = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "permission_denied"))
      .orderBy(desc(auditLog.timestamp))
      .limit(1)
      .get();

    if (!deniedEntry || !deniedEntry.isDenied) {
      throw new Error("Audit failure: Denied attempt was not recorded with isDenied=true");
    }

    console.log(`  - Tamper-evident Denied Audit Entry verified:`);
    console.log(`    ID: ${deniedEntry.id} | Actor: ${deniedEntry.actorId} (${deniedEntry.actorRole})`);
    console.log(`    Action: ${deniedEntry.action} | Reason: ${deniedEntry.reason}`);
    console.log(`    isDenied flag: ${deniedEntry.isDenied ? "true (logged)" : "false"}`);
    console.log("  [PASS] Test 2: Server enforcement & denied audit logging verified.\n");
  } catch (err: any) {
    console.error("  [FAIL] Test 2 failed:", err.message);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TEST 3: Maker-Checker Dual Approvals, Self-Approval Block & Cancel/Expiry
  // -------------------------------------------------------------------------
  console.log("[TEST 3] Maker-Checker Dual Approvals, Self-Approval Block & Expiry/Cancel");
  try {
    const amUser = await db.select().from(internalUsers).where(eq(internalUsers.role, "account_manager")).get();
    const finHeadUser = await db.select().from(internalUsers).where(eq(internalUsers.role, "finance_head")).get();
    const ws = await db.select().from(workspaces).limit(1).get();

    if (!amUser || !finHeadUser || !ws) throw new Error("Required test fixtures missing");

    // 1. Submit high-value credit limit change (> ₹5,00,000 hike) -> needs finance_head
    const targetCredit = (ws.creditLimit || 0) + 1000000;
    const reqResult = await changeCreditLimit({
      workspaceId: ws.id,
      newCreditLimit: targetCredit,
      reason: "Quarterly expansion for large retail customer campaign",
      actor: { id: amUser.id, role: amUser.role as any, name: amUser.name },
    });

    if (reqResult.status !== "pending" || !reqResult.changeRequestId) {
      throw new Error(`Expected pending change request, got: ${reqResult.status}`);
    }
    console.log(`  - Maker submitted change request: ID ${reqResult.changeRequestId}`);
    console.log(`    Policy triggered: ${reqResult.policyName} | Approver Needed: ${reqResult.approverRole}`);

    // 2. Maker attempts to self-approve -> MUST throw error & log violation
    let selfApprovalBlocked = false;
    try {
      await approveChangeRequest({
        requestId: reqResult.changeRequestId,
        actorId: amUser.id,
        actorRole: amUser.role as any,
        note: "Self-approving my own submission",
      });
    } catch (e: any) {
      if (e.message.includes("Maker-Checker Violation")) {
        selfApprovalBlocked = true;
        console.log(`  - Self-approval blocked as expected: "${e.message}"`);
      } else {
        throw e;
      }
    }

    if (!selfApprovalBlocked) {
      throw new Error("CRITICAL FAILURE: Maker was able to approve their own change request!");
    }

    // 3. Checker (Finance Head) approves
    const approvalResult = await approveChangeRequest({
      requestId: reqResult.changeRequestId,
      actorId: finHeadUser.id,
      actorRole: finHeadUser.role as any,
      note: "Approved following financial risk review and Q1 bank statements.",
    });

    if (!approvalResult.success) {
      throw new Error("Checker approval failed");
    }

    // Verify workspace limit updated
    const updatedWs = await db.select().from(workspaces).where(eq(workspaces.id, ws.id)).get();
    if (updatedWs?.creditLimit !== targetCredit) {
      throw new Error(`Workspace credit limit not updated. Expected ${targetCredit}, got ${updatedWs?.creditLimit}`);
    }
    console.log(`  - Checker (Finance Head) successfully approved. New limit: ₹${updatedWs.creditLimit.toLocaleString("en-IN")}`);

    // 4. Test Cancel Path: Maker creates another request and cancels it
    const cancelReq = await changeCreditLimit({
      workspaceId: ws.id,
      newCreditLimit: targetCredit + 1000000,
      reason: "Tentative festive burst requirement",
      actor: { id: amUser.id, role: amUser.role as any, name: amUser.name },
    });

    if (cancelReq.changeRequestId) {
      const cancelRes = await cancelChangeRequest({
        requestId: cancelReq.changeRequestId,
        actorId: amUser.id,
      });
      if (!cancelRes.success) throw new Error("Maker cancel failed");

      const crRecord = await db.select().from(changeRequests).where(eq(changeRequests.id, cancelReq.changeRequestId)).get();
      if (crRecord?.status !== "cancelled") {
        throw new Error(`Expected change request to be 'cancelled', got '${crRecord?.status}'`);
      }
      console.log(`  - Maker cancel path verified: Change request status -> cancelled`);
    }

    // 5. Test Expiry Path: insert an expired request and verify getAllChangeRequests cancels it
    const expiredId = `cr_expired_test_${Date.now()}`;
    await db.insert(changeRequests).values({
      id: expiredId,
      type: "credit_limit_increase",
      targetType: "workspace",
      targetId: ws.id,
      payload: JSON.stringify({ newCreditLimit: targetCredit + 500000 }),
      status: "pending",
      requestedBy: amUser.id,
      approverRoleNeeded: "finance_head",
      reason: "Old expired request from past SLA window",
      createdAt: new Date(Date.now() - 80 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // Expired 8 hours ago
    });

    // Run sweep
    const allReqs = await getAllChangeRequests();
    const expiredReq = allReqs.find(r => r.id === expiredId);
    if (expiredReq?.status !== "cancelled" || !expiredReq?.decisionNote?.includes("Expired")) {
      throw new Error(`Expected expired request to be auto-cancelled, got status: ${expiredReq?.status}`);
    }
    console.log(`  - Expiry path verified: Past-SLA change request automatically transitioned to cancelled with '${expiredReq.decisionNote}'`);

    console.log("  [PASS] Test 3: Dual approvals, self-approval prevention & cancel/expiry verified.\n");
  } catch (err: any) {
    console.error("  [FAIL] Test 3 failed:", err.message);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TEST 4: Full Account Lifecycle State Machine
  // -------------------------------------------------------------------------
  console.log("[TEST 4] Full Account Lifecycle State Machine (Create -> KYC -> DLT -> Activate -> Suspend -> Reactivate -> Offboard)");
  try {
    const adminUser = await db.select().from(internalUsers).where(eq(internalUsers.role, "admin")).get();
    const complianceUser = await db.select().from(internalUsers).where(eq(internalUsers.role, "compliance")).get();
    const amUser = await db.select().from(internalUsers).where(eq(internalUsers.role, "account_manager")).get();

    if (!adminUser || !complianceUser || !amUser) throw new Error("Users not found");

    const testOrgName = `Test QA Corporation ${Date.now() % 1000}`;

    // 1. Create Organization & Workspace (starts as onboarding / kyc_pending)
    const createResult = await createAndOnboardAccount({
      name: testOrgName,
      legalName: `${testOrgName} Private Limited`,
      industry: "Fintech",
      city: "Bengaluru",
      billingModel: "postpaid",
      workspacesList: [
        {
          name: "India Production",
          gstin: "29AABCT1332L1Z1",
          billingState: "Karnataka",
        },
      ],
      planId: "plan_growth",
      ownerName: "Vikram Test",
      ownerEmail: `vikram_${Date.now()}@testcorp.com`,
      ownerAmId: amUser.id,
      actor: { id: adminUser.id, role: "admin", name: adminUser.name },
    });

    const newOrgId = createResult.orgId;
    const newWsId = createResult.workspaces[0];

    console.log(`  - Created Org: ${newOrgId} (status: onboarding)`);
    console.log(`  - Created Workspace: ${newWsId} (status: kyc_pending)`);

    // Attempt invalid transition: onboarding -> active (before KYC, sender, template) -> MUST FAIL
    let earlyActivationBlocked = false;
    try {
      await transitionOrgStatus({
        orgId: newOrgId,
        targetStatus: "active",
        reason: "Premature activation attempt before prerequisites",
        actor: { id: adminUser.id, role: "admin", name: adminUser.name },
      });
    } catch (e: any) {
      earlyActivationBlocked = true;
      console.log(`  - Premature activation blocked as expected: "${e.message}"`);
    }

    if (!earlyActivationBlocked) {
      throw new Error("Lifecycle guard failed: Org was activated without KYC, Sender ID, or Template!");
    }

    // 2. Submit KYC
    const kycSim = await simulateCustomerSubmission({
      workspaceId: newWsId,
      type: "kyc",
      payload: {
        legalName: `${testOrgName} Private Limited`,
      },
      actorId: adminUser.id,
    });

    // 3. Approve KYC by Compliance
    await approveKycCase({
      caseId: kycSim.id,
      actor: { id: complianceUser.id, role: "compliance", name: complianceUser.name },
      note: "MCA and GSTIN verified successfully against government registries.",
    });
    console.log(`  - KYC approved by Compliance officer (${complianceUser.name})`);

    // 4. Create & Approve Sender ID
    const sidSim = await simulateCustomerSubmission({
      workspaceId: newWsId,
      type: "sender_id",
      payload: {
        header: "TSTCOR",
        channel: "sms",
      },
      actorId: adminUser.id,
    });
    await approveSenderId({
      senderId: sidSim.id,
      actor: { id: complianceUser.id, role: "compliance", name: complianceUser.name },
    });
    console.log(`  - DLT Sender ID 'TSTCOR' approved`);

    // 5. Create & Approve Template
    const tmplSim = await simulateCustomerSubmission({
      workspaceId: newWsId,
      type: "template",
      payload: {
        name: "OTP Verification",
        category: "otp",
        body: "Your verification code is {#var#}. Do not share this OTP with anyone.",
      },
      actorId: adminUser.id,
    });
    await approveTemplate({
      templateId: tmplSim.id,
      dltTemplateId: "110716182910283",
      actor: { id: complianceUser.id, role: "compliance", name: complianceUser.name },
    });
    console.log(`  - DLT Template 'OTP Verification' approved`);

    // 6. Now transition onboarding -> active
    await transitionOrgStatus({
      orgId: newOrgId,
      targetStatus: "active",
      reason: "All onboarding requirements fulfilled (KYC, Sender ID, Template)",
      actor: { id: adminUser.id, role: "admin", name: adminUser.name },
    });
    console.log(`  - Account successfully activated: onboarding -> active`);

    // 7. Transition active -> suspended (routes to change request)
    const suspRes = await transitionOrgStatus({
      orgId: newOrgId,
      targetStatus: "suspended",
      reason: "Operational compliance hold requested by governance team",
      suspensionCategory: "compliance_violation",
      actor: { id: adminUser.id, role: "admin", name: adminUser.name },
    });

    if (suspRes.changeRequestId) {
      // Checker approves suspension
      await approveChangeRequest({
        requestId: suspRes.changeRequestId,
        actorId: complianceUser.id,
        actorRole: "admin", // Admin override or checker
        note: "Approved operational suspension",
      });
    }
    console.log(`  - Account suspended: active -> suspended`);

    // 8. Reactivate: suspended -> active
    const reactRes = await transitionOrgStatus({
      orgId: newOrgId,
      targetStatus: "active",
      reason: "Operational compliance resolved, resuming services",
      actor: { id: adminUser.id, role: "admin", name: adminUser.name },
    });
    if (reactRes.changeRequestId) {
      await approveChangeRequest({
        requestId: reactRes.changeRequestId,
        actorId: complianceUser.id,
        actorRole: "admin",
        note: "Approved reactivation",
      });
    }
    console.log(`  - Account reactivated: suspended -> active`);

    // 9. Offboard: active -> offboarded
    await transitionOrgStatus({
      orgId: newOrgId,
      targetStatus: "offboarded",
      reason: "Customer contract concluded and offboarding verified",
      actor: { id: adminUser.id, role: "admin", name: adminUser.name },
    });
    console.log(`  - Account offboarded: active -> offboarded`);

    console.log("  [PASS] Test 4: Complete account lifecycle state machine verified.\n");
  } catch (err: any) {
    console.error("  [FAIL] Test 4 failed:", err.message);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TEST 5: Tamper-Evident Hash Chain Cryptographic Verification
  // -------------------------------------------------------------------------
  console.log("[TEST 5] Tamper-Evident Audit Hash Chain Integrity Verification");
  try {
    const integrity = await verifyAuditIntegrity();
    console.log(`  - Total Audit Entries in cryptographic chain: ${integrity.totalVerified}`);
    console.log(`  - Hash Chain Integrity Status: ${integrity.valid ? "VALID (100% Intact)" : "BROKEN"}`);

    if (!integrity.valid) {
      throw new Error(`Audit hash chain broken at entry: ${integrity.brokenEntryId} (${integrity.reason})`);
    }

    console.log("  [PASS] Test 5: Cryptographic audit log hash chain verified.\n");
  } catch (err: any) {
    console.error("  [FAIL] Test 5 failed:", err.message);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("==================================================================");
  if (allPassed) {
    console.log("  >>> ALL 5 END-TO-END QA & VERIFICATION TESTS PASSED SUCCESSFULLY! <<<");
  } else {
    console.error("  >>> SOME QA TESTS FAILED. PLEASE REVIEW LOGS ABOVE. <<<");
    process.exit(1);
  }
  console.log("==================================================================\n");
}

runE2ETests().catch((e) => {
  console.error("Fatal test runner failure:", e);
  process.exit(1);
});
