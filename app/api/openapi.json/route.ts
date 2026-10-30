import { NextResponse } from "next/server";
import { API_SPECIFICATION } from "@/lib/docs/api-spec";

export async function GET() {
  const paths: Record<string, any> = {};

  for (const endpoint of API_SPECIFICATION) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }

    const methodLower = endpoint.method.toLowerCase();
    const queryAndHeaderAndPathParams = endpoint.parameters.filter((p) => p.in !== "body");
    const bodyParams = endpoint.parameters.filter((p) => p.in === "body");

    paths[endpoint.path][methodLower] = {
      summary: endpoint.summary,
      description: endpoint.description,
      operationId: endpoint.id,
      tags: [endpoint.section],
      parameters: queryAndHeaderAndPathParams.map((p) => ({
        name: p.name,
        in: p.in,
        required: p.required,
        description: p.description,
        schema: {
          type: p.type === "integer" ? "integer" : "string",
          default: p.default,
        },
      })),
      ...(bodyParams.length > 0 && {
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: bodyParams.reduce((acc: any, p) => {
                  acc[p.name] = {
                    type: p.type,
                    description: p.description,
                    example: p.example,
                  };
                  return acc;
                }, {}),
                required: bodyParams.filter((p) => p.required).map((p) => p.name),
              },
              example: endpoint.requestBodyExample,
            },
          },
        },
      }),
      responses: {
        [endpoint.responseStatus]: {
          description: "Successful response",
          content: {
            "application/json": {
              example: endpoint.responseBodyExample,
            },
          },
        },
        ...(endpoint.errorExamples || []).reduce((acc: any, err) => {
          acc[err.status] = {
            description: err.title,
            content: {
              "application/json": {
                example: err.body,
              },
            },
          };
          return acc;
        }, {}),
      },
      security: endpoint.requiredScopes.length > 0 ? [{ BearerAuth: endpoint.requiredScopes }] : [],
    };
  }

  const openapiDoc = {
    openapi: "3.0.3",
    info: {
      title: "Relay Telecom & CDP Developer API",
      version: "2025-10-01",
      description:
        "Customer-facing API for Relay: Omnichannel SMS, RCS, WhatsApp messaging and real-time unified customer profile (CDP) ingestion.",
      contact: {
        name: "Relay Developer Support",
        url: "https://relay.in/support",
        email: "developers@relay.in",
      },
    },
    servers: [
      {
        url: "https://api.relay.in/v1",
        description: "Live Production Gateway (Requires Indian MCA & TRAI KYC)",
      },
      {
        url: "http://localhost:3001/api/v1",
        description: "Localhost Interactive Sandbox",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key (rl_test_... or rl_live_...)",
          description: "Enter your Relay API key in Authorization: Bearer <key> format.",
        },
      },
    },
    paths,
  };

  return NextResponse.json(openapiDoc, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
