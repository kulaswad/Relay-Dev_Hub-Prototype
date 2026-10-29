import { InternalRole } from "./roles";

export type PermissionAction =
  | "account:view_all"
  | "account:view_pricing"
  | "account:view_financials"
  | "account:create_or_onboard"
  | "account:request_plan_change"
  | "account:edit_plan"
  | "account:request_discount"
  | "account:edit_pricing"
  | "account:request_suspension"
  | "account:approve_suspension"
  | "account:request_offboarding"
  | "account:approve_offboarding"
  | "credit:view"
  | "credit:request_limit_change"
  | "credit:approve_limit_change"
  | "credit:record_adjustment"
  | "credit:approve_adjustment"
  | "invoice:view"
  | "invoice:issue_or_mark_paid"
  | "kyc:review_intake"
  | "kyc:approve_reject"
  | "sender_id:submit"
  | "sender_id:approve_reject"
  | "template:submit"
  | "template:approve_reject"
  | "tickets:view"
  | "tickets:manage"
  | "tasks:create"
  | "audit:view"
  | "audit:export"
  | "policies:manage"
  | "roles:manage"
  | "ai:generate_summary"
  | "ai:run_forecast";

export interface PermissionRule {
  action: PermissionAction;
  category: "Account & Lifecycle" | "Credit & Billing" | "Compliance & KYC" | "Support & Operations" | "Governance & AI";
  name: string;
  description: string;
  allowedRoles: InternalRole[];
  requiredRoleName: string; // Used for UI tooltips e.g. "Requires Finance Head"
}

