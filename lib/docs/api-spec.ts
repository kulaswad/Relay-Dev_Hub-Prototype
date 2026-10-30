export interface ParameterSpec {
  name: string;
  in: "query" | "header" | "path" | "body";
  type: string;
  required: boolean;
  description: string;
  constraints?: string;
  default?: any;
  example?: any;
}

export interface ErrorExample {
  status: number;
  code: string;
  title: string;
  body: {
    error: {
      type: string;
      code: string;
      message: string;
      param?: string;
      doc_url: string;
      request_id: string;
    };
  };
}

export interface VersionOverride {
  parameters?: ParameterSpec[];
  requestBodyExample?: Record<string, any>;
  responseBodyExample?: Record<string, any>;
  notes?: string;
}

export interface EndpointSpec {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  title: string;
  summary: string;
  description: string;
  section: "Messages" | "Events (CDP)" | "Customers (CDP)" | "Delivery Reports" | "Webhooks" | "Usage & System";
  requiredScopes: string[];
  availableSince: string;
  changedIn?: string;
  rateLimitNote?: string;
  idempotencyNote?: string;
  parameters: ParameterSpec[];
  requestBodyExample?: Record<string, any>;
  responseStatus: number;
  responseBodyExample: Record<string, any>;
  errorExamples?: ErrorExample[];
  codeSnippets: {
    curl: string;
    node: string;
    python: string;
    php: string;
    java: string;
    go: string;
  };
  versionOverrides?: Record<string, VersionOverride>;
}

export interface WebhookEventSpec {
  type: string;
  name: string;
  description: string;
  category: "Messages" | "Customer CDP" | "Workspace & Compliance";
  availableSince: string;
  samplePayload: {
    id: string;
    type: string;
    api_version: string;
    created_at: string;
    data: {
      object: Record<string, any>;
    };
  };
}

export const API_SPEC = {
  get endpoints() {
    return API_SPECIFICATION;
  },
};

