import { NextResponse } from "next/server";
import { API_SPECIFICATION } from "@/lib/docs/api-spec";

export async function GET() {
  const items = API_SPECIFICATION.map((endpoint) => {
    const queryAndHeader = endpoint.parameters.filter((p) => p.in !== "body");
    const bodyParams = endpoint.parameters.filter((p) => p.in === "body");

    return {
      name: endpoint.title,
      request: {
        method: endpoint.method,
        header: [
          {
            key: "Authorization",
            value: "Bearer {{RELAY_API_KEY}}",
            type: "text",
          },
          {
            key: "Content-Type",
            value: "application/json",
            type: "text",
          },
          ...queryAndHeader
            .filter((p) => p.in === "header")
            .map((p) => ({
              key: p.name,
              value: p.example || (p.name === "Idempotency-Key" ? "{{$guid}}" : ""),
              description: p.description,
            })),
        ],
        body:
          bodyParams.length > 0 && endpoint.requestBodyExample
            ? {
                mode: "raw",
                raw: JSON.stringify(endpoint.requestBodyExample, null, 2),
                options: {
                  raw: {
                    language: "json",
                  },
                },
              }
            : undefined,
        url: {
          raw: `{{BASE_URL}}${endpoint.path}`,
          host: ["{{BASE_URL}}"],
          path: endpoint.path.replace(/^\//, "").split("/"),
          query: queryAndHeader
            .filter((p) => p.in === "query")
            .map((p) => ({
              key: p.name,
              value: p.example ? String(p.example) : "",
              description: p.description,
            })),
        },
        description: `${endpoint.summary}\n\n${endpoint.description}\n\nRequired Scopes: ${endpoint.requiredScopes.join(", ") || "None"}`,
      },
      response: [
        {
          name: "200 Success Response",
          status: "OK",
          code: endpoint.responseStatus,
          header: [{ key: "Content-Type", value: "application/json" }],
          body: JSON.stringify(endpoint.responseBodyExample, null, 2),
        },
      ],
    };
  });

  const postmanCollection = {
    info: {
      name: "Relay Developer API Collection",
      _postman_id: "relay-developer-hub-v2025-10-01",
      description:
        "Official Postman collection for Relay SMS, RCS, WhatsApp and CDP profile APIs. Run in sandbox using localhost:3001 or live carrier environment.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      {
        key: "BASE_URL",
        value: "http://localhost:3001",
        type: "string",
      },
      {
        key: "RELAY_API_KEY",
        value: "rl_test_demo_acmepay_key_01",
        type: "string",
      },
    ],
    item: items,
  };

  return NextResponse.json(postmanCollection, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
