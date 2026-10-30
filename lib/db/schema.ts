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
    legalName: text("legal_name").notNull().default(""),
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
        "Other",
      ],
    }).notNull().default("Fintech"),
    city: text("city").notNull().default("Bengaluru"),
    ownerAmId: text("owner_am_id")
      .notNull()
      .default("usr_priya_sharma")
      .references(() => internalUsers.id),
    status: text("status", {
      enum: ["onboarding", "active", "at_risk", "suspended", "offboarded"],
    }).notNull().default("active"),
    billingModel: text("billing_model", { enum: ["prepaid", "postpaid"] }).notNull().default("prepaid"),
    planId: text("plan_id")
      .notNull()
      .default("plan_starter")
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
    organizationId: text("organization_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status", {
      enum: ["kyc_pending", "kyc_in_review", "active", "suspended"],
    }).notNull().default("active"),
    kycStatus: text("kyc_status", {
      enum: ["not_started", "in_review", "approved"],
    }).notNull().default("not_started"),
    senderIds: text("sender_ids").notNull().default("[]"), // JSON array
    planTier: text("plan_tier", {
      enum: ["sandbox", "growth", "enterprise"],
    }).notNull().default("sandbox"),
    rateLimitPerMin: integer("rate_limit_per_min").notNull().default(60),
    monthlyQuota: integer("monthly_quota").notNull().default(10000),
    walletBalance: real("wallet_balance").notNull().default(0), // for prepaid
    isAnonymous: integer("is_anonymous", { mode: "boolean" }).notNull().default(false),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    gstin: text("gstin").notNull().default("29ABCDE1234F1Z5"), // Valid Indian GSTIN format
    billingState: text("billing_state").notNull().default("Karnataka"), // Indian State
    creditLimit: real("credit_limit").notNull().default(0), // for postpaid
    creditUsed: real("credit_used").notNull().default(0), // for postpaid
    receiverBehavior: text("receiver_behavior").notNull().default("200"), // "200" | "500" | "401" | "timeout" | "verify_signature"
    accelerationFactor: integer("acceleration_factor").notNull().default(1), // 1 = normal, 12 = 1min -> 5sec
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    orgIdIdx: index("ws_org_id_idx").on(table.orgId),
    statusIdx: index("ws_status_idx").on(table.status),
    kycStatusIdx: index("ws_kyc_status_idx").on(table.kycStatus),
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
    feature: text("feature").notNull(), // "ask_docs", "generate_code", "explain_webhook", "health_summary", etc.
    userId: text("user_id"),
    workspaceId: text("workspace_id"),
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

// ---------------------------------------------------------------------------
// 22. Users (Customer developer portal accounts)
// ---------------------------------------------------------------------------
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // e.g. "usr_..."
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    company: text("company").notNull(),
    role: text("role", {
      enum: ["Backend dev", "Mobile dev", "Data/CDP", "Other"],
    }).notNull().default("Backend dev"),
    intent: text("intent", {
      enum: ["Evaluating Relay", "Already a Relay customer"],
    }).notNull().default("Evaluating Relay"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
  })
);

// ---------------------------------------------------------------------------
// 23. Sessions (Signed HTTP-only auth & evaluation tokens)
// ---------------------------------------------------------------------------
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // Session token or uuid
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    isAnonymous: integer("is_anonymous", { mode: "boolean" }).notNull().default(false),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    userIdIdx: index("sessions_user_idx").on(table.userId),
    wsIdIdx: index("sessions_ws_idx").on(table.workspaceId),
    expiresIdx: index("sessions_expires_idx").on(table.expiresAt),
  })
);

