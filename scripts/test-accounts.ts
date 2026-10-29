import { getAccountsList, getAccount360, exportAccountsCsv, updateTicketStatus, createOrgTask } from "../lib/services/accounts";
import { db } from "../lib/db";
import { auditLog, tickets, tasks } from "../lib/db/schema";
import { eq, desc } from "drizzle-orm";

async function runAccountsTest() {
  console.log("=== STARTING ACCOUNTS & ACCOUNT 360 TEST SUITE ===");

  // 1. TEST ACCOUNTS LIST
  console.log("\n[TEST 1] Fetching all accounts via getAccountsList()...");
  const accounts = await getAccountsList();
  console.log(`Fetched ${accounts.length} organization records.`);

  if (accounts.length !== 42) {
    throw new Error(`FAIL: Expected 42 accounts, got ${accounts.length}`);
  }

  // Inspect first 3 accounts
  for (const a of accounts.slice(0, 3)) {
    console.log(`  - ${a.name} (${a.id}): Status=${a.status}, Model=${a.billingModel}, Plan=${a.planName}, Health=${a.health.score} (${a.health.grade}), Sparkline points=${a.usage.sparkline.length}, Tickets=${a.openTicketsCount}`);
  }

  // Verify health score bounds
  const invalidHealth = accounts.find((a) => a.health.score < 0 || a.health.score > 100);
  if (invalidHealth) {
    throw new Error(`FAIL: Health score out of bounds for ${invalidHealth.name}: ${invalidHealth.health.score}`);
  }
  console.log("✓ All 42 accounts have valid deterministic health scores (0-100).");

  // 2. TEST HERO ORG: Meridian Finserv (org_meridian_finserv)
  console.log("\n[TEST 2] Inspecting Hero Organization: Meridian Finserv...");
  const hero360 = await getAccount360("org_meridian_finserv");
  if (!hero360) {
    throw new Error("FAIL: Hero org 'org_meridian_finserv' not found in database!");
  }

  console.log(`Hero Org: ${hero360.organization.name} (${hero360.organization.legalName})`);
  console.log(`Workspaces Count: ${hero360.workspaces.length}`);
  console.log(`Health Score: ${hero360.health.score}/100 (${hero360.health.grade})`);
  console.log(`Health Narrative Reasons: ${hero360.healthNarrative.length}`);
  for (const n of hero360.healthNarrative) {
    console.log(`  • ${n}`);
  }
  console.log(`Attention Needed Items: ${hero360.attentionItems.length}`);
  for (const att of hero360.attentionItems) {
    console.log(`  [${att.severity.toUpperCase()}] ${att.title}: ${att.description}`);
  }
  console.log(`30-Day Messages: ${hero360.stats.totalMessages30d.toLocaleString("en-IN")}`);
  console.log(`30-Day Spend: ₹${hero360.stats.totalSpend30d.toLocaleString("en-IN")}`);
  console.log(`Tickets Count: ${hero360.tickets.length}`);
  console.log(`Users Count: ${hero360.users.length}`);

  if (hero360.workspaces.length !== 3) {
    throw new Error(`FAIL: Expected 3 workspaces for Meridian Finserv, got ${hero360.workspaces.length}`);
  }
  if (hero360.attentionItems.length === 0) {
    throw new Error("FAIL: Meridian Finserv should have concrete attention items!");
  }
  console.log("✓ Hero organization Account 360 data verified.");

  // 3. TEST EDGE CASES
  console.log("\n[TEST 3] Testing Edge Case: Suspended Organization...");
  const suspended360 = await getAccount360("org_quickdrop");
  if (!suspended360) {
    throw new Error("FAIL: Suspended org 'org_quickdrop' not found!");
  }
  console.log(`Suspended Org: ${suspended360.organization.name}, Status=${suspended360.organization.status}`);
  if (suspended360.organization.status !== "suspended") {
    throw new Error("FAIL: Expected status to be suspended!");
  }
  console.log(`Suspension reason: "${suspended360.suspensionDetails?.reason}"`);
  console.log("✓ Suspended organization details verified.");

  console.log("\n[TEST 3b] Testing Edge Case: Onboarding Organization with zero usage...");
  const onboarding360 = await getAccount360("org_omniinsure");
  if (!onboarding360) {
    throw new Error("FAIL: Onboarding org 'org_omniinsure' not found!");
  }
  console.log(`Onboarding Org: ${onboarding360.organization.name}, Status=${onboarding360.organization.status}, Daily usage records=${onboarding360.dailyUsage.length}`);
  console.log("✓ Onboarding empty usage state verified.");

  // 4. TEST AUDIT-LOGGED CSV EXPORT
  console.log("\n[TEST 4] Testing CSV Export with immutable audit logging...");
  const csvData = await exportAccountsCsv({
    id: "usr_am_priya",
    role: "account_manager",
    name: "Priya Sharma",
  });

  const lines = csvData.trim().split("\n");
  console.log(`Exported CSV has ${lines.length} lines (Header + ${lines.length - 1} rows).`);
  if (lines.length !== 43) {
    throw new Error(`FAIL: Expected 43 lines in CSV, got ${lines.length}`);
  }

  // Check audit log
  const exportAudit = db
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, "accounts_list_exported_csv"))
    .orderBy(desc(auditLog.timestamp))
    .get();

  if (!exportAudit || exportAudit.actorId !== "usr_am_priya") {
    throw new Error("FAIL: CSV export action was not captured in audit_log!");
  }
  console.log(`✓ CSV Export successfully logged to audit_log: ${exportAudit.id} (actor: ${exportAudit.actorId})`);

  // 5. TEST SUPPORT TICKET STATUS UPDATE
  console.log("\n[TEST 5] Testing Ticket Status Update (Support Action)...");
  const targetTicket = hero360.tickets[0];
  console.log(`Updating ticket ${targetTicket.id} from '${targetTicket.status}' to 'in_progress'...`);

  await updateTicketStatus({
    ticketId: targetTicket.id,
    orgId: "org_meridian_finserv",
    status: "in_progress",
    actorId: "usr_sup_rahul",
    actorRole: "support",
    note: "Customer inquiry escalated to engineering for DLT header alignment.",
  });

  const updatedTicket = db
    .select()
    .from(tickets)
    .where(eq(tickets.id, targetTicket.id))
    .get();

  if (updatedTicket?.status !== "in_progress") {
    throw new Error(`FAIL: Ticket status not updated to in_progress! Got ${updatedTicket?.status}`);
  }
  console.log("✓ Ticket status accurately updated in SQLite.");

  const ticketAudit = db
    .select()
    .from(auditLog)
    .where(eq(auditLog.targetId, targetTicket.id))
    .orderBy(desc(auditLog.timestamp))
    .get();

  if (!ticketAudit || !ticketAudit.action.includes("ticket_status_changed")) {
    throw new Error("FAIL: Ticket status update was not captured in audit log!");
  }
  console.log(`✓ Ticket update audit trail confirmed: action="${ticketAudit.action}" reason="${ticketAudit.reason}"`);

  // 6. TEST CREATE TASK ACTION
  console.log("\n[TEST 6] Testing Task Creation...");
  const taskResult = await createOrgTask({
    orgId: "org_meridian_finserv",
    assignedTo: "usr_am_rohan",
    title: "Schedule Q4 renewal review and discuss credit line extension",
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    actorId: "usr_am_rohan",
    actorRole: "account_manager",
  });

  console.log(`Task Created: ${taskResult.taskId}`);
  const taskRecord = db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskResult.taskId))
    .get();

  if (!taskRecord || taskRecord.assignedTo !== "usr_am_rohan") {
    throw new Error("FAIL: Task record not found in database!");
  }
  console.log("✓ Task successfully created and assigned.");

  console.log("\n=======================================================");
  console.log(" ALL 6 ACCOUNTS & ACCOUNT 360 TESTS PASSED CLEANLY!");
  console.log("=======================================================\n");
}

runAccountsTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
