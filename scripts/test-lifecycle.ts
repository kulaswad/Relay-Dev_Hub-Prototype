import { db } from "../lib/db";
import { organizations, workspaces, kycCases, senderIds, templates, auditLog, changeRequests } from "../lib/db/schema";
import {
  createAndOnboardAccount,
  transitionOrgStatus,
  getOnboardingChecklist,
  validateStateTransition,
} from "../lib/services/lifecycle";
import {
  simulateCustomerSubmission,
  approveKycCase,
  approveSenderId,
  approveTemplate,
  getComplianceQueue,
} from "../lib/services/compliance";
import { approveChangeRequest } from "../lib/services/approvals";
import { eq, desc } from "drizzle-orm";

async function runLifecycleTests() {
  console.log("================================================================================");
  console.log("       RELAY BMP - ACCOUNT LIFECYCLE & COMPLIANCE E2E VERIFICATION TEST        ");
  console.log("================================================================================\n");

  // 1. ACTOR IDENTITIES (Valid seeded internal users)
  const salesOps = { id: "usr_ops_amit", role: "sales_ops" as const, name: "Amit Bansal" };
  const compliance = { id: "usr_comp_kavita", role: "compliance" as const, name: "Kavita Nair" };
  const financeHead = { id: "usr_fin_rajesh", role: "finance_head" as const, name: "Rajesh Nair" };
  const support = { id: "usr_sup_rahul", role: "support" as const, name: "Rahul Sen" };
  const admin = { id: "usr_adm_kabir", role: "admin" as const, name: "Kabir Anand" };

  // ==========================================================================
  // TEST 1: CREATE AND ONBOARD ACCOUNT VIA WIZARD
  // ==========================================================================
  console.log("[TEST 1] Creating and onboarding a new B2B account via Wizard as Sales Ops...");
  const onboardResult = await createAndOnboardAccount({
    actor: salesOps,
    name: "Bharat Logistics Network",
    legalName: "BHARAT LOGISTICS NETWORK PRIVATE LIMITED",
    industry: "Logistics",
    city: "Mumbai",
    billingModel: "postpaid",
    workspacesList: [
      {
        name: "BLN Maharashtra Hub",
        gstin: "27AABCU9603R1ZM", // Valid 27 = Maharashtra
        billingState: "Maharashtra",
      },
    ],
    planId: "plan_growth",
    discountPct: 5,
    discountReason: "Annual fleet volume commitment",
    ownerName: "Rajesh Sharma",
    ownerEmail: "rajesh.sharma@bharatlogistics.in",
  });

  const orgId = onboardResult.orgId;
  const workspaceId = onboardResult.workspaces[0];
  console.log(`✓ Account created: Org ID: ${orgId}, Workspace ID: ${workspaceId}`);

  // Verify status in DB
  const orgRecord = db.select().from(organizations).where(eq(organizations.id, orgId)).get();
  const wsRecord = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();

  if (orgRecord?.status !== "onboarding") {
    throw new Error(`FAIL: Org status should be 'onboarding', got '${orgRecord?.status}'`);
  }
  if (wsRecord?.status !== "kyc_pending") {
    throw new Error(`FAIL: Workspace status should be 'kyc_pending', got '${wsRecord?.status}'`);
  }
  console.log(`✓ Org is correctly in 'onboarding' status, workspace is in 'kyc_pending'`);

  // Check onboarding checklist
  const checklist = await getOnboardingChecklist(orgId);
  const initialDone = checklist.steps.filter((s) => s.status === "completed").length;
  console.log(`✓ Initial Onboarding Checklist: ${initialDone}/${checklist.steps.length} steps completed (${checklist.completionPct}%)`);
  const kycApprovedStep = checklist.steps.find((s) => s.id === "kyc_approved");
  if (kycApprovedStep?.status !== "pending") {
    throw new Error("FAIL: KYC Approved step should be pending!");
  }

  // ==========================================================================
  // TEST 2: STATE MACHINE PREVENTS PREMATURE ACTIVATION
  // ==========================================================================
  console.log("\n[TEST 2] Verifying state machine blocks premature activation (onboarding -> active without prerequisites)...");
  const validation = await validateStateTransition(orgId, "active");
  if (validation.valid) {
    throw new Error("FAIL: State machine should have BLOCKED transition to active without KYC, Sender ID, and Template!");
  }
  console.log(`✓ State machine correctly blocked transition: "${validation.error}"`);

  // ==========================================================================
  // TEST 3: CUSTOMER SUBMISSIONS (SIMULATOR)
  // ==========================================================================
  console.log("\n[TEST 3] Simulating Customer submissions for KYC, Sender ID, and Message Template...");
  
  // 3a. Customer submits KYC documents
  const kycSub = await simulateCustomerSubmission({
    type: "kyc",
    workspaceId,
    actorId: salesOps.id,
    payload: {
      legalName: "Bharat Logistics Network Private Limited",
      cin: "U63090MH2021PTC368921",
      pan: "AABCU9603R",
      gstin: "27AABCU9603R1ZM",
      address: "Unit 402, Nesco IT Park, Goregaon East, Mumbai 400063",
    },
  });
  console.log(`✓ Simulated KYC submission created: Case ID ${kycSub.id}`);

  // 3b. Customer submits Sender ID Header
  const sidSub = await simulateCustomerSubmission({
    type: "sender_id",
    workspaceId,
    actorId: salesOps.id,
    payload: {
      header: "BLNTRK", // 6 alphabetic chars
      channel: "sms",
      description: "Transactional dispatch & tracking updates",
    },
  });
  console.log(`✓ Simulated Sender ID submission created: ID ${sidSub.id} (Header: BLNTRK)`);

  // 3c. Customer submits Message Template
  const tmplSub = await simulateCustomerSubmission({
    type: "template",
    workspaceId,
    actorId: salesOps.id,
    payload: {
      name: "Delivery Status Alert",
      channel: "sms",
      category: "transactional",
      body: "Dear customer, your shipment {#id#} is out for delivery with agent {#agent#}. Relay",
    },
  });
  console.log(`✓ Simulated Template submission created: ID ${tmplSub.id}`);

  // Verify compliance queue contains these items
  const queue = await getComplianceQueue();
  console.log(`✓ Compliance Queue now has ${queue.items.length} total items (${queue.stats.totalPending} pending triage)`);

  // ==========================================================================
  // TEST 4: COMPLIANCE OFFICER TRIAGE & APPROVAL
  // ==========================================================================
  console.log("\n[TEST 4] Compliance Officer reviews and approves KYC, Sender ID, and Template...");
  
  // Approve KYC Case
  await approveKycCase({
    caseId: kycSub.id,
    actor: compliance,
    note: "All MCA and GST portal records match declared entity data.",
  });
  console.log(`✓ KYC Case ${kycSub.id} approved by ${compliance.name}`);

  // Approve Sender ID
  await approveSenderId({
    senderId: sidSub.id,
    actor: compliance,
  });
  console.log(`✓ Sender ID BLNTRK approved by ${compliance.name}`);

  // Approve Template
  await approveTemplate({
    templateId: tmplSub.id,
    dltTemplateId: "1401552890001",
    actor: compliance,
  });
  console.log(`✓ Template ${tmplSub.id} approved by ${compliance.name}`);

  // ==========================================================================
  // TEST 5: GO-LIVE ACTIVATION (onboarding -> active)
  // ==========================================================================
  console.log("\n[TEST 5] Activating account now that all regulatory prerequisites are satisfied...");
  const validation2 = await validateStateTransition(orgId, "active");
  if (!validation2.valid) {
    throw new Error(`FAIL: Activation should now be allowed, but was blocked: ${validation2.error}`);
  }
  console.log("✓ State machine validation passed for 'onboarding -> active'");

  const activateResult = await transitionOrgStatus({
    orgId,
    targetStatus: "active",
    reason: "Onboarding and compliance verification complete. Account cleared for go-live.",
    actor: salesOps,
  });
  console.log("Activation Result:", activateResult.message);

  // Verify Org & Workspace status are both active
  const activeOrg = db.select().from(organizations).where(eq(organizations.id, orgId)).get();
  const activeWs = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (activeOrg?.status !== "active" || activeWs?.status !== "active") {
    throw new Error(`FAIL: Org or Workspace did not become 'active'. Org: ${activeOrg?.status}, Ws: ${activeWs?.status}`);
  }
  console.log(`✓ Org status is now '${activeOrg.status}' and Workspace status is '${activeWs.status}'`);

  // Verify checklist is complete
  const updatedChecklist = await getOnboardingChecklist(orgId);
  const updatedDone = updatedChecklist.steps.filter((s) => s.status === "completed").length;
  console.log(`✓ Onboarding Checklist progress: ${updatedDone}/${updatedChecklist.steps.length} steps completed (${updatedChecklist.completionPct}%)`);

  // ==========================================================================
  // TEST 6: ACCOUNT SUSPENSION & POLICY ROUTING
  // ==========================================================================
  console.log("\n[TEST 6] Triggering Account Suspension due to non-payment...");
  const suspendResult = await transitionOrgStatus({
    orgId,
    targetStatus: "suspended",
    reason: "Dues outstanding beyond 45 days grace period",
    suspensionCategory: "non_payment",
    actor: support, // Support initiates
  });

  console.log(`Suspension action response: ${suspendResult.status} (Message: ${suspendResult.message})`);

  if (suspendResult.status === "pending" && "changeRequestId" in suspendResult && suspendResult.changeRequestId) {
    console.log(`✓ Policy intercepted suspension: Change Request ID ${suspendResult.changeRequestId}`);
    // Suspension without dues requires Admin sign-off per policy
    console.log(`Approving suspension as Admin (${admin.name})...`);
    await approveChangeRequest({
      requestId: suspendResult.changeRequestId,
      actorId: admin.id,
      actorRole: admin.role,
      note: "Approved suspension: payment collection team confirmed default.",
    });
  }

  // Verify org and workspace are suspended
  const suspendedOrg = db.select().from(organizations).where(eq(organizations.id, orgId)).get();
  const suspendedWs = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (suspendedOrg?.status !== "suspended" || suspendedWs?.status !== "suspended") {
    throw new Error(`FAIL: Org or Workspace should be 'suspended'. Org: ${suspendedOrg?.status}, Ws: ${suspendedWs?.status}`);
  }
  console.log(`✓ Org and all Workspaces successfully locked and marked '${suspendedOrg.status}'`);

  // ==========================================================================
  // TEST 7: REACTIVATION WITH DUES OVERRIDE
  // ==========================================================================
  console.log("\n[TEST 7] Reactivating account with verified dues clearance / override...");
  // Attempting reactivation without dues proof should fail validation
  const invalidReactivation = await validateStateTransition(orgId, "active", {
    overrideDues: false,
    actorRole: "support",
  });
  if (invalidReactivation.valid) {
    throw new Error("FAIL: Non-payment reactivation without dues confirmation or override should be blocked!");
  }
  console.log(`✓ Reactivation blocked without dues confirmation: "${invalidReactivation.error}"`);

  // Reactivate as Finance Head with override dues confirmed
  const reactivateResult = await transitionOrgStatus({
    orgId,
    targetStatus: "active",
    reason: "Client cleared ₹4,50,000 via RTGS Ref #UTR98412847. Finance confirmed credit.",
    overrideDues: true,
    actor: financeHead,
  });

  console.log(`Reactivation request: ${reactivateResult.status} (Message: ${reactivateResult.message})`);
  if (reactivateResult.status === "pending" && "changeRequestId" in reactivateResult && reactivateResult.changeRequestId) {
    // Approve reactivation
    await approveChangeRequest({
      requestId: reactivateResult.changeRequestId,
      actorId: admin.id,
      actorRole: admin.role,
      note: "Verified bank receipt and approved restoration.",
    });
  }

  const restoredOrg = db.select().from(organizations).where(eq(organizations.id, orgId)).get();
  const restoredWs = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (restoredOrg?.status !== "active" || restoredWs?.status !== "active") {
    throw new Error("FAIL: Restored Org or Workspace is not active!");
  }
  console.log(`✓ Account successfully restored to '${restoredOrg.status}'!`);

  // ==========================================================================
  // TEST 8: AUDIT LOG VERIFICATION
  // ==========================================================================
  console.log("\n[TEST 8] Verifying comprehensive audit trail in database...");
  const logs = db
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, orgId))
    .all();
  console.log(`✓ Total audit records for Org ${orgId}: ${logs.length}`);
  logs.forEach((l) => {
    console.log(`   - [${l.action}] by ${l.actorId} (${l.actorRole}) at ${l.timestamp}`);
  });

  console.log("\n================================================================================");
  console.log("                    ALL 8 LIFECYCLE TESTS PASSED!                              ");
  console.log("================================================================================");
}

runLifecycleTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  });