export const API_SPECIFICATION: EndpointSpec[] = [
  {
    id: "messages-send",
    method: "POST",
    path: "/api/v1/messages",
    title: "Send a Message",
    summary: "Dispatch a single SMS, RCS or WhatsApp message",
    description: "Submits a transactional or promotional message through the Relay Telecom Gateway. In test mode, simulates telecom carrier state transitions. In live mode, validates TRAI DLT registration and debits your wallet balance.",
    section: "Messages",
    requiredScopes: ["messages:send"],
    availableSince: "v2024-06-01",
    changedIn: "v2025-10-01",
    rateLimitNote: "Standard sandbox rate limit is 60 req/min per key. Growth plan is 250 req/min. Enforces sliding window.",
    idempotencyNote: "Supports 'Idempotency-Key' header (UUID v4 recommended). Cached for 24 hours.",
    parameters: [
      { name: "Idempotency-Key", in: "header", type: "string", required: false, description: "Unique UUID to guarantee at-most-once delivery across network retries", constraints: "UUID or unique string up to 255 chars" },
      { name: "Relay-Version", in: "header", type: "string", required: false, description: "API version override (e.g. 2025-10-01, 2025-01-15, 2024-06-01)", default: "Pinned key version" },
      { name: "to", in: "body", type: "string", required: true, description: "Recipient mobile number in E.164 Indian format (+91XXXXXXXXXX)", constraints: "+91 followed by 10 valid telecom digits", example: "+919999900001" },
      { name: "channel", in: "body", type: "string", required: true, description: "Messaging channel: 'sms', 'rcs', or 'whatsapp'", constraints: "Must be 'sms', 'rcs', or 'whatsapp'", default: "sms", example: "sms" },
      { name: "template_id", in: "body", type: "string", required: true, description: "DLT approved Content Template ID", constraints: "Registered on Indian DLT portal (e.g. Jio, Vilpower, Airtel)", example: "dlt_tmpl_otp_login" },
      { name: "variables", in: "body", type: "object", required: false, description: "Key-value mapping of dynamic template variable placeholders", example: { "1": "481924" } },
      { name: "sender_id", in: "body", type: "string", required: false, description: "6-character approved alphabetic TRAI DLT Header", constraints: "6 uppercase alphabetic characters", default: "RELAYI", example: "RELAYI" },
      { name: "metadata", in: "body", type: "object", required: false, description: "Custom developer metadata returned in webhooks and logs", example: { user_id: "usr_9921" } },
    ],
    requestBodyExample: {
      to: "+919999900001",
      channel: "sms",
      template_id: "dlt_tmpl_otp_login",
      variables: { "1": "749201" },
      sender_id: "RELAYI",
      metadata: { transaction_id: "txn_order_441" },
    },
    responseStatus: 202,
    responseBodyExample: {
      id: "msg_01JB9X7V2T4KZQ8M",
      object: "message",
      status: "queued",
      channel: "sms",
      to: "+9199•••01",
      sender_id: "RELAYI",
      template_id: "dlt_tmpl_otp_login",
      cost: {
        estimated: 0.12,
        currency: "INR",
        charged: 0,
      },
      created_at: "2026-10-30T02:00:00.000Z",
    },
    errorExamples: [
      {
        status: 400,
        code: "invalid_phone_number",
        title: "Invalid Phone Number Format",
        body: {
          error: {
            type: "invalid_request_error",
            code: "invalid_phone_number",
            message: "The recipient phone '+9112345' is not a valid Indian E.164 mobile number (+91XXXXXXXXXX).",
            param: "to",
            doc_url: "/docs/errors#invalid_phone_number",
            request_id: "req_01jb9x82k49zqp",
          },
        },
      },
      {
        status: 403,
        code: "workspace_not_verified",
        title: "Live Carrier Access Gated",
        body: {
          error: {
            type: "permission_error",
            code: "workspace_not_verified",
            message: "Live API keys cannot send messages until your workspace completes TRAI/DLT and MCA KYC verification.",
            param: "workspace_id",
            doc_url: "/docs/errors#workspace_not_verified",
            request_id: "req_01jb9x82k49zqq",
          },
        },
      },
      {
        status: 429,
        code: "rate_limit_exceeded",
        title: "Sliding Window Limit Reached",
        body: {
          error: {
            type: "rate_limit_error",
            code: "rate_limit_exceeded",
            message: "You have exceeded your rate limit of 60 requests per minute.",
            doc_url: "/docs/errors#rate_limit_exceeded",
            request_id: "req_01jb9x82k49zqr",
          },
        },
      },
    ],
    codeSnippets: {
      curl: `curl -X POST https://api.relay.in/v1/messages \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: e821815e-4db9-467f-94ad-73bc4f7c10b2" \\
  -d '{
    "to": "+919999900001",
    "channel": "sms",
    "template_id": "dlt_tmpl_otp_login",
    "variables": {"1": "749201"},
    "sender_id": "RELAYI"
  }'`,
      node: `// Node.js (fetch / native)
const res = await fetch("https://api.relay.in/v1/messages", {
  method: "POST",
  headers: {
    "Authorization": "Bearer rl_test_demo_acmepay_key_01",
    "Content-Type": "application/json",
    "Idempotency-Key": "e821815e-4db9-467f-94ad-73bc4f7c10b2",
  },
  body: JSON.stringify({
    to: "+919999900001",
    channel: "sms",
    template_id: "dlt_tmpl_otp_login",
    variables: { "1": "749201" },
    sender_id: "RELAYI",
  }),
});
const data = await res.json();
console.log("Message queued:", data.id);`,
      python: `# Python (requests)
import requests

response = requests.post(
    "https://api.relay.in/v1/messages",
    headers={
        "Authorization": "Bearer rl_test_demo_acmepay_key_01",
        "Content-Type": "application/json",
        "Idempotency-Key": "e821815e-4db9-467f-94ad-73bc4f7c10b2",
    },
    json={
        "to": "+919999900001",
        "channel": "sms",
        "template_id": "dlt_tmpl_otp_login",
        "variables": {"1": "749201"},
        "sender_id": "RELAYI",
    },
)
print("Status:", response.status_code, response.json())`,
      php: `<?php
// PHP (cURL)
$ch = curl_init("https://api.relay.in/v1/messages");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer rl_test_demo_acmepay_key_01",
    "Content-Type: application/json",
    "Idempotency-Key: e821815e-4db9-467f-94ad-73bc4f7c10b2"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "to" => "+919999900001",
    "channel" => "sms",
    "template_id" => "dlt_tmpl_otp_login",
    "variables" => ["1" => "749201"],
    "sender_id" => "RELAYI"
]));
$response = curl_exec($ch);
curl_close($ch);
echo $response;`,
      java: `// Java 11+ (HttpClient)
import java.net.URI;
import java.net.http.*;

HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.relay.in/v1/messages"))
    .header("Authorization", "Bearer rl_test_demo_acmepay_key_01")
    .header("Content-Type", "application/json")
    .header("Idempotency-Key", "e821815e-4db9-467f-94ad-73bc4f7c10b2")
    .POST(HttpRequest.BodyPublishers.ofString("""
        {
          "to": "+919999900001",
          "channel": "sms",
          "template_id": "dlt_tmpl_otp_login",
          "variables": {"1": "749201"},
          "sender_id": "RELAYI"
        }
        """))
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`,
      go: `// Go (net/http)
package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

func main() {
	payload := []byte(\`{
		"to": "+919999900001",
		"channel": "sms",
		"template_id": "dlt_tmpl_otp_login",
		"variables": {"1": "749201"},
		"sender_id": "RELAYI"
	}\`)

	req, _ := http.NewRequest("POST", "https://api.relay.in/v1/messages", bytes.NewBuffer(payload))
	req.Header.Set("Authorization", "Bearer rl_test_demo_acmepay_key_01")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", "e821815e-4db9-467f-94ad-73bc4f7c10b2")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil { panic(err) }
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}`,
    },
    versionOverrides: {
      "v2024-06-01": {
        parameters: [
          { name: "phone", in: "body", type: "string", required: true, description: "Legacy recipient phone parameter in v2024-06-01 (Renamed to 'to' in v2025-10-01)", example: "+919999900001" },
          { name: "channel", in: "body", type: "string", required: true, description: "Messaging channel (SMS only in v2024-06-01)", example: "sms" },
          { name: "template_id", in: "body", type: "string", required: true, description: "Content Template ID", example: "dlt_tmpl_otp_login" },
          { name: "variables", in: "body", type: "object", required: false, description: "Variables dictionary", example: { "1": "481924" } },
        ],
        requestBodyExample: {
          phone: "+919999900001",
          channel: "sms",
          template_id: "dlt_tmpl_otp_login",
          variables: { "1": "749201" },
        },
        responseBodyExample: {
          id: "msg_legacy_01928",
          status: "submitted",
          phone: "+9199•••01",
          template_id: "dlt_tmpl_otp_login",
          created_at: 1717200000,
        },
        notes: "In v2024-06-01: Recipient parameter is 'phone' instead of 'to'. The status value is 'submitted' instead of 'queued'. RCS and WhatsApp channels were not supported in this version.",
      },
    },
  },
  {
    id: "messages-get",
    method: "GET",
    path: "/api/v1/messages/{id}",
    title: "Get Message Details",
    summary: "Retrieve message status, carrier timeline, and delivery receipts",
    description: "Returns the current state and carrier lifecycle timeline of a previously dispatched message.",
    section: "Messages",
    requiredScopes: ["messages:send", "messages:read"],
    availableSince: "v2024-06-01",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "Relay message identifier (msg_...)", example: "msg_01JB9X7V2T4KZQ8M" },
    ],
    responseStatus: 200,
    responseBodyExample: {
      id: "msg_01JB9X7V2T4KZQ8M",
      object: "message",
      status: "delivered",
      channel: "sms",
      to: "+9199•••01",
      sender_id: "RELAYI",
      template_id: "dlt_tmpl_otp_login",
      timeline: [
        { status: "queued", timestamp: "2026-10-30T02:00:00.000Z" },
        { status: "sent", timestamp: "2026-10-30T02:00:01.200Z" },
        { status: "delivered", timestamp: "2026-10-30T02:00:02.800Z" },
      ],
      failure_reason: null,
      created_at: "2026-10-30T02:00:00.000Z",
      delivered_at: "2026-10-30T02:00:02.800Z",
    },
    codeSnippets: {
      curl: `curl -X GET https://api.relay.in/v1/messages/msg_01JB9X7V2T4KZQ8M \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01"`,
      node: `const res = await fetch("https://api.relay.in/v1/messages/msg_01JB9X7V2T4KZQ8M", {
  headers: { "Authorization": "Bearer rl_test_demo_acmepay_key_01" },
});
const msg = await res.json();
console.log(msg.status, msg.timeline);`,
      python: `import requests
res = requests.get(
    "https://api.relay.in/v1/messages/msg_01JB9X7V2T4KZQ8M",
    headers={"Authorization": "Bearer rl_test_demo_acmepay_key_01"}
)
print(res.json())`,
      php: `<?php
$ch = curl_init("https://api.relay.in/v1/messages/msg_01JB9X7V2T4KZQ8M");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer rl_test_demo_acmepay_key_01"]);
echo curl_exec($ch);
curl_close($ch);`,
      java: `// Java 11+
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.relay.in/v1/messages/msg_01JB9X7V2T4KZQ8M"))
    .header("Authorization", "Bearer rl_test_demo_acmepay_key_01")
    .GET().build();
HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());`,
      go: `req, _ := http.NewRequest("GET", "https://api.relay.in/v1/messages/msg_01JB9X7V2T4KZQ8M", nil)
req.Header.Set("Authorization", "Bearer rl_test_demo_acmepay_key_01")
resp, _ := http.DefaultClient.Do(req)`,
    },
    versionOverrides: {
      "v2024-06-01": {
        responseBodyExample: {
          id: "msg_01JB9X7V2T4KZQ8M",
          status: "delivered",
          phone: "+9199•••01",
          delivered_at: 1717200002,
        },
        notes: "In v2024-06-01: 'timeline' array was not present. Delivered timestamp is returned as epoch integer instead of ISO 8601 string.",
      },
    },
  },
  {
    id: "messages-list",
    method: "GET",
    path: "/api/v1/messages",
    title: "List Messages",
    summary: "Paginated list of dispatched messages",
    description: "Returns a list of messages for the authenticated workspace. Filter by status, channel, and cursor.",
    section: "Messages",
    requiredScopes: ["messages:send", "messages:read"],
    availableSince: "v2024-06-01",
    parameters: [
      { name: "limit", in: "query", type: "integer", required: false, description: "Number of records to return (1-100)", default: 20, example: 20 },
      { name: "starting_after", in: "query", type: "string", required: false, description: "Cursor object ID for pagination", example: "msg_01JB9X7V..." },
      { name: "status", in: "query", type: "string", required: false, description: "Filter by status: queued, sent, delivered, failed, read", example: "delivered" },
      { name: "channel", in: "query", type: "string", required: false, description: "Filter by channel: sms, rcs, whatsapp", example: "sms" },
    ],
    responseStatus: 200,
    responseBodyExample: {
      object: "list",
      data: [
        {
          id: "msg_01JB9X7V2T4KZQ8M",
          status: "delivered",
          channel: "sms",
          to: "+9199•••01",
          created_at: "2026-10-30T02:00:00.000Z",
        },
      ],
      has_more: false,
    },
    codeSnippets: {
      curl: `curl -X GET "https://api.relay.in/v1/messages?limit=10&status=delivered" \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01"`,
      node: `const res = await fetch("https://api.relay.in/v1/messages?limit=10&status=delivered", {
  headers: { "Authorization": "Bearer rl_test_demo_acmepay_key_01" },
});
const { data, has_more } = await res.json();`,
      python: `import requests
res = requests.get(
    "https://api.relay.in/v1/messages?limit=10&status=delivered",
    headers={"Authorization": "Bearer rl_test_demo_acmepay_key_01"}
)
print(res.json())`,
      php: `<?php
$ch = curl_init("https://api.relay.in/v1/messages?limit=10&status=delivered");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer rl_test_demo_acmepay_key_01"]);
echo curl_exec($ch);`,
      java: `HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.relay.in/v1/messages?limit=10&status=delivered"))
    .header("Authorization", "Bearer rl_test_demo_acmepay_key_01")
    .GET().build();`,
      go: `req, _ := http.NewRequest("GET", "https://api.relay.in/v1/messages?limit=10&status=delivered", nil)
req.Header.Set("Authorization", "Bearer rl_test_demo_acmepay_key_01")`,
    },
  },
  {
    id: "events-ingest",
    method: "POST",
    path: "/api/v1/events",
    title: "Ingest CDP Events",
    summary: "Stream single or batch events into Customer Data Platform",
    description: "Ingests user actions into the Relay CDP identity graph. Automatically associates events with profiles by external_id or customer_id.",
    section: "Events (CDP)",
    requiredScopes: ["events:write"],
    availableSince: "v2025-01-15",
    changedIn: "v2025-10-01",
    idempotencyNote: "Includes event_id deduplication to prevent double-counting analytics events.",
    parameters: [
      { name: "external_id", in: "body", type: "string", required: false, description: "Unique CRM/App user identifier", example: "cust_acme_7710" },
      { name: "customer_id", in: "body", type: "string", required: false, description: "Relay customer profile ID (prf_...)" },
      { name: "event", in: "body", type: "string", required: true, description: "Event action identifier (e.g. checkout_completed, kyc_verified)", example: "checkout_completed" },
      { name: "properties", in: "body", type: "object", required: false, description: "Custom event attributes and payload data", example: { amount: 2999, currency: "INR" } },
      { name: "event_id", in: "body", type: "string", required: false, description: "Unique client event ID for deduplication" },
      { name: "timestamp", in: "body", type: "integer", required: false, description: "Unix epoch seconds when the action occurred" },
    ],
    requestBodyExample: {
      external_id: "cust_acme_7710",
      event: "checkout_completed",
      properties: {
        order_value_inr: 2999,
        payment_method: "upi",
        category: "electronics",
      },
      timestamp: 1793310000,
    },
    responseStatus: 202,
    responseBodyExample: {
      total: 1,
      accepted: 1,
      rejected: 0,
      errors: [],
    },
    codeSnippets: {
      curl: `curl -X POST https://api.relay.in/v1/events \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "external_id": "cust_acme_7710",
    "event": "checkout_completed",
    "properties": {"order_value_inr": 2999, "payment_method": "upi"}
  }'`,
      node: `await fetch("https://api.relay.in/v1/events", {
  method: "POST",
  headers: {
    "Authorization": "Bearer rl_test_demo_acmepay_key_01",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    external_id: "cust_acme_7710",
    event: "checkout_completed",
    properties: { order_value_inr: 2999, payment_method: "upi" },
  }),
});`,
      python: `import requests
requests.post(
    "https://api.relay.in/v1/events",
    headers={"Authorization": "Bearer rl_test_demo_acmepay_key_01"},
    json={
        "external_id": "cust_acme_7710",
        "event": "checkout_completed",
        "properties": {"order_value_inr": 2999, "payment_method": "upi"},
    }
)`,
      php: `<?php
$ch = curl_init("https://api.relay.in/v1/events");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer rl_test_demo_acmepay_key_01",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "external_id" => "cust_acme_7710",
    "event" => "checkout_completed",
    "properties" => ["order_value_inr" => 2999]
]));
curl_exec($ch);`,
      java: `HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.relay.in/v1/events"))
    .header("Authorization", "Bearer rl_test_demo_acmepay_key_01")
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString("{\\"external_id\\":\\"cust_acme_7710\\",\\"event\\":\\"checkout_completed\\"}"))
    .build();`,
      go: `req, _ := http.NewRequest("POST", "https://api.relay.in/v1/events", bytes.NewBuffer([]byte(\`{"external_id":"cust_acme_7710","event":"checkout_completed"}\`)))
req.Header.Set("Authorization", "Bearer rl_test_demo_acmepay_key_01")
req.Header.Set("Content-Type", "application/json")`,
    },
    versionOverrides: {
      "v2024-06-01": {
        notes: "CDP Event Ingestion endpoint was NOT available in v2024-06-01. Calling this endpoint in v2024-06-01 returns 404 endpoint_not_found.",
      },
    },
  },
  {
    id: "customers-get",
    method: "GET",
    path: "/api/v1/customers/{id}",
    title: "Get Unified Customer Profile",
    summary: "Retrieve single customer profile by Relay ID or external ID",
    description: "Returns the 360-degree customer record, including calculated traits (last_seen, total_events, preferred_channel) and consent flags.",
    section: "Customers (CDP)",
    requiredScopes: ["profiles:read", "customers:read"],
    availableSince: "v2025-01-15",
    changedIn: "v2025-10-01",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "Relay profile ID (prf_...) or external ID prefixed with ext_ (e.g. ext_cust_acmepay_7710)", example: "ext_cust_acmepay_7710" },
    ],
    responseStatus: 200,
    responseBodyExample: {
      id: "prf_acme_9921",
      external_ids: ["cust_acmepay_7710"],
      attributes: {
        name: "Rahul Verma",
        phone: "+919876543210",
        email: "rahul@example.com",
      },
      traits: {
        total_events: 14,
        last_seen: "2026-10-30T01:15:00.000Z",
        preferred_channel: "whatsapp",
        kyc_verified: true,
      },
      consent: {
        sms_opt_in: true,
        whatsapp_opt_in: true,
      },
    },
    codeSnippets: {
      curl: `curl -X GET https://api.relay.in/v1/customers/ext_cust_acmepay_7710 \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01"`,
      node: `const res = await fetch("https://api.relay.in/v1/customers/ext_cust_acmepay_7710", {
  headers: { "Authorization": "Bearer rl_test_demo_acmepay_key_01" },
});
const profile = await res.json();
console.log(profile.traits.preferred_channel);`,
      python: `import requests
res = requests.get(
    "https://api.relay.in/v1/customers/ext_cust_acmepay_7710",
    headers={"Authorization": "Bearer rl_test_demo_acmepay_key_01"}
)
print(res.json())`,
      php: `<?php
$ch = curl_init("https://api.relay.in/v1/customers/ext_cust_acmepay_7710");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer rl_test_demo_acmepay_key_01"]);
echo curl_exec($ch);`,
      java: `HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.relay.in/v1/customers/ext_cust_acmepay_7710"))
    .header("Authorization", "Bearer rl_test_demo_acmepay_key_01")
    .GET().build();`,
      go: `req, _ := http.NewRequest("GET", "https://api.relay.in/v1/customers/ext_cust_acmepay_7710", nil)
req.Header.Set("Authorization", "Bearer rl_test_demo_acmepay_key_01")`,
    },
    versionOverrides: {
      "v2024-06-01": {
        responseBodyExample: {
          id: "prf_acme_9921",
          external_ids: ["cust_acmepay_7710"],
          attributes: {
            name: "Rahul Verma",
            phone: "+919876543210",
          },
        },
        notes: "In v2024-06-01: The customer profile object did NOT contain the computed 'traits' dictionary or 'consent' object. Only basic attributes were returned.",
      },
    },
  },
  {
    id: "customers-update",
    method: "PUT",
    path: "/api/v1/customers/{id}",
    title: "Update Customer Attributes",
    summary: "Merge custom traits, contact details and consent flags into customer profile",
    description: "Deep-merges attributes, consent preferences, and custom traits into an existing customer profile.",
    section: "Customers (CDP)",
    requiredScopes: ["events:write", "customers:write"],
    availableSince: "v2025-01-15",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "Relay profile ID or ext_ identifier", example: "prf_acme_9921" },
      { name: "attributes", in: "body", type: "object", required: false, description: "Direct attributes (phone, email, name)" },
      { name: "traits", in: "body", type: "object", required: false, description: "Custom business traits to merge" },
      { name: "consent", in: "body", type: "object", required: false, description: "Channel opt-in/opt-out preferences" },
    ],
    requestBodyExample: {
      traits: {
        loyalty_tier: "gold",
        city: "Bengaluru",
      },
      consent: {
        whatsapp_opt_in: true,
      },
    },
    responseStatus: 200,
    responseBodyExample: {
      id: "prf_acme_9921",
      updated: true,
    },
    codeSnippets: {
      curl: `curl -X PUT https://api.relay.in/v1/customers/prf_acme_9921 \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01" \\
  -H "Content-Type: application/json" \\
  -d '{"traits": {"loyalty_tier": "gold"}}'`,
      node: `await fetch("https://api.relay.in/v1/customers/prf_acme_9921", {
  method: "PUT",
  headers: {
    "Authorization": "Bearer rl_test_demo_acmepay_key_01",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ traits: { loyalty_tier: "gold" } }),
});`,
      python: `import requests
requests.put(
    "https://api.relay.in/v1/customers/prf_acme_9921",
    headers={"Authorization": "Bearer rl_test_demo_acmepay_key_01"},
    json={"traits": {"loyalty_tier": "gold"}},
)`,
      php: `<?php
$ch = curl_init("https://api.relay.in/v1/customers/prf_acme_9921");
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer rl_test_demo_acmepay_key_01",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["traits" => ["loyalty_tier" => "gold"]]));
curl_exec($ch);`,
      java: `HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.relay.in/v1/customers/prf_acme_9921"))
    .header("Authorization", "Bearer rl_test_demo_acmepay_key_01")
    .header("Content-Type", "application/json")
    .PUT(HttpRequest.BodyPublishers.ofString("{\\"traits\\":{\\"loyalty_tier\\":\\"gold\\"}}"))
    .build();`,
      go: `req, _ := http.NewRequest("PUT", "https://api.relay.in/v1/customers/prf_acme_9921", bytes.NewBuffer([]byte(\`{"traits":{"loyalty_tier":"gold"}}\`)))
req.Header.Set("Authorization", "Bearer rl_test_demo_acmepay_key_01")`,
    },
  },
  {
    id: "delivery-status-get",
    method: "GET",
    path: "/api/v1/delivery-status/{message_id}",
    title: "Get Carrier Delivery Status",
    summary: "Detailed telecom delivery receipt, circle information and DLR response codes",
    description: "Returns telecom carrier DLR codes, cellular circle details, and carrier timestamp logs.",
    section: "Delivery Reports",
    requiredScopes: ["messages:send", "messages:read"],
    availableSince: "v2024-06-01",
    parameters: [
      { name: "message_id", in: "path", type: "string", required: true, description: "Relay message identifier", example: "msg_01JB9X7V2T4KZQ8M" },
    ],
    responseStatus: 200,
    responseBodyExample: {
      message_id: "msg_01JB9X7V2T4KZQ8M",
      carrier: "Bharti Airtel",
      circle: "Karnataka",
      dlr_code: "DELIVRD",
      description: "Message successfully delivered to terminal handset.",
      attempts: 1,
      timestamps: {
        submitted: "2026-10-30T02:00:00Z",
        delivered: "2026-10-30T02:00:02Z",
      },
    },
    codeSnippets: {
      curl: `curl -X GET https://api.relay.in/v1/delivery-status/msg_01JB9X7V2T4KZQ8M \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01"`,
      node: `const res = await fetch("https://api.relay.in/v1/delivery-status/msg_01JB9X7V2T4KZQ8M", {
  headers: { "Authorization": "Bearer rl_test_demo_acmepay_key_01" },
});
const dlr = await res.json();`,
      python: `import requests
res = requests.get(
    "https://api.relay.in/v1/delivery-status/msg_01JB9X7V2T4KZQ8M",
    headers={"Authorization": "Bearer rl_test_demo_acmepay_key_01"}
)`,
      php: `<?php
$ch = curl_init("https://api.relay.in/v1/delivery-status/msg_01JB9X7V2T4KZQ8M");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer rl_test_demo_acmepay_key_01"]);
echo curl_exec($ch);`,
      java: `HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.relay.in/v1/delivery-status/msg_01JB9X7V2T4KZQ8M"))
    .header("Authorization", "Bearer rl_test_demo_acmepay_key_01")
    .GET().build();`,
      go: `req, _ := http.NewRequest("GET", "https://api.relay.in/v1/delivery-status/msg_01JB9X7V2T4KZQ8M", nil)
req.Header.Set("Authorization", "Bearer rl_test_demo_acmepay_key_01")`,
    },
  },
  {
    id: "usage-get",
    method: "GET",
    path: "/api/v1/usage",
    title: "Workspace Usage & Quotas",
    summary: "Check current TPS limits, monthly quota consumption, and wallet balance",
    description: "Returns real-time telemetry on API consumption and remaining quotas for the current billing cycle.",
    section: "Usage & System",
    requiredScopes: [],
    availableSince: "v2024-06-01",
    parameters: [],
    responseStatus: 200,
    responseBodyExample: {
      workspace_id: "ws_acmepay_prod",
      plan_tier: "growth",
      rate_limit_per_min: 120,
      monthly_quota: 25000,
      quota_used: 1240,
      wallet_balance_inr: 1250,
      active_keys: 2,
    },
    codeSnippets: {
      curl: `curl -X GET https://api.relay.in/v1/usage \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01"`,
      node: `const res = await fetch("https://api.relay.in/v1/usage", {
  headers: { "Authorization": "Bearer rl_test_demo_acmepay_key_01" },
});
const usage = await res.json();`,
      python: `import requests
res = requests.get(
    "https://api.relay.in/v1/usage",
    headers={"Authorization": "Bearer rl_test_demo_acmepay_key_01"}
)`,
      php: `<?php
$ch = curl_init("https://api.relay.in/v1/usage");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer rl_test_demo_acmepay_key_01"]);
echo curl_exec($ch);`,
      java: `HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.relay.in/v1/usage"))
    .header("Authorization", "Bearer rl_test_demo_acmepay_key_01")
    .GET().build();`,
      go: `req, _ := http.NewRequest("GET", "https://api.relay.in/v1/usage", nil)
req.Header.Set("Authorization", "Bearer rl_test_demo_acmepay_key_01")`,
    },
  },
  {
    id: "health-get",
    method: "GET",
    path: "/api/v1/health",
    title: "Gateway Health Check",
    summary: "Public gateway status and connectivity check (no auth required)",
    description: "Verifies that the API gateway, database cluster, and carrier connections are operational.",
    section: "Usage & System",
    requiredScopes: [],
    availableSince: "v2024-06-01",
    parameters: [],
    responseStatus: 200,
    responseBodyExample: {
      status: "healthy",
      version: "v2025-10-01",
      timestamp: "2026-10-30T02:00:00.000Z",
      database: "connected",
    },
    codeSnippets: {
      curl: `curl -X GET https://api.relay.in/v1/health`,
      node: `const health = await fetch("https://api.relay.in/v1/health").then(r => r.json());`,
      python: `import requests
health = requests.get("https://api.relay.in/v1/health").json()`,
      php: `<?php
echo file_get_contents("https://api.relay.in/v1/health");`,
      java: `HttpResponse<String> response = HttpClient.newHttpClient().send(
    HttpRequest.newBuilder().uri(URI.create("https://api.relay.in/v1/health")).GET().build(),
    HttpResponse.BodyHandlers.ofString()
);`,
      go: `resp, _ := http.Get("https://api.relay.in/v1/health")`,
    },
  },
  {
    id: "webhook-endpoints-post",
    method: "POST",
    path: "/api/v1/webhook_endpoints",
    title: "Create Webhook Endpoint",
    summary: "Register destination HTTPS webhook receiver",
    description: "Registers a destination webhook URL. Returns an HMAC signing secret (whsec_...) used to authenticate incoming event payloads.",
    section: "Webhooks",
    requiredScopes: ["messages:send", "webhooks:manage"],
    availableSince: "v2024-06-01",
    parameters: [
      { name: "url", in: "body", type: "string", required: true, description: "Destination URL (HTTPS required in live mode)", example: "https://api.acmepay.in/webhooks/relay" },
      { name: "events", in: "body", type: "array", required: true, description: "List of event subscriptions (e.g. ['message.delivered', 'message.failed'])", example: ["message.delivered", "message.failed"] },
      { name: "description", in: "body", type: "string", required: false, description: "Friendly label for this endpoint" },
    ],
    requestBodyExample: {
      url: "https://api.acmepay.in/webhooks/relay",
      events: ["message.delivered", "message.failed"],
      description: "Primary Production DLR Receiver",
    },
    responseStatus: 201,
    responseBodyExample: {
      id: "wh_01JB9X7V2T4KZQ8M",
      url: "https://api.acmepay.in/webhooks/relay",
      status: "active",
      signing_secret: "whsec_live_948f20a1...",
      events: ["message.delivered", "message.failed"],
    },
    codeSnippets: {
      curl: `curl -X POST https://api.relay.in/v1/webhook_endpoints \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://api.acmepay.in/webhooks/relay",
    "events": ["message.delivered", "message.failed"]
  }'`,
      node: `const res = await fetch("https://api.relay.in/v1/webhook_endpoints", {
  method: "POST",
  headers: {
    "Authorization": "Bearer rl_test_demo_acmepay_key_01",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://api.acmepay.in/webhooks/relay",
    events: ["message.delivered", "message.failed"],
  }),
});`,
      python: `import requests
requests.post(
    "https://api.relay.in/v1/webhook_endpoints",
    headers={"Authorization": "Bearer rl_test_demo_acmepay_key_01"},
    json={
        "url": "https://api.acmepay.in/webhooks/relay",
        "events": ["message.delivered", "message.failed"],
    }
)`,
      php: `<?php
$ch = curl_init("https://api.relay.in/v1/webhook_endpoints");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer rl_test_demo_acmepay_key_01",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "url" => "https://api.acmepay.in/webhooks/relay",
    "events" => ["message.delivered", "message.failed"]
]));
curl_exec($ch);`,
      java: `HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.relay.in/v1/webhook_endpoints"))
    .header("Authorization", "Bearer rl_test_demo_acmepay_key_01")
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString("{\\"url\\":\\"https://api.acmepay.in/webhooks/relay\\",\\"events\\":[\\"message.delivered\\"]}"))
    .build();`,
      go: `req, _ := http.NewRequest("POST", "https://api.relay.in/v1/webhook_endpoints", bytes.NewBuffer([]byte(\`{"url":"https://api.acmepay.in/webhooks/relay","events":["message.delivered"]}\`)))
req.Header.Set("Authorization", "Bearer rl_test_demo_acmepay_key_01")`,
    },
  },
  {
    id: "webhook-endpoints-list",
    method: "GET",
    path: "/api/v1/webhook_endpoints",
    title: "List Webhook Endpoints",
    summary: "List all configured webhook receivers",
    description: "Returns all registered webhook receivers for the authenticated workspace.",
    section: "Webhooks",
    requiredScopes: [],
    availableSince: "v2024-06-01",
    parameters: [],
    responseStatus: 200,
    responseBodyExample: {
      object: "list",
      data: [
        {
          id: "wh_01JB9X7V2T4KZQ8M",
          url: "https://api.acmepay.in/webhooks/relay",
          status: "active",
          events: ["message.delivered", "message.failed"],
        },
      ],
    },
    codeSnippets: {
      curl: `curl -X GET https://api.relay.in/v1/webhook_endpoints \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01"`,
      node: `const res = await fetch("https://api.relay.in/v1/webhook_endpoints", {
  headers: { "Authorization": "Bearer rl_test_demo_acmepay_key_01" },
});
const endpoints = await res.json();`,
      python: `import requests
res = requests.get(
    "https://api.relay.in/v1/webhook_endpoints",
    headers={"Authorization": "Bearer rl_test_demo_acmepay_key_01"}
)`,
      php: `<?php
$ch = curl_init("https://api.relay.in/v1/webhook_endpoints");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer rl_test_demo_acmepay_key_01"]);
echo curl_exec($ch);`,
      java: `HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.relay.in/v1/webhook_endpoints"))
    .header("Authorization", "Bearer rl_test_demo_acmepay_key_01")
    .GET().build();`,
      go: `req, _ := http.NewRequest("GET", "https://api.relay.in/v1/webhook_endpoints", nil)
req.Header.Set("Authorization", "Bearer rl_test_demo_acmepay_key_01")`,
    },
  },
  {
    id: "webhook-endpoints-delete",
    method: "DELETE",
    path: "/api/v1/webhook_endpoints/{id}",
    title: "Delete Webhook Endpoint",
    summary: "Delete or disable a registered webhook endpoint",
    description: "Immediately ceases dispatching events to the specified webhook receiver.",
    section: "Webhooks",
    requiredScopes: ["messages:send", "webhooks:manage"],
    availableSince: "v2024-06-01",
    parameters: [
      { name: "id", in: "path", type: "string", required: true, description: "Webhook endpoint identifier (wh_...)" },
    ],
    responseStatus: 200,
    responseBodyExample: {
      id: "wh_01JB9X7V2T4KZQ8M",
      deleted: true,
    },
    codeSnippets: {
      curl: `curl -X DELETE https://api.relay.in/v1/webhook_endpoints/wh_01JB9X7V2T4KZQ8M \\
  -H "Authorization: Bearer rl_test_demo_acmepay_key_01"`,
      node: `await fetch("https://api.relay.in/v1/webhook_endpoints/wh_01JB9X7V2T4KZQ8M", {
  method: "DELETE",
  headers: { "Authorization": "Bearer rl_test_demo_acmepay_key_01" },
});`,
      python: `import requests
requests.delete(
    "https://api.relay.in/v1/webhook_endpoints/wh_01JB9X7V2T4KZQ8M",
    headers={"Authorization": "Bearer rl_test_demo_acmepay_key_01"}
)`,
      php: `<?php
$ch = curl_init("https://api.relay.in/v1/webhook_endpoints/wh_01JB9X7V2T4KZQ8M");
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer rl_test_demo_acmepay_key_01"]);
curl_exec($ch);`,
      java: `HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.relay.in/v1/webhook_endpoints/wh_01JB9X7V2T4KZQ8M"))
    .header("Authorization", "Bearer rl_test_demo_acmepay_key_01")
    .DELETE().build();`,
      go: `req, _ := http.NewRequest("DELETE", "https://api.relay.in/v1/webhook_endpoints/wh_01JB9X7V2T4KZQ8M", nil)
req.Header.Set("Authorization", "Bearer rl_test_demo_acmepay_key_01")`,
    },
  },
];