// ---------------------------------------------------------------------------
// 24. API Keys (Developer Hub credentials with scopes, rotation & lock)
// ---------------------------------------------------------------------------
export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(), // e.g. "key_test_..." or "key_live_..."
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(), // "rk_test_" or "rk_live_"
    hashedSecret: text("hashed_secret").notNull(),
    secretMasked: text("secret_masked").notNull(), // "rk_test_••••••••9a2f"
    fullKeyForDev: text("full_key_for_dev").notNull(), // For dev portal display & copy
    environment: text("environment", { enum: ["test", "live"] }).notNull().default("test"),
    scopes: text("scopes").notNull().default('["messages:send","events:write","profiles:read"]'), // JSON
    status: text("status", { enum: ["active", "revoked", "rotating"] }).notNull().default("active"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    rotatedFromId: text("rotated_from_id"),
    gracePeriodEndsAt: integer("grace_period_ends_at", { mode: "timestamp" }),
    ipAllowlist: text("ip_allowlist"), // Comma-separated list of allowed CIDRs/IPs
    createdBy: text("created_by"),
  },
  (table) => ({
    wsKeyIdx: index("ak_ws_idx").on(table.workspaceId),
    envIdx: index("ak_env_idx").on(table.environment),
    statusIdx: index("ak_status_idx").on(table.status),
  })
);

export const apiKeyAuditLogs = sqliteTable(
  "api_key_audit_logs",
  {
    id: text("id").primaryKey(), // "akal_..."
    keyId: text("key_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    action: text("action").notNull(), // 'created' | 'rotated' | 'revoked' | 'scope_changed' | 'grace_period_ended'
    actor: text("actor").notNull().default("developer"),
    details: text("details"), // JSON payload with diffs/metadata
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    keyIdx: index("akal_key_idx").on(table.keyId),
    wsIdx: index("akal_ws_idx").on(table.workspaceId),
    createdIdx: index("akal_created_idx").on(table.createdAt),
  })
);

export type ApiKeyAuditLog = typeof apiKeyAuditLogs.$inferSelect;
export type NewApiKeyAuditLog = typeof apiKeyAuditLogs.$inferInsert;

// ---------------------------------------------------------------------------
// 25. Webhook Endpoints
// ---------------------------------------------------------------------------
export const webhookEndpoints = sqliteTable(
  "webhook_endpoints",
  {
    id: text("id").primaryKey(), // e.g. "wh_..."
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    environment: text("environment", { enum: ["test", "live"] }).notNull().default("test"),
    events: text("events").notNull().default('["message.delivered","message.failed"]'), // JSON array
    signingSecret: text("signing_secret").notNull(), // "whsec_..."
    previousSigningSecret: text("previous_signing_secret"), // For secret rotation dual-signing
    secretRotationEndsAt: integer("secret_rotation_ends_at", { mode: "timestamp" }),
    status: text("status", { enum: ["active", "disabled", "failing"] }).notNull().default("active"),
    apiVersion: text("api_version").notNull().default("v2025-10-01"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  },
  (table) => ({
    wsWhIdx: index("whe_ws_idx").on(table.workspaceId),
    envWhIdx: index("whe_env_idx").on(table.environment),
    statusIdx: index("whe_status_idx").on(table.status),
  })
);

// ---------------------------------------------------------------------------
// 26. Webhook Events
// ---------------------------------------------------------------------------
export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: text("id").primaryKey(), // e.g. "whevt_..."
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    endpointId: text("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // e.g. "message.delivered", "customer.profile.updated"
    payload: text("payload").notNull(), // JSON
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    apiVersion: text("api_version").notNull().default("v2025-10-01"),
  },
  (table) => ({
    wsEvtIdx: index("whevt_ws_idx").on(table.workspaceId),
    epEvtIdx: index("whevt_ep_idx").on(table.endpointId),
  })
);

// ---------------------------------------------------------------------------
// 27. Webhook Deliveries (With attempts, raw headers, payload & error types)
// ---------------------------------------------------------------------------
export const webhookDeliveries = sqliteTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(), // e.g. "del_..."
    eventId: text("event_id")
      .notNull()
      .references(() => webhookEvents.id, { onDelete: "cascade" }),
    endpointId: text("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull().default(1),
    requestHeaders: text("request_headers").notNull().default("{}"), // JSON
    requestBody: text("request_body").notNull(),
    responseStatus: integer("response_status"),
    responseHeaders: text("response_headers"), // JSON
    responseBody: text("response_body"),
    durationMs: integer("duration_ms").notNull().default(100),
    errorType: text("error_type", {
      enum: [
        "none",
        "timeout",
        "connection_refused",
        "http_5xx",
        "http_4xx",
        "signature_rejected",
        "ssl_error",
      ],
    }).notNull().default("none"),
    status: text("status", {
      enum: ["success", "failed", "retrying", "abandoned"],
    }).notNull().default("success"),
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    attemptedAt: integer("attempted_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    nextRetryAt: integer("next_retry_at", { mode: "timestamp" }),
    replayOfId: text("replay_of_id"),
  },
  (table) => ({
    evtDeliveryIdx: index("whd_evt_idx").on(table.eventId),
    endpointDeliveryIdx: index("whd_ep_idx").on(table.endpointId),
    statusDeliveryIdx: index("whd_status_idx").on(table.status),
  })
);

