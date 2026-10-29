import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// 1. Internal Users (Relay employees across roles)
// ---------------------------------------------------------------------------
export const internalUsers = sqliteTable("internal_users", {
  id: text("id").primaryKey(), // e.g. "usr_priya_sharma"
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", {
    enum: [
      "account_manager",
      "support",
      "finance",
      "sales_ops",
      "compliance",
      "finance_head",
      "admin",
    ],
  }).notNull(),
  avatarColor: text("avatar_color").notNull().default("#7C7CFF"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ---------------------------------------------------------------------------
// 2. Pricing Plans Catalog
// ---------------------------------------------------------------------------
export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(), // "plan_starter", "plan_growth", "plan_scale", "plan_enterprise"
  name: text("name").notNull(), // Starter, Growth, Scale, Enterprise
  billingModel: text("billing_model", { enum: ["prepaid", "postpaid", "both"] }).notNull().default("both"),
  baseFeeMonthly: real("base_fee_monthly").notNull().default(0), // INR
  includedSeats: integer("included_seats").notNull().default(3),
  perMessageRates: text("per_message_rates").notNull(), // JSON: { sms: 0.12, rcs: 0.20, whatsapp: 0.35 }
  throughputMps: integer("throughput_mps").notNull().default(50),
  features: text("features").notNull(), // JSON array of feature strings
  priceFloors: text("price_floors"), // JSON: { sms: 0.15, rcs: 0.24, whatsapp: 0.38 }
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ---------------------------------------------------------------------------
// 3. Organizations (Customer top-level entities)
// ---------------------------------------------------------------------------
export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(), // e.g. "org_meridian_finserv"
    name: text("name").notNull(),
    legalName: text("legal_name").notNull(),
    slug: text("slug").notNull().unique(),
    industry: text("industry", {
      enum: [
        "BFSI",
        "Insurance",
        "D2C",
        "Edtech",
        "Fintech",
        "Healthcare",
        "Travel",
        "Logistics",
      ],
    }).notNull(),
    city: text("city").notNull(),
    ownerAmId: text("owner_am_id")
      .notNull()
      .references(() => internalUsers.id),
    status: text("status", {
      enum: ["onboarding", "active", "at_risk", "suspended", "offboarded"],
    }).notNull().default("active"),
    billingModel: text("billing_model", { enum: ["prepaid", "postpaid"] }).notNull().default("prepaid"),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    contractStart: integer("contract_start", { mode: "timestamp" }),
    contractEnd: integer("contract_end", { mode: "timestamp" }),
    tags: text("tags"), // JSON array of tag strings
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    statusIdx: index("org_status_idx").on(table.status),
    ownerAmIdx: index("org_owner_am_idx").on(table.ownerAmId),
    billingModelIdx: index("org_billing_model_idx").on(table.billingModel),
  })
);

// ---------------------------------------------------------------------------
// 4. Workspaces (Operational units under Organizations)
// ---------------------------------------------------------------------------
export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(), // e.g. "ws_meridian_retail"
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status", {
      enum: ["kyc_pending", "kyc_in_review", "active", "suspended"],
    }).notNull().default("active"),
    gstin: text("gstin").notNull(), // Valid Indian GSTIN format
    billingState: text("billing_state").notNull(), // Indian State
    walletBalance: real("wallet_balance").notNull().default(0), // for prepaid
    creditLimit: real("credit_limit").notNull().default(0), // for postpaid
    creditUsed: real("credit_used").notNull().default(0), // for postpaid
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    orgIdIdx: index("ws_org_id_idx").on(table.orgId),
    statusIdx: index("ws_status_idx").on(table.status),
  })
);

// ---------------------------------------------------------------------------
// 5. Workspace Users & Seat Allocation
// ---------------------------------------------------------------------------
export const workspaceUsers = sqliteTable(
  "workspace_users",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    tier: text("tier", { enum: ["owner", "admin", "user", "custom"] }).notNull().default("user"),
    customRoleName: text("custom_role_name"),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
    seatActive: integer("seat_active", { mode: "boolean" }).notNull().default(true),
    isSeatPaid: integer("is_seat_paid", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    workspaceIdIdx: index("wu_workspace_id_idx").on(table.workspaceId),
  })
);

