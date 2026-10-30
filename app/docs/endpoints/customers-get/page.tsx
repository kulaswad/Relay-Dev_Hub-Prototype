"use client";

import React from "react";
import { EndpointDocPage } from "@/components/devhub";

export default function CustomersGetDoc() {
  return (
    <EndpointDocPage
      endpointId="customers-get"
      prevPage={{ title: "POST /events", href: "/docs/endpoints/events-ingest" }}
      nextPage={{ title: "PUT /customers/{id}", href: "/docs/endpoints/customers-update" }}
    />
  );
}
