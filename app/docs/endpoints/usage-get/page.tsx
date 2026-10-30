"use client";

import React from "react";
import { EndpointDocPage } from "@/components/devhub";

export default function UsageGetDoc() {
  return (
    <EndpointDocPage
      endpointId="usage-get"
      prevPage={{ title: "GET /delivery-status/{id}", href: "/docs/endpoints/delivery-status-get" }}
      nextPage={{ title: "Webhook Endpoints API", href: "/docs/endpoints/webhook-endpoints" }}
    />
  );
}