export const WEBHOOK_EVENTS_CATALOGUE: WebhookEventSpec[] = [
  {
    type: "message.queued",
    name: "Message Queued",
    description: "Fired immediately when an outbound message passes DLT validation and is queued for telecom dispatch.",
    category: "Messages",
    availableSince: "v2024-06-01",
    samplePayload: {
      id: "evt_samp_01",
      type: "message.queued",
      api_version: "v2025-10-01",
      created_at: "2026-10-30T02:00:00.000Z",
      data: {
        object: {
          id: "msg_01JB9X7V2T4KZQ8M",
          channel: "sms",
          recipient: "+9199•••01",
          sender_id: "RELAYI",
          template_id: "dlt_tmpl_otp_login",
          status: "queued",
        },
      },
    },
  },
  {
    type: "message.sent",
    name: "Message Sent",
    description: "Fired when the upstream telecom network carrier (Airtel, Jio, Vi) accepts the message for radio tower broadcast.",
    category: "Messages",
    availableSince: "v2024-06-01",
    samplePayload: {
      id: "evt_samp_02",
      type: "message.sent",
      api_version: "v2025-10-01",
      created_at: "2026-10-30T02:00:01.200Z",
      data: {
        object: {
          id: "msg_01JB9X7V2T4KZQ8M",
          channel: "sms",
          recipient: "+9199•••01",
          carrier: "Bharti Airtel",
          status: "sent",
        },
      },
    },
  },
  {
    type: "message.delivered",
    name: "Message Delivered",
    description: "Fired when the recipient's mobile handset returns a signed cellular DLR acknowledgment receipt.",
    category: "Messages",
    availableSince: "v2024-06-01",
    samplePayload: {
      id: "evt_samp_03",
      type: "message.delivered",
      api_version: "v2025-10-01",
      created_at: "2026-10-30T02:00:02.800Z",
      data: {
        object: {
          id: "msg_01JB9X7V2T4KZQ8M",
          channel: "sms",
          recipient: "+9199•••01",
          carrier: "Bharti Airtel",
          circle: "Karnataka",
          status: "delivered",
          delivered_at: "2026-10-30T02:00:02.800Z",
        },
      },
    },
  },
  {
    type: "message.failed",
    name: "Message Delivery Failed",
    description: "Fired when telecom delivery fails due to DND registry, handset unreachable, invalid route, or operator rejection.",
    category: "Messages",
    availableSince: "v2024-06-01",
    samplePayload: {
      id: "evt_samp_04",
      type: "message.failed",
      api_version: "v2025-10-01",
      created_at: "2026-10-30T02:00:01.000Z",
      data: {
        object: {
          id: "msg_01JB9X7V2T4KZQ8M",
          channel: "sms",
          recipient: "+9199•••02",
          status: "failed",
          failure_reason: "dnd_registered",
          carrier_code: "DND_REJECT_NDNC",
        },
      },
    },
  },
  {
    type: "message.read",
    name: "Message Read",
    description: "Fired when a WhatsApp or RCS message is opened and read by the recipient (blue tick acknowledgment).",
    category: "Messages",
    availableSince: "v2025-01-15",
    samplePayload: {
      id: "evt_samp_05",
      type: "message.read",
      api_version: "v2025-10-01",
      created_at: "2026-10-30T02:01:15.000Z",
      data: {
        object: {
          id: "msg_01JB9X7V2T4KZQ8M",
          channel: "whatsapp",
          recipient: "+9199•••01",
          status: "read",
          read_at: "2026-10-30T02:01:15.000Z",
        },
      },
    },
  },
  {
    type: "customer.profile.updated",
    name: "Customer Profile Updated",
    description: "Fired when a CDP customer profile's traits, consent, or contact attributes are modified.",
    category: "Customer CDP",
    availableSince: "v2025-01-15",
    samplePayload: {
      id: "evt_samp_06",
      type: "customer.profile.updated",
      api_version: "v2025-10-01",
      created_at: "2026-10-30T02:05:00.000Z",
      data: {
        object: {
          id: "prf_acme_9921",
          external_id: "cust_acmepay_7710",
          updated_fields: ["traits.loyalty_tier", "consent.whatsapp_opt_in"],
          traits: {
            loyalty_tier: "gold",
            city: "Bengaluru",
          },
        },
      },
    },
  },
  {
    type: "customer.consent.changed",
    name: "Customer Consent Changed",
    description: "Fired when end-user modifies opt-in / opt-out preferences across SMS, RCS, or WhatsApp.",
    category: "Customer CDP",
    availableSince: "v2025-10-01",
    samplePayload: {
      id: "evt_samp_07",
      type: "customer.consent.changed",
      api_version: "v2025-10-01",
      created_at: "2026-10-30T02:08:00.000Z",
      data: {
        object: {
          customer_id: "prf_acme_9921",
          channel: "whatsapp",
          opt_in: false,
          source: "user_reply_STOP",
        },
      },
    },
  },
  {
    type: "workspace.kyc.updated",
    name: "Workspace KYC Status Updated",
    description: "Fired when TRAI DLT registration, MCA Certificate of Incorporation, or Sender IDs are approved.",
    category: "Workspace & Compliance",
    availableSince: "v2024-06-01",
    samplePayload: {
      id: "evt_samp_08",
      type: "workspace.kyc.updated",
      api_version: "v2025-10-01",
      created_at: "2026-10-30T02:10:00.000Z",
      data: {
        object: {
          workspace_id: "ws_acmepay_prod",
          status: "approved",
          approved_sender_ids: ["ACMEPY", "RELAYI"],
          wallet_balance_inr: 5000.0,
        },
      },
    },
  },
];
