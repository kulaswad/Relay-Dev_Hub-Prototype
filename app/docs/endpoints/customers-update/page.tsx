"use client";

import React from "react";
import { EndpointDocPage } from "@/components/devhub";

export default function CustomersUpdateDoc() {
  return (
    <EndpointDocPage
      endpointId="customers-update"
      prevPage={{ title: "GET /customers/{id}", href: "/docs/endpoints/customers-get" }}
      nextPage={{ title: "GET /delivery-status/{message_id}", href: "/docs/endpoints/delivery-status-get" }}
    />
  );
}
