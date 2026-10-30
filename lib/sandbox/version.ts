export const API_VERSIONS = {
  CURRENT: "v2025-10-01",
  SUPPORTED: ["v2025-10-01", "v2025-01-15"],
  DEPRECATED: ["v2024-06-01"],
  SUNSET: ["v2023-01-01"],
};

export function normalizeVersion(rawVersion?: string | null): string {
  if (!rawVersion) return API_VERSIONS.CURRENT;
  const trimmed = rawVersion.trim();
  if (trimmed.startsWith("v")) return trimmed;
  return `v${trimmed}`;
}

export function validateApiVersion(rawVersion?: string | null): {
  valid: boolean;
  version: string;
  status: "current" | "supported" | "deprecated" | "sunset" | "unknown";
  warning?: string;
} {
  const version = normalizeVersion(rawVersion);

  if (version === API_VERSIONS.CURRENT) {
    return { valid: true, version, status: "current" };
  }

  if (API_VERSIONS.SUPPORTED.includes(version)) {
    return { valid: true, version, status: "supported" };
  }

  if (API_VERSIONS.DEPRECATED.includes(version)) {
    return {
      valid: true,
      version,
      status: "deprecated",
      warning: `API version ${version} is deprecated and will sunset on 2026-12-31. Please upgrade to ${API_VERSIONS.CURRENT}.`,
    };
  }

  if (API_VERSIONS.SUNSET.includes(version)) {
    return { valid: false, version, status: "sunset" };
  }

  return { valid: false, version, status: "unknown" };
}