// ---------------------------------------------------------------------------
// 28. API Requests (Real API request ledger with idempotency & billing)
// ---------------------------------------------------------------------------
export const apiRequests = sqliteTable(
  "api_requests",
  {
    id: text("id").primaryKey(), // e.g. "req_..."
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    keyId: text("key_id"),
    environment: text("environment", { enum: ["test", "live"] }).notNull().default("test"),
    method: text("method").notNull(), // GET, POST, PUT, DELETE
    path: text("path").notNull(), // e.g. "/v1/messages"
    status: integer("status").notNull(), // 200, 202, 400, 401, 422, 429, 500
    durationMs: integer("duration_ms").notNull().default(45),
    requestHeaders: text("request_headers"), // JSON
    requestBody: text("request_body"),
    responseBody: text("response_body"),
    idempotencyKey: text("idempotency_key"),
    errorCode: text("error_code"),
    requestId: text("request_id").notNull(),
    billedAmountWouldBe: real("billed_amount_would_be").notNull().default(0),
    billedAmountActual: real("billed_amount_actual").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    apiVersion: text("api_version").notNull().default("v2025-10-01"),
    ip: text("ip").notNull().default("127.0.0.1"),
  },
  (table) => ({
    wsReqIdx: index("ar_ws_idx").on(table.workspaceId),
    envReqIdx: index("ar_env_idx").on(table.environment),
    statusReqIdx: index("ar_status_idx").on(table.status),
    createdReqIdx: index("ar_created_idx").on(table.createdAt),
  })
);

// ---------------------------------------------------------------------------
// 29. Messages (SMS, RCS, WhatsApp message logs)
// ---------------------------------------------------------------------------
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(), // e.g. "msg_01JB..."
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    environment: text("environment", { enum: ["test", "live"] }).notNull().default("test"),
    channel: text("channel", { enum: ["sms", "rcs", "whatsapp"] }).notNull(),
    to: text("to").notNull(), // e.g. "+919876543210"
    recipient: text("recipient"), // synonym for compatibility
    senderId: text("sender_id").notNull().default("RELAYI"),
    templateId: text("template_id"),
    body: text("body").notNull(),
    status: text("status", {
      enum: ["queued", "sent", "delivered", "failed", "read"],
    }).notNull().default("delivered"),
    failureReason: text("failure_reason"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    deliveredAt: integer("delivered_at", { mode: "timestamp" }),
    externalRef: text("external_ref"),
    costWouldBe: real("cost_would_be").notNull().default(0),
    cost: real("cost").notNull().default(0),
  },
  (table) => ({
    wsMsgIdx: index("msg_ws_idx").on(table.workspaceId),
    envMsgIdx: index("msg_env_idx").on(table.environment),
    statusMsgIdx: index("msg_status_idx").on(table.status),
    channelMsgIdx: index("msg_channel_idx").on(table.channel),
  })
);

// ---------------------------------------------------------------------------
// 30. Customers Profiles (Customer Data Platform / CDP)
// ---------------------------------------------------------------------------
export const customersProfiles = sqliteTable(
  "customers_profiles",
  {
    id: text("id").primaryKey(), // e.g. "prf_..."
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    environment: text("environment", { enum: ["test", "live"] }).notNull().default("test"),
    externalId: text("external_id").notNull(), // Customer's CRM/App user id
    attributes: text("attributes").notNull().default("{}"), // JSON string
    traits: text("traits").notNull().default("{}"), // JSON string
    eventsCount: integer("events_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    wsProfileIdx: index("cp_ws_idx").on(table.workspaceId),
    externalIdIdx: index("cp_external_idx").on(table.workspaceId, table.externalId),
  })
);

