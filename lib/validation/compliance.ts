export const DLT_BLOCKED_HEADERS = [
  "HDFCBK",
  "ICICIB",
  "SBININ",
  "GOOGLE",
  "AMAZON",
  "RELAYB",
  "AIRTEL",
  "JIOCOM",
  "PAYTMN",
  "INFOSY",
  "AADHAR",
  "GOVTIN",
  "POLICE",
  "INCOME",
];

export const TEMPLATE_PROHIBITED_WORDS = [
  "lottery",
  "win cash guaranteed",
  "crypto free",
  "double your money",
  "casino jackpot",
  "viagra",
];

/**
 * Validates TRAI DLT Sender ID Header
 */
export function validateSenderIdHeader(header: string): { valid: boolean; error?: string } {
  const clean = header.trim().toUpperCase();
  if (clean.length !== 6) {
    return { valid: false, error: "TRAI DLT headers must be exactly 6 alphabetic characters." };
  }
  if (!/^[A-Z]{6}$/.test(clean)) {
    return { valid: false, error: "TRAI DLT headers must contain only letters (A-Z), no numbers or symbols." };
  }
  if (DLT_BLOCKED_HEADERS.includes(clean)) {
    return { valid: false, error: `Brand Impersonation Blocklist: Header '${clean}' is reserved and prohibited.` };
  }
  return { valid: true };
}

/**
 * Auto-checks DLT template content
 */
export function inspectTemplateContent(body: string, category: string): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const lower = body.toLowerCase();

  // Check for variable marker
  const hasVariable = /\{#[^#]+#\}|\{\{[^}]+\}\}/.test(body);
  if (!hasVariable) {
    warnings.push("Variable Marker Missing: Templates typically require at least one variable (e.g. {#var#} or {{otp}}).");
  }

  // Promotional opt-out check
  if (category === "promotional") {
    const hasOptOut = lower.includes("stop") || lower.includes("opt out") || lower.includes("opt-out");
    if (!hasOptOut) {
      warnings.push("TRAI Mandate Warning: Promotional templates require an explicit opt-out instruction (e.g. 'To opt out send STOP').");
    }
  }

  // Prohibited words check
  for (const word of TEMPLATE_PROHIBITED_WORDS) {
    if (lower.includes(word)) {
      warnings.push(`Prohibited Term Flagged: Body contains high-spam keyword '${word}'.`);
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
