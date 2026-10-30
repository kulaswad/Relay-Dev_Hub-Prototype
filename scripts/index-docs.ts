import { db } from "../lib/db";
import { docChunks } from "../lib/db/schema";
import { API_SPECIFICATION } from "../lib/docs/api-spec";
import { ERROR_REGISTRY } from "../lib/sandbox/errors";
import crypto from "crypto";

interface IndexDocItem {
  id: string;
  slug: string;
  title: string;
  section: string;
  content: string;
  version: string;
}

const GUIDES: IndexDocItem[] = [
  {
    id: "guide_overview",
    slug: "/docs",
    title: "Relay Developer Hub Overview",
    section: "Introduction",
    content: "Relay Developer Hub is the customer-facing developer portal for Relay, an Indian B2B SaaS platform that enables businesses to send omnichannel messages over SMS, RCS, and WhatsApp with automated TRAI DLT template validation, ingest behavioral events into unified CDP profiles, and query customer identity graphs.",
    version: "v2025-10-01",
  },
  {
    id: "guide_quickstart",
    slug: "/docs/quickstart",
    title: "15-Minute Interactive Quickstart",
    section: "Getting Started",
    content: "Go from sign-up to your first successful API call in under 15 minutes. Create a sandbox API key, send a transactional SMS OTP to test number +919999900001 with pre-approved template dlt_tmpl_otp_login, inspect real-time carrier delivery receipt, and verify webhook signatures.",
    version: "v2025-10-01",
  },
  {
    id: "guide_test_vs_live",
    slug: "/docs/test-vs-live",
    title: "Test vs Live Environments",
    section: "Getting Started",
    content: "Test environment uses rl_test_ keys with 0 INR tariffs, bypassed MCA KYC, and simulated carrier state transitions. Live production uses rl_live_ keys, debits wallet balance, strictly requires Indian MCA incorporation verification and TRAI DLT header approval, and enforces HTTPS for webhooks.",
    version: "v2025-10-01",
  },
  {
    id: "guide_auth",
    slug: "/docs/authentication",
    title: "API Authentication & Key Management",
    section: "Getting Started",
    content: "Authenticate all API calls using Authorization: Bearer rl_test_... or rl_live_... headers. Key secrets are hashed with SHA-256 and only shown once. Supports scoped permissions: messages:send, messages:read, events:write, customers:read, customers:write, webhooks:manage, usage:read. Supports 24-hour rotation grace periods and IP allowlists.",
    version: "v2025-10-01",
  },
  {
    id: "guide_first_message",
    slug: "/docs/first-message",
    title: "Sending Your First Message",
    section: "Getting Started",
    content: "Step-by-step tutorial for dispatching your first SMS OTP using POST /api/v1/messages, observing queued status transition to sent and delivered within 3 seconds, and polling /api/v1/messages/:id.",
    version: "v2025-10-01",
  },
  {
    id: "guide_sending_messages",
    slug: "/docs/guides/sending-messages",
    title: "Omnichannel Messaging (SMS/RCS/WhatsApp)",
    section: "Guides",
    content: "Send transactional and promotional communications across SMS, Google Jibe RCS, and Meta WhatsApp Business Cloud APIs with automated fallback, dynamic variable placeholder injection, and sender ID selection.",
    version: "v2025-10-01",
  },
  {
    id: "guide_templates_dlt",
    slug: "/docs/guides/templates-dlt",
    title: "Templates & Sender IDs (TRAI DLT Explained)",
    section: "Guides",
    content: "Comprehensive explanation of Telecom Regulatory Authority of India (TRAI TCCCPR 2018) regulations. Principal Entity (PE) registration, 6-character alphabetic Headers (ACMEPY, RELAYI), Content Template approvals with {#var#} placeholders, and hash verification.",
    version: "v2025-10-01",
  },
  {
    id: "guide_ingesting_events",
    slug: "/docs/guides/ingesting-events",
    title: "Ingesting Events & Building Customer Profiles",
    section: "Guides",
    content: "Real-time behavioral event streaming into Relay CDP identity graph via POST /api/v1/events. Identity stitching by external_id or customer_id, updating traits (total_events, last_seen, preferred_channel) and consent flags.",
    version: "v2025-10-01",
  },
  {
    id: "guide_reading_profiles",
    slug: "/docs/guides/reading-profiles",
    title: "Reading Customer Profiles",
    section: "Guides",
    content: "Query unified 360-degree customer records by internal Relay ID (prf_...) or external client user ID (ext_cust_...). Retrieve attributes, calculated behavioral traits, and channel consent opt-ins.",
    version: "v2025-10-01",
  },
  {
    id: "guide_delivery_status",
    slug: "/docs/guides/delivery-status",
    title: "Handling Delivery Status (DLR)",
    section: "Guides",
    content: "Telecom carrier delivery receipts, cellular circle codes (Karnataka, Mumbai, Delhi), operator timestamps (submitted, delivered), and carrier DLR codes (DELIVRD, UNDELIV_HANDSET_OFF, DND_BLOCKED_TRAI).",
    version: "v2025-10-01",
  },
  {
    id: "guide_webhooks",
    slug: "/docs/webhooks",
    title: "Webhooks Architecture & Verification",
    section: "Guides",
    content: "Real-time HTTP POST event dispatch with HMAC-SHA256 signature verification (Relay-Signature: t={timestamp},v1={hash}). Exponential backoff retry policy (1m, 5m, 30m, 2h, 6h, 12h), 300s clock drift replay tolerance, and zero-downtime dual-signing rotation.",
    version: "v2025-10-01",
  },
  {
    id: "guide_idempotency",
    slug: "/docs/guides/idempotency",
    title: "Idempotency & Replay Protection",
    section: "Guides",
    content: "Safe network retries using Idempotency-Key header. 24-hour cache preventing duplicate message dispatches or double wallet debits. Reusing key with different body returns 409 idempotency_conflict.",
    version: "v2025-10-01",
  },
  {
    id: "guide_pagination",
    slug: "/docs/guides/pagination",
    title: "Pagination & Cursor Traversal",
    section: "Guides",
    content: "Cursor-based pagination across list endpoints using starting_after and limit (1-100, default 20) query parameters. Safe and race-condition free under high concurrent ingest.",
    version: "v2025-10-01",
  },
  {
    id: "guide_limits",
    slug: "/docs/limits",
    title: "Rate Limits & Quotas",
    section: "Guides",
    content: "Sliding window rate limits per key. Returns X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers. Sandbox default 60 req/min, Growth tier 250 req/min, Enterprise custom TPS. Exceeding returns HTTP 429 rate_limit_exceeded.",
    version: "v2025-10-01",
  },
  {
    id: "guide_sandbox_testing",
    slug: "/docs/guides/sandbox-testing",
    title: "Testing in the Sandbox (Test Numbers Table)",
    section: "Guides",
    content: "Deterministic magic phone numbers: +919999900001 (Always Delivers), +919999900002 (Handset Unreachable 1.2s), +919999900003 (TRAI DND Active 1.0s), +919999900004 (Stays Sent / Lagging DLR), +919999900005 (Triggers HTTP 429 Rate Limit).",
    version: "v2025-10-01",
  },
  {
    id: "guide_compliance_kyc",
    slug: "/docs/compliance-guide",
    title: "Going Live (The Indian KYC Checklist)",
    section: "Guides",
    content: "Step-by-step checklist to unlock Live production keys: Ministry of Corporate Affairs (MCA) Certificate of Incorporation, valid State GSTIN verification, telecom DLT Principal Entity ID, and TRAI approved 6-character Headers.",
    version: "v2025-10-01",
  },
  {
    id: "guide_migrations",
    slug: "/docs/migrating-between-versions",
    title: "Migrating Between API Versions",
    section: "Guides",
    content: "Upgrading from deprecated v2024-06-01 to v2025-10-01. Parameter 'phone' renamed to 'to', status 'submitted' changed to 'queued', customer profile 'traits' dictionary added, mandatory HMAC Relay-Signature.",
    version: "v2025-10-01",
  },
  {
    id: "guide_compare_versions",
    slug: "/docs/compare-versions",
    title: "Compare API Versions",
    section: "Guides",
    content: "Side-by-side schema diff across v2025-10-01, v2025-01-15, and v2024-06-01 for all message, profile, event, and webhook endpoints.",
    version: "v2025-10-01",
  },
];

