export type InternalRole =
  | "account_manager"
  | "support"
  | "finance"
  | "sales_ops"
  | "compliance"
  | "finance_head"
  | "admin";

export interface RoleDefinition {
  id: InternalRole;
  label: string;
  department: string;
  description: string;
  badgeColor: string; // for chips
}

export const INTERNAL_ROLES: RoleDefinition[] = [
  {
    id: "account_manager",
    label: "Account Manager",
    department: "Sales & AM",
    description: "Owns customer portfolios, views account health, creates tasks, requests plan & discount changes under 10%.",
    badgeColor: "#7C7CFF", // Soft indigo
  },
  {
    id: "support",
    label: "Customer Support",
    department: "Support Engineering",
    description: "Troubleshoots tickets, investigates delivery issues, requests seat fixes & suspensions. Redacted on money & pricing.",
    badgeColor: "#EC4899", // Pink
  },
  {
    id: "finance",
    label: "Finance",
    department: "Finance & Accounting",
    description: "Manages invoices, credit lines, wallet top-ups & adjustments, issues invoices. Requests credit limit changes.",
    badgeColor: "#E0A93B", // Amber
  },
  {
    id: "sales_ops",
    label: "Sales Operations",
    department: "Operations",
    description: "Onboards accounts, assigns plans, applies discounts, manages add-ons, reviews KYC intake & DLT submissions.",
    badgeColor: "#8B5CF6", // Purple
  },
  {
    id: "compliance",
    label: "Compliance Officer",
    department: "Legal & Regulatory",
    description: "Approves/rejects MCA KYC cases, TRAI DLT sender IDs, message templates, views full immutable audit logs.",
    badgeColor: "#10B981", // Emerald
  },
  {
    id: "finance_head",
    label: "Finance Head",
    department: "Executive Finance",
    description: "Approves high-value credit limit hikes (>₹5L / >25%), manual wallet adjustments (>₹50k), and suspensions with outstanding dues.",
    badgeColor: "#D97706", // Dark amber
  },
  {
    id: "admin",
    label: "Platform Admin",
    department: "Leadership",
    description: "Full administrative governance, offboarding approvals, roles & policies management, full audit log exports.",
    badgeColor: "#9333EA", // Violet
  },
];

export function getRoleDefinition(role: InternalRole): RoleDefinition {
  return INTERNAL_ROLES.find((r) => r.id === role) || INTERNAL_ROLES[0];
}