// ---------------------------------------------------------------------------
// 6. Subscriptions (Custom pricing and discounts per workspace)
// ---------------------------------------------------------------------------
export const subscriptions = sqliteTable("subscriptions", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  customPriceOverrides: text("custom_price_overrides"), // JSON: { sms: 0.10, rcs: 0.16 }
  discountPct: real("discount_pct").notNull().default(0),
  discountReason: text("discount_reason"),
  discountEndDate: integer("discount_end_date", { mode: "timestamp" }),
  effectiveFrom: integer("effective_from", { mode: "timestamp" }).notNull(),
});

// ---------------------------------------------------------------------------
// 7. Addon Catalog & Workspace Addons
// ---------------------------------------------------------------------------
export const addonCatalog = sqliteTable("addon_catalog", {
  id: text("id").primaryKey(), // "addon_extra_tps_50", "addon_seat", "addon_dedicated_number", "addon_priority_support"
  name: text("name").notNull(),
  type: text("type", { enum: ["one_time", "recurring"] }).notNull(),
  price: real("price").notNull(), // INR
});

export const workspaceAddons = sqliteTable(
  "workspace_addons",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    addonId: text("addon_id")
      .notNull()
      .references(() => addonCatalog.id),
    quantity: integer("quantity").notNull().default(1),
    status: text("status", { enum: ["active", "cancelled"] }).notNull().default("active"),
    startDate: integer("start_date", { mode: "timestamp" }).notNull(),
    endDate: integer("end_date", { mode: "timestamp" }),
  },
  (table) => ({
    wsAddonIdx: index("ws_addons_ws_idx").on(table.workspaceId),
  })
);

// ---------------------------------------------------------------------------
// 8. Daily Usage History (90 days history per workspace)
// ---------------------------------------------------------------------------
export const usageDaily = sqliteTable(
  "usage_daily",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // "YYYY-MM-DD"
    smsCount: integer("sms_count").notNull().default(0),
    rcsCount: integer("rcs_count").notNull().default(0),
    whatsappCount: integer("whatsapp_count").notNull().default(0),
    deliveredPct: real("delivered_pct").notNull().default(98.5),
    cost: real("cost").notNull().default(0), // Total INR burned on that date
  },
  (table) => ({
    wsDateIdx: uniqueIndex("ud_ws_date_unique_idx").on(table.workspaceId, table.date),
    dateIdx: index("ud_date_idx").on(table.date),
  })
);

// ---------------------------------------------------------------------------
// 9. Wallet Transactions (Prepaid Ledger)
// ---------------------------------------------------------------------------
export const walletTransactions = sqliteTable(
  "wallet_transactions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["topup", "usage", "adjustment", "refund"] }).notNull(),
    amount: real("amount").notNull(),
    balanceAfter: real("balance_after").notNull(),
    reference: text("reference"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    wsWalletIdx: index("wt_workspace_id_idx").on(table.workspaceId),
  })
);

// ---------------------------------------------------------------------------
// 10. Invoices (Postpaid Billing & Addon charges)
// ---------------------------------------------------------------------------
export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(), // e.g. "inv_2026_09_001"
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // e.g. "Sep 2026"
    amount: real("amount").notNull(), // Pre-tax INR
    gstAmount: real("gst_amount").notNull(), // 18% GST INR
    status: text("status", { enum: ["draft", "issued", "paid", "overdue", "disputed"] }).notNull().default("issued"),
    issuedAt: integer("issued_at", { mode: "timestamp" }).notNull(),
    dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    lineItems: text("line_items").notNull(), // JSON: [{ desc: string, quantity: number, amount: number }]
  },
  (table) => ({
    wsInvoiceIdx: index("inv_workspace_id_idx").on(table.workspaceId),
    statusIdx: index("inv_status_idx").on(table.status),
  })
);

// ---------------------------------------------------------------------------
// 11. Credit History (Audit of limit hikes and adjustments)
// ---------------------------------------------------------------------------
export const creditHistory = sqliteTable(
  "credit_history",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    oldLimit: real("old_limit").notNull(),
    newLimit: real("new_limit").notNull(),
    reason: text("reason").notNull(),
    changedBy: text("changed_by").notNull(),
    approvedBy: text("approved_by"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    wsCreditIdx: index("ch_workspace_id_idx").on(table.workspaceId),
  })
);

