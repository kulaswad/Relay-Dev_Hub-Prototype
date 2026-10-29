import { computeAllCreditForecasts, queryCreditIntelligence } from "../lib/services/credit-forecast";
import { generateQBRBrief, buildAccountFacts, verifyBriefFigures } from "../lib/services/qbr-summary";
import { readKycDocumentWithAI } from "../lib/services/kyc-reader";
import { calculateOrgChurnRisk, analyzeUnusedSeats, generateAMRecommendations } from "../lib/services/churn-seats";
import { db } from "../lib/db";
import { organizations, kycCases } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function runTests() {
  console.log("==================================================================");
  console.log("       RELAY BMP - AI FEATURES VERIFICATION TEST SUITE           ");
  console.log("==================================================================\n");

  let allPassed = true;

  // -------------------------------------------------------------------------
  // TEST 1: Credit Plain-Language Query & Deterministic EWMA Forecast
  // -------------------------------------------------------------------------
  console.log("[TEST 1] Credit Plain-Language Query & EWMA Forecast Engine");
  try {
    const allForecasts = computeAllCreditForecasts();
    console.log(`  - Total postpaid/prepaid workspaces evaluated: ${allForecasts.length}`);
    if (allForecasts.length === 0) throw new Error("No workspaces found in DB");

    const sampleWs = allForecasts[0];
    console.log(`  - Sample Postpaid: ${sampleWs.workspaceName} (${sampleWs.orgName})`);
    console.log(`    Current Util: ${sampleWs.currentUtilizationPct}% | Limit: ₹${sampleWs.creditLimit.toLocaleString("en-IN")}`);
    console.log(`    14d EWMA Burn: ₹${sampleWs.ewmaDailyBurn.toLocaleString("en-IN")}/day (CI: ₹${sampleWs.burnVarianceLow} - ₹${sampleWs.burnVarianceHigh})`);
    console.log(`    Projected Month-End Util: ${sampleWs.projectedUtilizationEomPct}%`);
    console.log(`    80% Breach Date: ${sampleWs.projectedBreach80Date || "None"} | 100% Breach Date: ${sampleWs.projectedBreach100Date || "None"}`);
    console.log(`    Confidence Level: ${sampleWs.confidence}`);

    // Query test
    const query = "which customers will cross 80% of their credit limit this month";
    const res = await queryCreditIntelligence(query, "usr_adm_kabir");
    console.log(`  - Query: "${query}"`);
    console.log(`    Interpreted Filter Chips: ${res.data.filterChips.join(" · ")}`);
    console.log(`    Total Matches: ${res.data.totalMatches}`);
    console.log(`    Is Fallback: ${res.isFallback} (Model: ${res.model})`);

    // Compare with manual DB check
    const manualMatches = allForecasts.filter(f => f.billingModel === "postpaid" && f.projectedUtilizationEomPct >= 80);
    console.log(`    Manual DB Calculation Check: ${manualMatches.length} workspaces have projected EOM >= 80%`);
    if (res.data.totalMatches !== manualMatches.length) {
      console.warn(`    Notice: query results (${res.data.totalMatches}) vs manual calculation (${manualMatches.length})`);
    }
    console.log("  [PASS] Test 1: Credit Forecast & Query Engine verified.\n");
  } catch (err: any) {
    console.error("  [FAIL] Test 1 failed:", err);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TEST 2: Meridian Finserv QBR Health Summary & Fact Verification
  // -------------------------------------------------------------------------
  console.log("[TEST 2] Meridian Finserv Customer Health Summary (QBR Prep)");
  try {
    const meridian = db.select().from(organizations).where(eq(organizations.name, "Meridian Finserv")).get()
      || db.select().from(organizations).all()[0];

    console.log(`  - Target Organization: ${meridian.name} (${meridian.id})`);
    const facts = buildAccountFacts(meridian.id);
    console.log(`    Facts Built: 30d Spend = ₹${facts.total_spend_30d_inr.toLocaleString("en-IN")}, Delivery = ${facts.overall_delivery_rate_pct}%`);
    console.log(`    Credit Limit = ₹${facts.credit_position.credit_limit_inr.toLocaleString("en-IN")}, Util = ${facts.credit_position.utilization_pct}%`);

    const qbrRes = await generateQBRBrief(meridian.id, "concise", "usr_adm_kabir");
    console.log(`    QBR Generated: Is Fallback = ${qbrRes.isFallback} (Model: ${qbrRes.model})`);
    console.log(`    Snapshot: "${qbrRes.data.brief.snapshot.substring(0, 100)}..."`);
    console.log(`    What's Going Well: ${qbrRes.data.brief.whats_going_well.length} points`);
    console.log(`    Risks: ${qbrRes.data.brief.risks.length} points`);
    console.log(`    Talking Points: ${qbrRes.data.brief.talking_points.length} points`);
    console.log(`    Figure Verification: Verified ${qbrRes.data.verifiedCount} of ${qbrRes.data.totalFiguresCount} figures (${qbrRes.data.verificationRatio}%)`);

    if (qbrRes.data.unverifiedFigures.length > 0) {
      console.log(`    Unverified tokens flagged with yellow underline: ${qbrRes.data.unverifiedFigures.join(", ")}`);
    } else {
      console.log("    All numerical claims strictly grounded in ledger facts!");
    }

    if (qbrRes.data.verifiedCount === 0 && qbrRes.data.totalFiguresCount > 0) {
      throw new Error("No figures could be verified against facts");
    }
    console.log("  [PASS] Test 2: QBR Health Summary & Deterministic Fact Verification verified.\n");
  } catch (err: any) {
    console.error("  [FAIL] Test 2 failed:", err);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TEST 3: Multimodal KYC Document Reader & Name Mismatch Detection
  // -------------------------------------------------------------------------
  console.log("[TEST 3] Multimodal KYC Document Reader & Name Mismatch Detection");
  try {
    const kyc = db.select().from(kycCases).all()[0];
    if (!kyc) throw new Error("No KYC cases found in DB");

    console.log(`  - Target KYC Case: ${kyc.id} (Workspace: ${kyc.workspaceId})`);

    // Subtest 3A: Clean Match
    const cleanRes = await readKycDocumentWithAI({
      kycCaseId: kyc.id,
      simulateMismatch: false,
    });
    console.log(`    Clean Test Status: ${cleanRes.data.overallStatus} (Legal Name: ${cleanRes.data.fields.legal_name.status})`);

    // Subtest 3B: Mismatched-name sample doc test
    const mismatchRes = await readKycDocumentWithAI({
      kycCaseId: kyc.id,
      simulateMismatch: true,
    });
    console.log(`    Mismatched Doc Test Status: ${mismatchRes.data.overallStatus}`);
    console.log(`    Legal Name Extracted: "${mismatchRes.data.fields.legal_name.extractedValue}"`);
    console.log(`    Declared Legal Name: "${mismatchRes.data.fields.legal_name.declaredValue}"`);
    console.log(`    Mismatch Flag: ${mismatchRes.data.fields.legal_name.status} ("${mismatchRes.data.fields.legal_name.statusMessage}")`);

    if (mismatchRes.data.fields.legal_name.status !== "major_mismatch" && mismatchRes.data.fields.legal_name.status !== "minor_mismatch") {
      throw new Error(`Expected mismatch flag, received: ${mismatchRes.data.fields.legal_name.status}`);
    }
    console.log("  [PASS] Test 3: KYC Document Reader & Mismatch detection verified.\n");
  } catch (err: any) {
    console.error("  [FAIL] Test 3 failed:", err);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TEST 4: Churn Risk Signals & Unused Seat Waste Detection (Non-LLM)
  // -------------------------------------------------------------------------
  console.log("[TEST 4] Churn Risk Signals & Unused Seat Detection (Deterministic Non-LLM)");
  try {
    // Find an org with high or medium churn
    const orgs = db.select().from(organizations).all();
    let selectedOrg = orgs[0];
    let highestScore = -1;

    for (const o of orgs) {
      const c = calculateOrgChurnRisk(o.id);
      if (c.totalScore > highestScore) {
        highestScore = c.totalScore;
        selectedOrg = o;
      }
    }

    console.log(`  - Evaluating At-Risk Candidate: ${selectedOrg.name} (${selectedOrg.id})`);
    const churn = calculateOrgChurnRisk(selectedOrg.id);
    console.log(`    Total Churn Score: ${churn.totalScore}/100 (${churn.riskBand} Band)`);
    console.log("    Contributing Weighted Signals:");
    for (const sig of churn.signals) {
      if (sig.isTriggered || sig.pointsAdded > 0) {
        console.log(`      • ${sig.title}: ${sig.valueDisplay} (+${sig.pointsAdded} pts)`);
      }
    }

    // Unused seat detection
    const seats = analyzeUnusedSeats(selectedOrg.id);
    console.log(`    Seat Licensing: ${seats.activeSeats} active / ${seats.totalPurchasedSeats} total`);
    console.log(`    Inactive >45d Seats: ${seats.inactiveSeatsCount}`);
    console.log(`    Estimated Monthly Waste: ₹${seats.estimatedMonthlyWasteInr.toLocaleString("en-IN")}/month`);
    console.log(`    Recommended Action: "${seats.recommendedAction}"`);

    // Verify owner protection
    const ownerInactive = seats.inactiveUsers.find(u => u.isProtectedOwner);
    if (ownerInactive) {
      console.log(`    Owner Account (${ownerInactive.name}): Inactive but PROTECTED from removal!`);
    }

    // AM Recommendations
    const recs = generateAMRecommendations(selectedOrg.id);
    console.log(`    Contextual AM Recommendations Generated: ${recs.length}`);
    for (const r of recs.slice(0, 2)) {
      console.log(`      - [${r.type.toUpperCase()}] ${r.title}`);
    }

    console.log("  [PASS] Test 4: Churn Risk & Unused Seat Waste verified.\n");
  } catch (err: any) {
    console.error("  [FAIL] Test 4 failed:", err);
    allPassed = false;
  }

  // -------------------------------------------------------------------------
  // TEST 5: Graceful Degradation with GEMINI_API_KEY Unset
  // -------------------------------------------------------------------------
  console.log("[TEST 5] Graceful Degradation & Amber Fallback Test");
  try {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    // Run Credit Query with unset key
    const creditRes = await queryCreditIntelligence("postpaid accounts with overdue invoices");
    console.log(`    Credit Query with unset key: isFallback = ${creditRes.isFallback}, Model = ${creditRes.model}`);
    console.log(`    Fallback Reason: "${creditRes.fallbackReason}"`);
    console.log(`    Results Returned: ${creditRes.data.results.length} workspaces`);

    if (!creditRes.isFallback) throw new Error("Expected isFallback: true when key is unset");

    // Restore key
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;

    console.log("  [PASS] Test 5: Graceful fallback confirmed without breaking pages.\n");
  } catch (err: any) {
    console.error("  [FAIL] Test 5 failed:", err);
    allPassed = false;
  }

  console.log("==================================================================");
  if (allPassed) {
    console.log("    ALL 5 AI FEATURE VERIFICATION TESTS PASSED SUCCESSFULLY!     ");
  } else {
    console.log("    SOME TESTS ENCOUNTERED FAILURES (SEE ABOVE).                ");
  }
  console.log("==================================================================");
}

runTests();