export const PERMISSION_MATRIX: PermissionRule[] = [
  // --- Account & Lifecycle ---
  {
    action: "account:view_all",
    category: "Account & Lifecycle",
    name: "View All Customer Accounts",
    description: "Browse all customer organizations and workspaces across Relay.",
    allowedRoles: ["account_manager", "support", "finance", "sales_ops", "compliance", "finance_head", "admin"],
    requiredRoleName: "All Internal Roles",
  },
  {
    action: "account:view_pricing",
    category: "Account & Lifecycle",
    name: "View Rate Cards & Plan Pricing",
    description: "Inspect commercial contract rates, base fees, and per-message rates.",
    allowedRoles: ["account_manager", "finance", "sales_ops", "finance_head", "admin"],
    requiredRoleName: "Requires AM, Finance, or Sales Ops (Hidden for Support)",
  },
  {
    action: "account:view_financials",
    category: "Account & Lifecycle",
    name: "View Bank-Level Financial Internals",
    description: "Inspect ledger balances, bank payment references, and collection details.",
    allowedRoles: ["finance", "finance_head", "admin"],
    requiredRoleName: "Requires Finance or Finance Head",
  },
  {
    action: "account:create_or_onboard",
    category: "Account & Lifecycle",
    name: "Create & Onboard Organizations",
    description: "Create new organizations, setup workspaces, assign initial contracts.",
    allowedRoles: ["sales_ops", "admin"],
    requiredRoleName: "Requires Sales Operations or Admin",
  },
  {
    action: "account:request_plan_change",
    category: "Account & Lifecycle",
    name: "Request Plan Upgrade / Downgrade",
    description: "Submit request to move organization between Starter, Growth, Scale, and Enterprise.",
    allowedRoles: ["account_manager", "sales_ops", "admin"],
    requiredRoleName: "Requires Account Manager or Sales Ops",
  },
  {
    action: "account:edit_plan",
    category: "Account & Lifecycle",
    name: "Directly Execute Plan Change",
    description: "Directly modify subscribed plan without secondary approval.",
    allowedRoles: ["sales_ops", "admin"],
    requiredRoleName: "Requires Sales Operations or Admin",
  },
  {
    action: "account:request_discount",
    category: "Account & Lifecycle",
    name: "Request Contract Discount",
    description: "Apply discounts (<10% directly by AM, >10% triggers approval, >15% requires Admin).",
    allowedRoles: ["account_manager", "sales_ops", "admin"],
    requiredRoleName: "Requires Account Manager or Sales Ops",
  },
  {
    action: "account:edit_pricing",
    category: "Account & Lifecycle",
    name: "Edit Custom Rate Cards & Addons",
    description: "Directly apply custom per-message overrides and attach throughput addons.",
    allowedRoles: ["sales_ops", "admin"],
    requiredRoleName: "Requires Sales Operations or Admin",
  },
  {
    action: "account:request_suspension",
    category: "Account & Lifecycle",
    name: "Request Account Suspension",
    description: "Initiate account suspension due to non-payment, negative balance, or compliance breach.",
    allowedRoles: ["account_manager", "support", "finance", "sales_ops", "compliance", "finance_head", "admin"],
    requiredRoleName: "All Internal Roles",
  },
  {
    action: "account:approve_suspension",
    category: "Account & Lifecycle",
    name: "Approve Account Suspension",
    description: "Approve suspension (Finance Head required if postpaid outstanding dues exist; Admin otherwise).",
    allowedRoles: ["finance_head", "admin"],
    requiredRoleName: "Requires Finance Head or Admin",
  },
  {
    action: "account:request_offboarding",
    category: "Account & Lifecycle",
    name: "Request Customer Offboarding",
    description: "Initiate offboarding and workspace de-provisioning workflow.",
    allowedRoles: ["account_manager", "sales_ops", "admin"],
    requiredRoleName: "Requires Account Manager or Admin",
  },
  {
    action: "account:approve_offboarding",
    category: "Account & Lifecycle",
    name: "Approve Customer Offboarding",
    description: "Final authorization to offboard customer, delete credentials, and archive data.",
    allowedRoles: ["admin"],
    requiredRoleName: "Requires Platform Admin",
  },

  // --- Credit & Billing ---
  {
    action: "credit:view",
    category: "Credit & Billing",
    name: "View Credit Limits & Balances",
    description: "Inspect active postpaid credit limits, usage burn, and prepaid balances.",
    allowedRoles: ["account_manager", "finance", "sales_ops", "finance_head", "admin"],
    requiredRoleName: "Requires AM, Finance, or Sales Ops (Hidden for Support)",
  },
  {
    action: "credit:request_limit_change",
    category: "Credit & Billing",
    name: "Request Postpaid Credit Limit Hike",
    description: "Submit request to expand postpaid credit ceiling for an active workspace.",
    allowedRoles: ["account_manager", "finance", "sales_ops", "finance_head", "admin"],
    requiredRoleName: "Requires AM, Finance, or Sales Ops",
  },
  {
    action: "credit:approve_limit_change",
    category: "Credit & Billing",
    name: "Approve Credit Limit Hike",
    description: "Authorize credit limit increases (>₹5L or >25% mandates Finance Head).",
    allowedRoles: ["finance_head", "admin"],
    requiredRoleName: "Requires Finance Head or Admin",
  },
  {
    action: "credit:record_adjustment",
    category: "Credit & Billing",
    name: "Record Manual Wallet / Credit Adjustment",
    description: "Perform manual credit or debit adjustment on prepaid wallet or credit line.",
    allowedRoles: ["finance", "finance_head", "admin"],
    requiredRoleName: "Requires Finance or Finance Head",
  },
  {
    action: "credit:approve_adjustment",
    category: "Credit & Billing",
    name: "Approve High-Value Adjustment (>₹50,000)",
    description: "Authorize wallet balance adjustments exceeding ₹50,000 threshold.",
    allowedRoles: ["finance_head", "admin"],
    requiredRoleName: "Requires Finance Head or Admin",
  },
  {
    action: "invoice:view",
    category: "Credit & Billing",
    name: "View Invoices & Status",
    description: "Browse issued, paid, overdue, and disputed invoices.",
    allowedRoles: ["account_manager", "finance", "finance_head", "admin"],
    requiredRoleName: "Requires Finance or Account Manager (Hidden for Support)",
  },
  {
    action: "invoice:issue_or_mark_paid",
    category: "Credit & Billing",
    name: "Issue & Settle Invoices",
    description: "Generate new monthly invoices, settle disputed invoices, mark invoices paid.",
    allowedRoles: ["finance", "finance_head", "admin"],
    requiredRoleName: "Requires Finance or Finance Head",
  },

  // --- Compliance & KYC ---
  {
    action: "kyc:review_intake",
    category: "Compliance & KYC",
    name: "Review KYC Documents Intake",
    description: "Examine submitted GST registration, PAN cards, and incorporation certificates.",
    allowedRoles: ["sales_ops", "compliance", "admin"],
    requiredRoleName: "Requires Sales Ops or Compliance",
  },
  {
    action: "kyc:approve_reject",
    category: "Compliance & KYC",
    name: "Approve or Reject KYC Cases",
    description: "Verify legal business legitimacy against MCA & GST. Maker-checker enforced.",
    allowedRoles: ["compliance", "admin"],
    requiredRoleName: "Requires Compliance Officer or Admin",
  },
  {
    action: "sender_id:submit",
    category: "Compliance & KYC",
    name: "Submit DLT Sender IDs",
    description: "Submit 6-character TRAI DLT headers for telecom registration.",
    allowedRoles: ["sales_ops", "account_manager", "admin"],
    requiredRoleName: "Requires Sales Ops or AM",
  },
  {
    action: "sender_id:approve_reject",
    category: "Compliance & KYC",
    name: "Approve or Reject DLT Sender IDs",
    description: "Validate Principal Entity ID and telecom header binding.",
    allowedRoles: ["compliance", "admin"],
    requiredRoleName: "Requires Compliance Officer or Admin",
  },
  {
    action: "template:submit",
    category: "Compliance & KYC",
    name: "Submit Message Templates",
    description: "Submit transactional, OTP, and service message templates.",
    allowedRoles: ["sales_ops", "account_manager", "admin"],
    requiredRoleName: "Requires Sales Ops or AM",
  },
  {
    action: "template:approve_reject",
    category: "Compliance & KYC",
    name: "Approve or Reject Templates",
    description: "Verify template matches TRAI DLT registered template ID.",
    allowedRoles: ["compliance", "admin"],
    requiredRoleName: "Requires Compliance Officer or Admin",
  },

  // --- Support & Operations ---
  {
    action: "tickets:view",
    category: "Support & Operations",
    name: "View Support Tickets",
    description: "Browse operational, delivery, and billing support tickets.",
    allowedRoles: ["account_manager", "support", "finance", "sales_ops", "compliance", "finance_head", "admin"],
    requiredRoleName: "All Internal Roles",
  },
  {
    action: "tickets:manage",
    category: "Support & Operations",
    name: "Update & Resolve Tickets",
    description: "Change priority, assign tickets, add updates, resolve customer issues.",
    allowedRoles: ["support", "account_manager", "admin"],
    requiredRoleName: "Requires Support or Account Manager",
  },
  {
    action: "tasks:create",
    category: "Support & Operations",
    name: "Create Internal Follow-up Tasks",
    description: "Assign review tasks to AMs, Finance, or Compliance colleagues.",
    allowedRoles: ["account_manager", "sales_ops", "finance_head", "admin"],
    requiredRoleName: "Requires Account Manager or Admin",
  },

  // --- Governance & AI ---
  {
    action: "audit:view",
    category: "Governance & AI",
    name: "View System Audit Trail",
    description: "Inspect immutable audit log of who made which change and why.",
    allowedRoles: ["compliance", "finance", "finance_head", "admin"],
    requiredRoleName: "Requires Compliance, Finance, or Admin",
  },
  {
    action: "audit:export",
    category: "Governance & AI",
    name: "Export Audit Logs",
    description: "Download full audit trail CSV/JSON for regulatory or security audits.",
    allowedRoles: ["compliance", "admin"],
    requiredRoleName: "Requires Compliance or Admin",
  },
  {
    action: "policies:manage",
    category: "Governance & AI",
    name: "Manage Approval Policies",
    description: "Configure maker-checker approval thresholds and required roles.",
    allowedRoles: ["admin"],
    requiredRoleName: "Requires Platform Admin",
  },
  {
    action: "roles:manage",
    category: "Governance & AI",
    name: "Inspect Roles & Permissions",
    description: "Inspect the organization security permission matrix and role mappings.",
    allowedRoles: ["admin"],
    requiredRoleName: "Requires Platform Admin",
  },
  {
    action: "ai:generate_summary",
    category: "Governance & AI",
    name: "Generate AI Customer Health Summaries",
    description: "Invoke Google Gemini to synthesize account health, churn risks, and KPIs.",
    allowedRoles: ["account_manager", "sales_ops", "finance_head", "admin"],
    requiredRoleName: "Requires Account Manager, Sales Ops, or Admin",
  },
  {
    action: "ai:run_forecast",
    category: "Governance & AI",
    name: "Run Predictive Credit & Churn Forecasts",
    description: "Run 14-day EWMA credit ceiling forecasting and cohort churn predictors.",
    allowedRoles: ["finance", "finance_head", "admin"],
    requiredRoleName: "Requires Finance or Finance Head",
  },
];