// ---------------------------------------------------------------------------
// 12. Support & Operation Tickets
// ---------------------------------------------------------------------------
export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(), // e.g. "tkt_1001"
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
    status: text("status", { enum: ["open", "in_progress", "waiting_on_customer", "resolved", "closed"] }).notNull().default("open"),
    category: text("category", {
      enum: ["billing", "dlt_compliance", "api_delivery", "credit_limit", "seat_dispute", "general"],
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgTicketIdx: index("tkt_org_id_idx").on(table.orgId),
    statusIdx: index("tkt_status_idx").on(table.status),
  })
);

// ---------------------------------------------------------------------------
// 13. KYC Cases (MCA & Indian Regulatory Compliance)
// ---------------------------------------------------------------------------
export const kycCases = sqliteTable(
  "kyc_cases",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["not_started", "submitted", "in_review", "needs_info", "approved", "rejected"],
    }).notNull().default("submitted"),
    submittedAt: integer("submitted_at", { mode: "timestamp" }),
    assignedTo: text("assigned_to").references(() => internalUsers.id),
    documents: text("documents"), // JSON: [{ type, filename, extractedData }]
    declaredData: text("declared_data"), // JSON: { legalName, gstin, pan, state, directorName }
    slaDueAt: integer("sla_due_at", { mode: "timestamp" }),
    notes: text("notes"),
  },
  (table) => ({
    wsKycIdx: index("kyc_workspace_id_idx").on(table.workspaceId),
    statusIdx: index("kyc_status_idx").on(table.status),
  })
);

// ---------------------------------------------------------------------------
// 14. Sender IDs (TRAI DLT Registered Headers)
// ---------------------------------------------------------------------------
export const senderIds = sqliteTable(
  "sender_ids",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    header: text("header").notNull(), // 6-char header e.g. "MRDFIN"
    channel: text("channel", { enum: ["sms", "rcs", "whatsapp"] }).notNull(),
    status: text("status", { enum: ["submitted", "in_review", "approved", "rejected"] }).notNull().default("submitted"),
    submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    rejectionReason: text("rejection_reason"),
  },
  (table) => ({
    wsSenderIdx: index("sid_workspace_id_idx").on(table.workspaceId),
    statusIdx: index("sid_status_idx").on(table.status),
  })
);

// ---------------------------------------------------------------------------
// 15. Message Templates (DLT registered content templates)
// ---------------------------------------------------------------------------
export const templates = sqliteTable(
  "templates",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category", { enum: ["transactional", "promotional", "service", "otp"] }).notNull(),
    body: text("body").notNull(),
    dltTemplateId: text("dlt_template_id"),
    status: text("status", { enum: ["submitted", "in_review", "approved", "rejected"] }).notNull().default("submitted"),
    submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    wsTemplateIdx: index("tmpl_workspace_id_idx").on(table.workspaceId),
  })
);

// ---------------------------------------------------------------------------
// 16. Change Requests (Dual Approval Queue)
// ---------------------------------------------------------------------------
export const changeRequests = sqliteTable(
  "change_requests",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    targetType: text("target_type", { enum: ["workspace", "organization"] }).notNull(),
    targetId: text("target_id").notNull(),
    payload: text("payload").notNull(), // JSON string of requested changes
    status: text("status", {
      enum: ["pending", "approved", "rejected", "cancelled", "executed"],
    }).notNull().default("pending"),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => internalUsers.id),
    approverRoleNeeded: text("approver_role_needed").notNull(),
    approvedBy: text("approved_by").references(() => internalUsers.id),
    reason: text("reason").notNull(),
    decisionNote: text("decision_note"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    decidedAt: integer("decided_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
  },
  (table) => ({
    statusIdx: index("cr_status_idx").on(table.status),
    targetIdx: index("cr_target_idx").on(table.targetType, table.targetId),
  })
);

