import crypto from "crypto";

export interface RelayConfig {
  apiKey: string;
  baseUrl?: string;
  apiVersion?: string;
}

export interface SendMessageParams {
  to: string;
  channel: "sms" | "rcs" | "whatsapp";
  templateId: string;
  variables?: Record<string, string>;
  senderId?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface IngestEventParams {
  event: string;
  externalId?: string;
  customerId?: string;
  properties?: Record<string, any>;
  timestamp?: number;
}

export class RelayClient {
  private apiKey: string;
  private baseUrl: string;
  private apiVersion: string;

  constructor(config: RelayConfig) {
    if (!config.apiKey) {
      throw new Error("RelayClient requires a valid API key (rl_test_... or rl_live_...)");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "http://localhost:3001/api/v1";
    this.apiVersion = config.apiVersion || "2025-10-01";
  }

  private async request(method: string, path: string, body?: any, headers?: Record<string, string>) {
    const url = `${this.baseUrl}${path}`;
    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "Relay-Version": this.apiVersion,
      ...headers,
    };

    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error?.message || `HTTP ${res.status} error`);
      (err as any).status = res.status;
      (err as any).code = data.error?.code;
      (err as any).docUrl = data.error?.doc_url;
      throw err;
    }
    return data;
  }

  // Messages API
  public messages = {
    send: async (params: SendMessageParams) => {
      const { idempotencyKey, ...body } = params;
      const headers: Record<string, string> = {};
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
      return this.request("POST", "/messages", {
        to: body.to,
        channel: body.channel,
        template_id: body.templateId,
        variables: body.variables,
        sender_id: body.senderId,
        metadata: body.metadata,
      }, headers);
    },
    get: async (id: string) => {
      return this.request("GET", `/messages/${id}`);
    },
    list: async (query?: { limit?: number; starting_after?: string; status?: string }) => {
      const params = new URLSearchParams();
      if (query?.limit) params.set("limit", String(query.limit));
      if (query?.starting_after) params.set("starting_after", query.starting_after);
      if (query?.status) params.set("status", query.status);
      const qs = params.toString() ? `?${params.toString()}` : "";
      return this.request("GET", `/messages${qs}`);
    },
  };

  // Events & Customer CDP API
  public events = {
    ingest: async (params: IngestEventParams) => {
      return this.request("POST", "/events", {
        event: params.event,
        external_id: params.externalId,
        customer_id: params.customerId,
        properties: params.properties,
        timestamp: params.timestamp,
      });
    },
  };

  public customers = {
    get: async (id: string) => {
      return this.request("GET", `/customers/${id}`);
    },
    update: async (id: string, updates: { traits?: Record<string, any>; attributes?: Record<string, any>; consent?: Record<string, any> }) => {
      return this.request("PUT", `/customers/${id}`, updates);
    },
  };

  // Webhooks Utility
  public webhooks = {
    verifySignature: (rawBody: Buffer | string, signatureHeader: string, secret: string): boolean => {
      const tMatch = signatureHeader.match(/t=(\d+)/);
      if (!tMatch) return false;
      const timestamp = tMatch[1];

      // Replay prevention: 5-minute tolerance
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

      const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
      const signedPayload = `${timestamp}.${bodyStr}`;
      const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

      const v1Matches = Array.from(signatureHeader.matchAll(/v1=([a-f0-9]{64})/g)).map(m => m[1]);
      return v1Matches.some(v1 => {
        try {
          return crypto.timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
        } catch {
          return false;
        }
      });
    },
  };
}

export default RelayClient;
