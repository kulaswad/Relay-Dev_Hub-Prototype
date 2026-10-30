import { NextResponse } from "next/server";

export type ErrorType =
  | "authentication_error"
  | "invalid_request_error"
  | "rate_limit_error"
  | "idempotency_error"
  | "permission_error"
  | "api_error";

export type ErrorCode =
  | "authentication_failed"
  | "key_revoked"
  | "insufficient_scope"
  | "workspace_not_verified"
  | "invalid_request"
  | "missing_parameter"
  | "invalid_phone_number"
  | "template_not_found"
  | "template_not_approved"
  | "sender_id_not_approved"
  | "invalid_channel"
  | "rate_limit_exceeded"
  | "quota_exceeded"
  | "idempotency_conflict"
  | "duplicate_event"
  | "customer_not_found"
  | "message_not_found"
  | "insufficient_balance"
  | "version_unsupported"
  | "internal_error"
  | "service_unavailable";

export interface ErrorDefinition {
  code: ErrorCode;
  type: ErrorType;
  status: number;
  message: string;
  description: string;
  commonCauses: string[];
  howToFix: string[];
  docUrl: string;
}

export const ERROR_REGISTRY: Record<ErrorCode, ErrorDefinition> = {
  authentication_failed: {
    code: "authentication_failed",
    type: "authentication_error",
    status: 401,
    message: "No valid API key provided. Include 'Authorization: Bearer rl_test_...' in your request headers.",
    description: "The API key supplied in the Authorization header was missing, malformed, or does not exist.",
    commonCauses: [
      "Missing 'Authorization: Bearer <key>' header.",
      "Typo in the API key prefix (e.g. using 'pk_' instead of 'rk_test_' or 'rl_test_').",
      "API key was deleted from the developer workspace.",
    ],
    howToFix: [
      "Check your Developer Console -> API Keys for an active sandbox key.",
      "Ensure headers format is exact: 'Authorization: Bearer <key>'.",
    ],
    docUrl: "/docs/errors#authentication_failed",
  },
  key_revoked: {
    code: "key_revoked",
    type: "authentication_error",
    status: 401,
    message: "The API key provided has been revoked and can no longer be used.",
    description: "This API key was explicitly marked as revoked in your workspace settings.",
    commonCauses: [
      "A developer revoked this key following rotation or a security alert.",
      "The key's 24-hour rotation grace period expired.",
    ],
    howToFix: [
      "Generate a new API key in the Relay Console -> API Keys.",
      "Update your application environment variables with the newly generated secret.",
    ],
    docUrl: "/docs/errors#key_revoked",
  },
  insufficient_scope: {
    code: "insufficient_scope",
    type: "permission_error",
    status: 403,
    message: "The API key provided does not have the required permissions for this action.",
    description: "The API key's configured scopes do not permit invoking this specific endpoint.",
    commonCauses: [
      "Invoking message dispatch with an events-only scoped key.",
      "Trying to read customer profiles without 'profiles:read' scope.",
    ],
    howToFix: [
      "Inspect the key scopes in the Relay Console.",
      "Create or update an API key with the required scope (e.g. 'messages:send', 'events:write', 'profiles:read').",
    ],
    docUrl: "/docs/errors#insufficient_scope",
  },
  workspace_not_verified: {
    code: "workspace_not_verified",
    type: "permission_error",
    status: 403,
    message: "Live API keys cannot send messages until your workspace completes TRAI/DLT and MCA KYC verification.",
    description: "Under Indian telecom regulation (TRAI TCCCPR 2018), live commercial SMS/RCS/WhatsApp dispatch is restricted to verified Indian business entities.",
    commonCauses: [
      "Using a live key ('rl_live_...' / 'rk_live_...') in a workspace whose KYC status is 'not_started' or 'in_review'.",
      "Attempting live traffic before uploading Certificate of Incorporation and GSTIN.",
    ],
    howToFix: [
      "Switch your API client to use your sandbox key ('rk_test_...' / 'rl_test_...') to test without restrictions.",
      "Visit Console -> Settings to submit KYC documents or toggle 'Simulate KYC Approved' in evaluation mode.",
    ],
    docUrl: "/docs/errors#workspace_not_verified",
  },
  invalid_request: {
    code: "invalid_request",
    type: "invalid_request_error",
    status: 400,
    message: "The request body or query parameters could not be parsed or are invalid.",
    description: "Malformed JSON payload or invalid schema constraints.",
    commonCauses: [
      "Missing required JSON body.",
      "Invalid data types passed to endpoint fields.",
    ],
    howToFix: [
      "Validate your request body against the OpenAPI specification in the API reference.",
      "Ensure 'Content-Type: application/json' header is present.",
    ],
    docUrl: "/docs/errors#invalid_request",
  },
  missing_parameter: {
    code: "missing_parameter",
    type: "invalid_request_error",
    status: 400,
    message: "A required parameter is missing from your request.",
    description: "One or more mandatory fields were omitted from the payload.",
    commonCauses: [
      "Omitted 'to' or 'channel' field in message dispatch.",
      "Missing 'event' name in event ingestion.",
    ],
    howToFix: [
      "Review the error 'param' attribute in this response.",
      "Supply the missing required parameter in your request body.",
    ],
    docUrl: "/docs/errors#missing_parameter",
  },
  invalid_phone_number: {
    code: "invalid_phone_number",
    type: "invalid_request_error",
    status: 422,
    message: "The recipient phone number is not a valid E.164 Indian mobile number (+91XXXXXXXXXX).",
    description: "Relay requires recipient mobile numbers to conform strictly to E.164 with the Indian country code +91 followed by a 10-digit mobile number starting with 6, 7, 8, or 9.",
    commonCauses: [
      "Missing country code prefix (+91).",
      "Landline numbers or invalid mobile series.",
      "Whitespace or non-digit characters inside the phone string.",
    ],
    howToFix: [
      "Format the phone number as '+91' followed by 10 digits (e.g. +919876543210).",
      "In the sandbox, test numbers include +919999900001 (always succeeds), +919999900002 (unreachable), and +919999900003 (DND).",
    ],
    docUrl: "/docs/errors#invalid_phone_number",
  },
  template_not_found: {
    code: "template_not_found",
    type: "invalid_request_error",
    status: 404,
    message: "The specified template_id does not exist.",
    description: "The DLT template identifier provided in the message payload was not found.",
    commonCauses: [
      "Typo in 'template_id'.",
      "Using an un-registered DLT template string.",
    ],
    howToFix: [
      "Use one of the pre-approved sandbox templates: 'dlt_tmpl_otp_login', 'dlt_tmpl_order_update', 'dlt_tmpl_payment_reminder'.",
      "Check registered templates in Console -> Settings -> DLT Templates.",
    ],
    docUrl: "/docs/errors#template_not_found",
  },
  template_not_approved: {
    code: "template_not_approved",
    type: "invalid_request_error",
    status: 422,
    message: "The specified template is pending DLT operator approval or has been rejected.",
    description: "TRAI regulations require all message templates to be approved on a registered telecom DLT portal before live use.",
    commonCauses: [
      "Template submission was rejected by telecom scrutiny committee.",
      "Template is still undergoing operator review.",
    ],
    howToFix: [
      "Ensure variable placeholders follow the exact `{#var#}` pattern approved on your DLT portal.",
      "Check approval status in your telecom operator dashboard.",
    ],
    docUrl: "/docs/errors#template_not_approved",
  },
  sender_id_not_approved: {
    code: "sender_id_not_approved",
    type: "invalid_request_error",
    status: 422,
    message: "The sender_id is not approved for this workspace.",
    description: "Transactional SMS must be sent with an approved 6-character alphabetic header registered on DLT for this entity.",
    commonCauses: [
      "Passing a sender_id not associated with your workspace.",
      "Sender ID contains non-alphabetic characters or incorrect length.",
    ],
    howToFix: [
      "In the sandbox, use the default approved sender IDs: 'RELAYI' or 'ACMEPY'.",
      "In live mode, register your header on your DLT portal and bind it in Console -> Settings.",
    ],
    docUrl: "/docs/errors#sender_id_not_approved",
  },
  invalid_channel: {
    code: "invalid_channel",
    type: "invalid_request_error",
    status: 422,
    message: "Invalid messaging channel. Supported channels are: 'sms', 'rcs', 'whatsapp'.",
    description: "The channel specified is not supported by Relay Gateway.",
    commonCauses: [
      "Channel misspelled or unsupported (e.g. 'viber', 'email').",
    ],
    howToFix: [
      "Set channel to 'sms', 'rcs', or 'whatsapp'.",
    ],
    docUrl: "/docs/errors#invalid_channel",
  },
  rate_limit_exceeded: {
    code: "rate_limit_exceeded",
    type: "rate_limit_error",
    status: 429,
    message: "Too many requests. You have exceeded your workspace's API rate limit.",
    description: "Your requests exceeded the allocated sliding-window transactions per minute.",
    commonCauses: [
      "Sending un-throttled burst traffic exceeding your rate limit per minute.",
      "Using sandbox key with default 60 req/min limit for high concurrency loads.",
    ],
    howToFix: [
      "Honor the 'Retry-After' response header and back off exponentially.",
      "Upgrade your workspace plan tier or contact support to increase your TPS quota.",
    ],
    docUrl: "/docs/errors#rate_limit_exceeded",
  },
  quota_exceeded: {
    code: "quota_exceeded",
    type: "rate_limit_error",
    status: 429,
    message: "Monthly quota exceeded for this workspace.",
    description: "You have exhausted the monthly allocated message volume for your current tier.",
    commonCauses: [
      "Sandbox tier monthly quota of 10,000 messages reached.",
    ],
    howToFix: [
      "Upgrade to Growth or Enterprise tier in Console -> Settings -> Plans.",
    ],
    docUrl: "/docs/errors#quota_exceeded",
  },
  idempotency_conflict: {
    code: "idempotency_conflict",
    type: "idempotency_error",
    status: 409,
    message: "An API request was previously submitted with this Idempotency-Key but with a different payload.",
    description: "Reusing an Idempotency-Key with differing request parameters is rejected to prevent duplicate transactions.",
    commonCauses: [
      "Reusing the same UUID for different payment/order dispatch messages.",
      "Client retried with mutated variable values.",
    ],
    howToFix: [
      "Generate a unique v4 UUID for every distinct logical transaction.",
      "If retrying a dropped network request, ensure the body is byte-for-byte identical.",
    ],
    docUrl: "/docs/errors#idempotency_conflict",
  },
  duplicate_event: {
    code: "duplicate_event",
    type: "invalid_request_error",
    status: 409,
    message: "An event with this event_id has already been ingested into the CDP.",
    description: "The event_id was previously recorded. Deduplication prevented re-processing.",
    commonCauses: [
      "Multiple client SDKs flushed the same cached event log.",
    ],
    howToFix: [
      "Verify whether the duplicate event was already successfully processed.",
      "Generate unique event IDs or omit event_id to allow auto-generation.",
    ],
    docUrl: "/docs/errors#duplicate_event",
  },
  customer_not_found: {
    code: "customer_not_found",
    type: "invalid_request_error",
    status: 404,
    message: "No customer profile found matching the provided identifier.",
    description: "Neither the Relay profile ID ('prf_...') nor the external ID exists in this workspace.",
    commonCauses: [
      "Customer has not yet performed any trackable events.",
      "Typo in external_id lookup.",
    ],
    howToFix: [
      "Ensure an initial 'identify' or track event was ingested for this customer.",
      "List profiles via GET /api/v1/customers to confirm existing external IDs.",
    ],
    docUrl: "/docs/errors#customer_not_found",
  },
  message_not_found: {
    code: "message_not_found",
    type: "invalid_request_error",
    status: 404,
    message: "No message found matching the provided message_id.",
    description: "The message identifier does not exist in this workspace or environment.",
    commonCauses: [
      "Looking up a test message using a live API key or vice versa.",
      "Typo in message ID.",
    ],
    howToFix: [
      "Verify the message ID returned by the POST /api/v1/messages 202 response.",
      "Ensure your environment (test/live) matches the key used during creation.",
    ],
    docUrl: "/docs/errors#message_not_found",
  },
  insufficient_balance: {
    code: "insufficient_balance",
    type: "invalid_request_error",
    status: 402,
    message: "Workspace prepaid wallet balance is insufficient to dispatch this message.",
    description: "Live mode requires an active wallet balance exceeding the estimated telecom carrier cost.",
    commonCauses: [
      "Prepaid INR balance is 0 or less than the per-message rate card cost.",
    ],
    howToFix: [
      "Top up your wallet in Console -> Usage -> Wallet Top-up.",
      "Switch to test mode ('rk_test_...') to send simulated messages without charges.",
    ],
    docUrl: "/docs/errors#insufficient_balance",
  },
  version_unsupported: {
    code: "version_unsupported",
    type: "invalid_request_error",
    status: 400,
    message: "The requested API version in 'Relay-Version' is unsupported or has been sunset.",
    description: "Relay maintains strict version deprecation timelines. Sunset versions cannot process requests.",
    commonCauses: [
      "Header 'Relay-Version' specifies an obsolete date (e.g. '2023-01-01').",
      "Using a sunset version that reached end-of-life.",
    ],
    howToFix: [
      "Specify 'Relay-Version: 2025-10-01' (current) or omit the header to default to the workspace pinned version.",
      "See the Changelog and Version Migration Guide in documentation.",
    ],
    docUrl: "/docs/errors#version_unsupported",
  },
  internal_error: {
    code: "internal_error",
    type: "api_error",
    status: 500,
    message: "An unexpected internal server error occurred while processing your request.",
    description: "Relay gateway encountered an unexpected exception.",
    commonCauses: [
      "Transient downstream telecom operator outage.",
      "Database lock contention under extreme load.",
    ],
    howToFix: [
      "Retry the request using exponential backoff and an Idempotency-Key.",
      "Check real-time system status at /status or contact support with the 'request_id'.",
    ],
    docUrl: "/docs/errors#internal_error",
  },
  service_unavailable: {
    code: "service_unavailable",
    type: "api_error",
    status: 503,
    message: "Relay Gateway is temporarily unavailable for scheduled carrier maintenance.",
    description: "Downstream telecom carriers or Relay services are undergoing maintenance.",
    commonCauses: [
      "Telecom operator DLT gateway sync maintenance window.",
    ],
    howToFix: [
      "Retry after the maintenance window. Queued messages will automatically drain.",
    ],
    docUrl: "/docs/errors#service_unavailable",
  },
};

export interface StandardErrorEnvelope {
  error: {
    type: ErrorType;
    code: ErrorCode;
    message: string;
    param?: string;
    doc_url: string;
    request_id: string;
  };
}

export function createErrorResponse(
  code: ErrorCode,
  details?: {
    message?: string;
    param?: string;
    requestId?: string;
    headers?: Record<string, string>;
  }
): NextResponse<StandardErrorEnvelope> {
  const def = ERROR_REGISTRY[code] || ERROR_REGISTRY.internal_error;
  const requestId = details?.requestId || `req_${Date.now().toString(36)}`;

  const body: StandardErrorEnvelope = {
    error: {
      type: def.type,
      code: def.code,
      message: details?.message || def.message,
      ...(details?.param ? { param: details.param } : {}),
      doc_url: def.docUrl,
      request_id: requestId,
    },
  };

  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Relay-Request-Id": requestId,
    ...(details?.headers || {}),
  };

  return NextResponse.json(body, {
    status: def.status,
    headers: responseHeaders,
  });
}