// ---------------------------------------------------------------------------
// 17. Audit Log (Immutable system trail)
// ---------------------------------------------------------------------------
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    actorId: text("actor_id").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    orgId: text("org_id"),
    before: text("before"), // JSON
    after: text("after"), // JSON
    reason: text("reason").notNull(),
    changeRequestId: text("change_request_id").references(() => changeRequests.id),
    aiAssisted: integer("ai_assisted", { mode: "boolean" }).notNull().default(false),
    ip: text("ip").notNull().default("10.14.0.24"),
    prevHash: text("prev_hash"),
    hash: text("hash"),
    isDenied: integer("is_denied", { mode: "boolean" }).notNull().default(false),
  },
  (table) => ({
    timestampIdx: index("al_timestamp_idx").on(table.timestamp),
    targetIdx: index("al_target_idx").on(table.targetType, table.targetId),
    orgIdIdx: index("al_org_id_idx").on(table.orgId),
  })
);

// ---------------------------------------------------------------------------
// 18. AI Runs (Auditable Generative & Predictive AI Telemetry)
// ---------------------------------------------------------------------------
export const aiRuns = sqliteTable(
  "ai_runs",
  {
    id: text("id").primaryKey(),
    feature: text("feature", {
      enum: ["health_summary", "churn_prediction", "credit_forecast", "kyc_extraction"],
    }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => internalUsers.id),
    inputHash: text("input_hash").notNull(),
    output: text("output").notNull(), // JSON response string
    model: text("model").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    status: text("status", { enum: ["success", "failed", "fallback"] }).notNull(),
    accepted: integer("accepted", { mode: "boolean" }), // null = pending human review, true = accepted, false = edited/rejected
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    featureIdx: index("air_feature_idx").on(table.feature),
    userIdIdx: index("air_user_idx").on(table.userId),
  })
);

// ---------------------------------------------------------------------------
// 19. Tasks (Actionable internal items)
// ---------------------------------------------------------------------------
export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assignedTo: text("assigned_to")
      .notNull()
      .references(() => internalUsers.id),
    title: text("title").notNull(),
    source: text("source", { enum: ["manual", "ai_recommendation"] }).notNull().default("manual"),
    status: text("status", { enum: ["pending", "in_progress", "completed", "dismissed"] }).notNull().default("pending"),
    dueAt: integer("due_at", { mode: "timestamp" }),
  },
  (table) => ({
    orgTaskIdx: index("tsk_org_id_idx").on(table.orgId),
    assignedToIdx: index("tsk_assigned_to_idx").on(table.assignedTo),
    statusIdx: index("tsk_status_idx").on(table.status),
  })
);

// ---------------------------------------------------------------------------
// 20. Approval Policies (Maker-Checker Rules Table)
// ---------------------------------------------------------------------------
export const approvalPolicies = sqliteTable(
  "approval_policies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    actionType: text("action_type").notNull(),
    thresholdType: text("threshold_type", { enum: ["amount", "percentage", "boolean", "condition"] }).notNull(),
    thresholdValue: real("threshold_value"),
    approverRole: text("approver_role", {
      enum: ["finance_head", "finance", "compliance", "admin", "sales_ops"],
    }).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  }
);

// ---------------------------------------------------------------------------
// 21. System Alerts & Notifications (Proactive Credit & Balance Alerts)
// ---------------------------------------------------------------------------
export const alerts = sqliteTable(
  "alerts",
  {
    id: text("id").primaryKey(), // "alt_..."
    workspaceId: text("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" }),
    orgId: text("org_id")
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "credit_utilization_80", "credit_utilization_90", "prepaid_low_balance", "overdue_invoice", "simulated_usage"
    severity: text("severity", { enum: ["info", "warning", "critical"] }).notNull().default("warning"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    wsIdx: index("alerts_ws_idx").on(table.workspaceId),
    typeIdx: index("alerts_type_idx").on(table.type),
    createdIdx: index("alerts_created_idx").on(table.createdAt),
  })
);

// Types
export type InternalUser = typeof internalUsers.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceUser = typeof workspaceUsers.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type AddonCatalog = typeof addonCatalog.$inferSelect;
export type WorkspaceAddon = typeof workspaceAddons.$inferSelect;
export type UsageDaily = typeof usageDaily.$inferSelect;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type CreditHistory = typeof creditHistory.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type KycCase = typeof kycCases.$inferSelect;
export type SenderId = typeof senderIds.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type ChangeRequest = typeof changeRequests.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type AiRun = typeof aiRuns.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ApprovalPolicy = typeof approvalPolicies.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
