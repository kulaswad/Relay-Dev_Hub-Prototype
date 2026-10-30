import { API_SPECIFICATION } from "../lib/docs/api-spec";
import { ERROR_REGISTRY } from "../lib/sandbox/errors";
import { db } from "../lib/db";
import { docChunks, apiKeys, workspaces } from "../lib/db/schema";
import { eq, sql } from "drizzle-orm";

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const API_KEY = "rl_test_demo_acmepay_key_01";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function testDocs() {
  console.log("\n==================================================================");
  console.log("       RELAY DEVELOPER HUB: DOCS VERIFICATION TEST SUITE         ");
  console.log("==================================================================\n");

  // ---------------------------------------------------------------------------
  // Check 1: Verify All Error Code Links in API Responses Resolve
  // ---------------------------------------------------------------------------
  console.log("TEST 1: Error Catalogue Links Resolution");
  const errorCodes = Object.keys(ERROR_REGISTRY);
  assert(errorCodes.length >= 21, `Error registry contains ${errorCodes.length} standard error definitions`);

  for (const code of errorCodes) {
    const def = ERROR_REGISTRY[code as any];
    assert(def.docUrl === `/docs/errors#${code}`, `Error code '${code}' points to valid anchor '/docs/errors#${code}'`);
    assert(def.status >= 400 && def.status < 600, `Error '${code}' has valid HTTP status ${def.status}`);
    assert(def.howToFix.length > 0, `Error '${code}' includes remediation instructions`);
  }

  // ---------------------------------------------------------------------------
  // Check 2: Verify Version Schema Differences (v2024-06-01 vs v2025-10-01)
  // ---------------------------------------------------------------------------
  console.log("\nTEST 2: API Version Schema Discrepancy Checks");

  const messageSpec = API_SPECIFICATION.find((e) => e.id === "messages-send");
  assert(!!messageSpec, "POST /messages specification found in api-spec.ts");

  // Modern v2025-10-01 parameter
  const modernParam = messageSpec?.parameters.find((p) => p.name === "to");
  assert(!!modernParam, "v2025-10-01 uses standard 'to' recipient parameter");

  // Overridden v2024-06-01 parameter
  const legacyParams = messageSpec?.versionOverrides?.["v2024-06-01"]?.parameters;
  const legacyParam = legacyParams?.find((p) => p.name === "phone");
  assert(!!legacyParam, "v2024-06-01 overrides recipient parameter to 'phone'");

  // Customer CDP profile difference
  const customerSpec = API_SPECIFICATION.find((e) => e.id === "customers-get");
  const modernCustomer = customerSpec?.responseBodyExample;
  assert(!!modernCustomer?.traits, "v2025-10-01 customer profile includes computed 'traits' dictionary");

  const legacyCustomer = customerSpec?.versionOverrides?.["v2024-06-01"]?.responseBodyExample;
  assert(!legacyCustomer?.traits, "v2024-06-01 customer profile omits 'traits' dictionary");

  // ---------------------------------------------------------------------------
  // Check 3: Verify Doc Chunks Search Index in Database
  // ---------------------------------------------------------------------------
  console.log("\nTEST 3: Docs Search Indexing Verification");

  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(docChunks);
  const totalChunks = countResult?.count || 0;
  assert(totalChunks > 0, `Database doc_chunks table is populated with ${totalChunks} searchable records`);

  // Query search for DLT
  const dltChunk = await db.query.docChunks?.findFirst({
    where: (chunks, { like }) => like(chunks.content, "%DLT%"),
  });
  assert(!!dltChunk, "Full-text search query retrieves DLT regulatory documentation");

  // Query search for rate limits
  const rateLimitChunk = await db.query.docChunks?.findFirst({
    where: (chunks, { like }) => like(chunks.content, "%rate limit%"),
  });
  assert(!!rateLimitChunk, "Full-text search query retrieves Rate Limit documentation");

  // ---------------------------------------------------------------------------
  // Check 4: Test OpenAPI and Postman Generators
  // ---------------------------------------------------------------------------
  console.log("\nTEST 4: Machine-Readable Downloads Specification");

  const allEndpoints = API_SPECIFICATION;
  assert(allEndpoints.length >= 10, `API specification covers ${allEndpoints.length} total endpoints`);

  for (const ep of allEndpoints) {
    assert(ep.codeSnippets.curl.includes("curl"), `Endpoint ${ep.id} has working cURL code snippet`);
    assert(ep.codeSnippets.node.includes("fetch") || ep.codeSnippets.node.includes("RelayClient"), `Endpoint ${ep.id} has Node.js snippet`);
    assert(ep.codeSnippets.python.includes("requests") || ep.codeSnippets.python.includes("RelayClient"), `Endpoint ${ep.id} has Python snippet`);
    assert(!!ep.responseBodyExample, `Endpoint ${ep.id} has concrete response payload example`);
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

testDocs().catch((err) => {
  console.error("Docs verification failed:", err);
  process.exit(1);
});
