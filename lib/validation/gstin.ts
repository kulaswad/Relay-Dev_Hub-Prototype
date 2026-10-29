export const INDIAN_STATE_GST_CODES: Record<string, string> = {
  Maharashtra: "27",
  Karnataka: "29",
  Delhi: "07",
  Gujarat: "24",
  "Tamil Nadu": "33",
  Haryana: "06",
  "West Bengal": "19",
  Telangana: "36",
  "Uttar Pradesh": "09",
  Rajasthan: "08",
  Kerala: "32",
};

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function validateGSTIN(gstin: string, stateName: string): { valid: boolean; error?: string } {
  const cleanGstin = gstin.trim().toUpperCase();
  if (cleanGstin.length !== 15) {
    return { valid: false, error: "GSTIN must be exactly 15 characters long." };
  }
  if (!GSTIN_REGEX.test(cleanGstin)) {
    return {
      valid: false,
      error: "Invalid Indian GSTIN structure (Format: 2-digit state code + 10-char PAN + 1 entity + 'Z' + 1 checksum).",
    };
  }
  const expectedStateCode = INDIAN_STATE_GST_CODES[stateName];
  if (expectedStateCode && !cleanGstin.startsWith(expectedStateCode)) {
    return {
      valid: false,
      error: `GSTIN state code prefix '${cleanGstin.substring(0, 2)}' does not match selected billing state '${stateName}' (Expected '${expectedStateCode}').`,
    };
  }
  return { valid: true };
}
