"use client";

import React from "react";
import { EndpointDocPage } from "@/components/devhub";

export default function DeliveryStatusGetDoc() {
  return (
    <EndpointDocPage
      endpointId="delivery-status-get"
      prevPage={{ title: "PUT /customers/{id}", href: "/docs/endpoints/customers-update" }}
      nextPage={{ title: "GET /usage", href: "/docs/endpoints/usage-get" }}
    />
  );
}