// Alias for customerProfiles
export const customerProfiles = customersProfiles;

// ---------------------------------------------------------------------------
// 31. Events Ingested (CDP Event streams linked to customer profiles)
// ---------------------------------------------------------------------------
export const eventsIngested = sqliteTable(
  "events_ingested",
  {
    id: text("id").primaryKey(), // e.g. "evt_..."
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    environment: text("environment", { enum: ["test", "live"] }).notNull().default("test"),
    customerId: text("customer_id").references(() => customersProfiles.id, { onDelete: "set null" }),
    eventName: text("event_name").notNull(), // e.g. "order_placed", "cart_abandoned"
    properties: text("properties").notNull().default("{}"), // JSON
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    wsEventIdx: index("ei_ws_idx").on(table.workspaceId),
    nameIdx: index("ei_name_idx").on(table.eventName),
    custIdx: index("ei_cust_idx").on(table.customerId),
  })
);

// Alias for eventsLog
export const eventsLog = eventsIngested;

// ---------------------------------------------------------------------------
// 32. Changelog Entries (API versions, changes, deprecations & sunset dates)
// ---------------------------------------------------------------------------
export const changelogEntries = sqliteTable(
  "changelog_entries",
  {
    id: text("id").primaryKey(),
    version: text("version").notNull(), // "v2025-10-01", "v2025-01-15", "v2024-06-01"
    date: text("date").notNull(), // "2026-10-30"
    type: text("type", {
      enum: ["added", "changed", "deprecated", "removed", "fixed", "security"],
    }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    affectedEndpoints: text("affected_endpoints").notNull().default("[]"), // JSON array
    breaking: integer("breaking", { mode: "boolean" }).notNull().default(false),
    sunsetDate: text("sunset_date"),
  },
  (table) => ({
    versionIdx: index("cle_version_idx").on(table.version),
    typeIdx: index("cle_type_idx").on(table.type),
  })
);

// ---------------------------------------------------------------------------
// 33. API Versions
// ---------------------------------------------------------------------------
export const apiVersions = sqliteTable("api_versions", {
  id: text("id").primaryKey(), // "v2025-10-01", "v2025-01-15", "v2024-06-01"
  label: text("label").notNull(),
  status: text("status", {
    enum: ["current", "supported", "deprecated", "sunset"],
  }).notNull().default("supported"),
  releasedAt: text("released_at").notNull(),
  sunsetAt: text("sunset_at"),
});

// ---------------------------------------------------------------------------
// 34. Support Threads
// ---------------------------------------------------------------------------
export const supportThreads = sqliteTable(
  "support_threads",
  {
    id: text("id").primaryKey(), // "thr_..."
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    status: text("status", { enum: ["open", "waiting", "resolved"] }).notNull().default("open"),
    context: text("context").notNull().default("{}"), // JSON
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
    messages: text("messages").notNull().default("[]"), // JSON array of message objects
  },
  (table) => ({
    wsThreadIdx: index("st_ws_idx").on(table.workspaceId),
    statusThreadIdx: index("st_status_idx").on(table.status),
  })
);

// ---------------------------------------------------------------------------
// 35. Doc Chunks (For docs search & AI integration)
// ---------------------------------------------------------------------------
export const docChunks = sqliteTable(
  "doc_chunks",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    section: text("section").notNull(),
    content: text("content").notNull(),
    version: text("version").notNull().default("v2025-10-01"),
  },
  (table) => ({
    slugIdx: index("dc_slug_idx").on(table.slug),
    sectionIdx: index("dc_section_idx").on(table.section),
  })
);

// ---------------------------------------------------------------------------
// 36. Doc Feedback (Was this helpful? with optional comments)
// ---------------------------------------------------------------------------
export const docFeedback = sqliteTable(
  "doc_feedback",
  {
    id: text("id").primaryKey(),
    pagePath: text("page_path").notNull(),
    helpful: integer("helpful", { mode: "boolean" }).notNull(),
    comment: text("comment"),
    version: text("version").notNull().default("v2025-10-01"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    pageIdx: index("df_page_idx").on(table.pagePath),
  })
);

