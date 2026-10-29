import { InternalRole } from "./roles";
import { PermissionAction, PERMISSION_MATRIX } from "./matrix";

export interface PermissionContext {
  isAssigned?: boolean;
  discountPct?: number;
  requesterId?: string;
  approverId?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

/**
 * Single typed source of truth for permission checks in Relay BMP.
 * Pure, client-safe function: can(role, action, context?)
 */
export function can(
  role: InternalRole,
  action: PermissionAction,
  context?: PermissionContext
): PermissionCheckResult {
  // Admin bypass: full access across the portal
  if (role === "admin") {
    // Maker-checker constraint still applies even to Admin when approving submissions!
    if (context?.requesterId && context?.approverId && context.requesterId === context.approverId) {
      return {
        allowed: false,
        reason: "Maker-Checker violation: The requester cannot approve their own submission.",
      };
    }
    return { allowed: true };
  }

  // Find explicit matrix rule
  const rule = PERMISSION_MATRIX.find((r) => r.action === action);
  if (!rule) {
    return { allowed: false, reason: "Undefined permission action." };
  }

  // Check if role is in allowed list
  if (!rule.allowedRoles.includes(role)) {
    return {
      allowed: false,
      reason: rule.requiredRoleName,
    };
  }

  // Context-specific business rules:
  // 1. Account Manager: assigned portfolio rule
  if (role === "account_manager") {
    if (context?.isAssigned === false && (action === "account:request_plan_change" || action === "tasks:create")) {
      return {
        allowed: false,
        reason: "Account Manager can only manage assigned portfolio accounts (read-only for others).",
      };
    }

    // 2. Discount under 10% allowed directly, above that triggers approval
    if (action === "account:request_discount" && typeof context?.discountPct === "number") {
      if (context.discountPct > 10) {
        return {
          allowed: true,
          requiresApproval: true,
          reason: "Discounts exceeding 10% require dual-approval review.",
        };
      }
    }
  }

  // 3. Maker-checker constraint for KYC & Approvals: requester cannot approve own request
  if (context?.requesterId && context?.approverId && context.requesterId === context.approverId) {
    return {
      allowed: false,
      reason: "Maker-Checker violation: You cannot approve your own submission.",
    };
  }

  return { allowed: true };
}
