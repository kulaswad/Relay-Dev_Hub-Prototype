import Database from "better-sqlite3";
import path from "path";
import { writeAudit, verifyAuditIntegrity, isAuditVisibleToRole } from "../lib/services/audit";

async function runAuditIntegrityTests() {
  console.log("=================================================");
  console.log("  RELAY BMP: AUDIT LOG & HASH CHAIN TEST SUITE");
  console.log("=================================================\n");

  const dbPath = path.resolve(process.cwd(), "relay.db");
  const sqlite = new Database(dbPath);

  // --------------------------------------------------------------------------
  // TEST 1: Pristine Hash Chain Verification
  // --------------------------------------------------------------------------
  console.log("TEST 1: Verifying Pristine Audit Hash Chain...");
  const initialCheck = await verifyAuditIntegrity();
  console.log("  Verification Result:", {
    valid: initialCheck.valid,
    totalVerified: initialCheck.totalVerified,
    latestHash: `${initialCheck.latestHash?.substring(0, 20)}...`,
  });

  if (!initialCheck.valid) {
    throw new Error(`Expected pristine chain to be valid, but got: ${initialCheck.reason}`);
  }
  console.log(`  PASS: All ${initialCheck.totalVerified} seeded audit blocks cryptographically verified.`);

  // --------------------------------------------------------------------------
  // TEST 2: Append-Only Hash Chain Continuation
  // --------------------------------------------------------------------------
  console.log("\nTEST 2: Append-Only New Entry Hash Continuation...");
  const newAudit = await writeAudit({
    actorId: "usr_fin_vikram",
    actorRole: "finance",
    action: "credit_limit_increase",
    targetType: "workspace",
    targetId: "ws_meridian_finserv_sme",
    orgId: "org_meridian_finserv",
    before: { creditLimit: 2500000 },
    after: { creditLimit: 3500000 },
    reason: "Verification script testing cryptographic hash linkage for live operational event.",
    aiAssisted: true,
  });

  console.log(`  New Audit Record Written: ${newAudit.id}`);
  console.log(`  Linked prevHash: ${newAudit.prevHash?.substring(0, 20)}...`);
  console.log(`  Computed hash:   ${newAudit.hash?.substring(0, 20)}...`);

  if (newAudit.prevHash !== initialCheck.latestHash) {
    throw new Error(`Expected prevHash to equal previous latestHash ${initialCheck.latestHash}, got ${newAudit.prevHash}`);
  }
  console.log("  PASS: New entry correctly chained to previous latest block hash.");

  const postAppendCheck = await verifyAuditIntegrity();
  if (!postAppendCheck.valid || postAppendCheck.totalVerified !== initialCheck.totalVerified + 1) {
    throw new Error(`Expected ${initialCheck.totalVerified + 1} valid blocks, got ${postAppendCheck.totalVerified}`);
  }
  console.log(`  PASS: Audit chain now holds ${postAppendCheck.totalVerified} verified unbroken blocks.`);

  // --------------------------------------------------------------------------
  // TEST 3: Role-Based Audit Visibility Scoping
  // --------------------------------------------------------------------------
  console.log("\nTEST 3: Role-Based Visibility Checks...");
  const moneyEntry = {
    actorRole: "finance",
    action: "credit_limit_updated",
    targetType: "workspace",
    orgId: "org_meridian_finserv",
  };
  const ticketEntry = {
    actorRole: "support",
    action: "ticket_escalated",
    targetType: "ticket",
    orgId: "org_meridian_finserv",
  };

  // Compliance & Admin see all
  if (!isAuditVisibleToRole(moneyEntry, "admin") || !isAuditVisibleToRole(ticketEntry, "admin")) {
    throw new Error("Admin must see all audit entries!");
  }
  if (!isAuditVisibleToRole(moneyEntry, "compliance") || !isAuditVisibleToRole(ticketEntry, "compliance")) {
    throw new Error("Compliance must see all audit entries!");
  }
  console.log("  PASS: Admin and Compliance have full platform audit visibility.");

  // Finance sees money, but not tickets
  if (!isAuditVisibleToRole(moneyEntry, "finance")) {
    throw new Error("Finance must see money-related entries!");
  }
  if (isAuditVisibleToRole(ticketEntry, "support") === false) {
    throw new Error("Support must see ticket entries!");
  }
  if (isAuditVisibleToRole(moneyEntry, "support")) {
    throw new Error("Support must NOT see money entries!");
  }
  console.log("  PASS: Finance and Support properly restricted according to least privilege.");

  // AM sees assigned orgs
  const amAssigned = ["org_meridian_finserv"];
  if (!isAuditVisibleToRole(moneyEntry, "account_manager", amAssigned)) {
    throw new Error("AM must see entries for assigned accounts!");
  }
  if (isAuditVisibleToRole(moneyEntry, "account_manager", ["org_other"])) {
    throw new Error("AM must NOT see entries for non-assigned accounts!");
  }
  console.log("  PASS: Account Manager visibility scoped to assigned accounts.");

  // --------------------------------------------------------------------------
  // TEST 4: Direct SQLite Tampering Detection
  // --------------------------------------------------------------------------
  console.log("\nTEST 4: Tampering With Database Directly via SQLite...");
  const targetTamperId = "aud_1012";
  const originalRow = sqlite.prepare("SELECT * FROM audit_log WHERE id = ?").get(targetTamperId) as any;

  if (!originalRow) {
    throw new Error(`Row ${targetTamperId} not found in database!`);
  }
  console.log(`  Selected Target Block: #${originalRow.id} (Original Reason: "${originalRow.reason}")`);

  // Direct SQLite mutation bypassing service layer (simulating malicious database tampering)
  console.log(`  Executing malicious UPDATE directly on SQLite table:`);
  console.log(`    UPDATE audit_log SET reason = 'ATTACKER_UNAUTHORIZED_MUTATION' WHERE id = '${targetTamperId}'`);
  sqlite.prepare("UPDATE audit_log SET reason = 'ATTACKER_UNAUTHORIZED_MUTATION' WHERE id = ?").run(targetTamperId);

  console.log("  Running verifyAuditIntegrity() against tampered database...");
  const tamperedCheck = await verifyAuditIntegrity();

  console.log("  Tamper Check Result:", {
    valid: tamperedCheck.valid,
    brokenEntryId: tamperedCheck.brokenEntryId,
    index: tamperedCheck.index,
    reason: tamperedCheck.reason,
  });

  if (tamperedCheck.valid) {
    throw new Error("FAILED: Tampered row was NOT caught by hash chain verification!");
  }

  if (tamperedCheck.brokenEntryId !== targetTamperId) {
    throw new Error(`Expected brokenEntryId to be '${targetTamperId}', got '${tamperedCheck.brokenEntryId}'`);
  }

  console.log(`  PASS: Tampering caught successfully at exact block #${tamperedCheck.brokenEntryId}!`);

  // --------------------------------------------------------------------------
  // TEST 5: Restoration & Re-verification
  // --------------------------------------------------------------------------
  console.log("\nTEST 5: Restoring Original Value & Confirming Integrity Recovery...");
  sqlite.prepare("UPDATE audit_log SET reason = ? WHERE id = ?").run(originalRow.reason, targetTamperId);

  const restoredCheck = await verifyAuditIntegrity();
  if (!restoredCheck.valid) {
    throw new Error("Expected restored database to pass integrity verification!");
  }
  console.log(`  PASS: Integrity restored successfully. Chain valid with ${restoredCheck.totalVerified} blocks.`);

  sqlite.close();

  console.log("\n=================================================");
  console.log("   ALL AUDIT & CROSS-CUTTING TESTS PASSED!");
  console.log("=================================================");
}

runAuditIntegrityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  });