export async function indexDocs() {
  console.log("📚 Indexing documentation chunks into SQLite doc_chunks table...");

  const allChunks: IndexDocItem[] = [...GUIDES];

  // 1. Index API Endpoints from api-spec.ts
  for (const ep of API_SPECIFICATION) {
    const paramsList = ep.parameters.map((p) => `${p.name} (${p.in}, ${p.type}${p.required ? ", required" : ""}): ${p.description}`).join("; ");
    allChunks.push({
      id: `endpoint_${ep.id}`,
      slug: `/docs/endpoints/${ep.id}`,
      title: `${ep.method} ${ep.path} — ${ep.title}`,
      section: `API Reference: ${ep.section}`,
      content: `${ep.summary}. ${ep.description}. Required Scopes: ${ep.requiredScopes.join(", ") || "None"}. Parameters: ${paramsList}. Rate limit: ${ep.rateLimitNote || "Standard"}. Idempotency: ${ep.idempotencyNote || "Optional"}.`,
      version: "v2025-10-01",
    });
  }

  // 2. Index Error Catalogue from errors.ts
  for (const [code, def] of Object.entries(ERROR_REGISTRY)) {
    allChunks.push({
      id: `error_${code}`,
      slug: `/docs/errors#${code}`,
      title: `Error [${code}]: HTTP ${def.status} (${def.type})`,
      section: "Error Catalogue",
      content: `${def.message}. Meaning: ${def.description}. Common causes: ${def.commonCauses.join(", ")}. Remediation: ${def.howToFix.join(", ")}.`,
      version: "v2025-10-01",
    });
  }

  // Clear existing chunks and insert new ones
  await db.delete(docChunks);

  for (const chunk of allChunks) {
    await db.insert(docChunks).values({
      id: chunk.id,
      slug: chunk.slug,
      title: chunk.title,
      section: chunk.section,
      content: chunk.content,
      version: chunk.version,
    });
  }

  console.log(`✅ Successfully indexed ${allChunks.length} documentation chunks into 'doc_chunks' table!`);
  console.log(`   - Guides indexed: ${GUIDES.length}`);
  console.log(`   - Endpoints indexed: ${API_SPECIFICATION.length}`);
  console.log(`   - Error codes indexed: ${Object.keys(ERROR_REGISTRY).length}`);
}

indexDocs().catch((err) => {
  console.error("Failed to index docs:", err);
  process.exit(1);
});