// ---------------------------------------------------------------------------
// 37. Changelog Subscriptions (Email me about breaking changes)
// ---------------------------------------------------------------------------
export const changelogSubscriptions = sqliteTable("changelog_subscriptions", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  subscribedBreakingChanges: integer("subscribed_breaking_changes", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ---------------------------------------------------------------------------
// 40. Solutions Inquiries (Enterprise & Evaluator contacts)
// ---------------------------------------------------------------------------
export const solutionsInquiries = sqliteTable("solutions_inquiries", {
  id: text("id").primaryKey(), // "inq_..."
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  monthlyVolume: text("monthly_volume").notNull(), // "< 100k", "100k - 1M", "1M - 10M", "10M+"
  channels: text("channels"), // JSON array e.g. ["sms", "whatsapp"]
  useCase: text("use_case"),
  status: text("status", { enum: ["new", "contacted", "qualified"] }).notNull().default("new"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ---------------------------------------------------------------------------
// 41. Usage Alert Preferences (Threshold & notification settings)
// ---------------------------------------------------------------------------
export const usageAlertPreferences = sqliteTable("usage_alert_preferences", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  threshold80: integer("threshold_80", { mode: "boolean" }).notNull().default(true),
  threshold95: integer("threshold_95", { mode: "boolean" }).notNull().default(true),
  spike429: integer("spike_429", { mode: "boolean" }).notNull().default(true),
  lowBalanceThreshold: real("low_balance_threshold").notNull().default(500),
  emailNotifications: integer("email_notifications", { mode: "boolean" }).notNull().default(true),
  notificationEmail: text("notification_email"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ---------------------------------------------------------------------------
// 42. Limit Elevation Requests
// ---------------------------------------------------------------------------
export const limitRequests = sqliteTable("limit_requests", {
  id: text("id").primaryKey(), // "lrq_..."
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  currentTier: text("current_tier").notNull(),
  requestedTps: integer("requested_tps").notNull(),
  reason: text("reason").notNull(),
  channels: text("channels"), // JSON array
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ---------------------------------------------------------------------------
// 43. System Incidents (For system status page /status)
// ---------------------------------------------------------------------------
export const incidents = sqliteTable("incidents", {
  id: text("id").primaryKey(), // "inc_..."
  title: text("title").notNull(),
  status: text("status", { enum: ["investigating", "identified", "monitoring", "resolved"] }).notNull().default("resolved"),
  impact: text("impact", { enum: ["none", "minor", "major", "critical"] }).notNull().default("none"),
  affectedComponents: text("affected_components").notNull().default("[]"), // JSON string array
  updates: text("updates").notNull().default("[]"), // JSON array of updates
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
});

// ---------------------------------------------------------------------------
// 44. Known Issues
// ---------------------------------------------------------------------------
export const knownIssues = sqliteTable("known_issues", {
  id: text("id").primaryKey(), // "iss_..."
  title: text("title").notNull(),
  component: text("component").notNull(),
  status: text("status", { enum: ["investigating", "workaround_available", "fix_in_progress", "resolved"] }).notNull().default("workaround_available"),
  description: text("description").notNull(),
  workaround: text("workaround"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

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

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type CustomerProfile = typeof customersProfiles.$inferSelect;
export type EventIngested = typeof eventsIngested.$inferSelect;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type ApiRequest = typeof apiRequests.$inferSelect;
export type ChangelogEntry = typeof changelogEntries.$inferSelect;
export type ApiVersion = typeof apiVersions.$inferSelect;
export type SupportThread = typeof supportThreads.$inferSelect;
export type DocChunk = typeof docChunks.$inferSelect;
export type DocFeedback = typeof docFeedback.$inferSelect;
export type ChangelogSubscription = typeof changelogSubscriptions.$inferSelect;
export type SolutionsInquiry = typeof solutionsInquiries.$inferSelect;
export type UsageAlertPreferences = typeof usageAlertPreferences.$inferSelect;
export type LimitRequest = typeof limitRequests.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type KnownIssue = typeof knownIssues.$inferSelect;
