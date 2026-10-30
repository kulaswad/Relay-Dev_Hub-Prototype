"use client";

import React from "react";
import { EndpointDocPage } from "@/components/devhub";

export default function EventsIngestDoc() {
  return (
    <EndpointDocPage
      endpointId="events-ingest"
      prevPage={{ title: "GET /messages (List)", href: "/docs/endpoints/messages-list" }}
      nextPage={{ title: "GET /customers/{id}", href: "/docs/endpoints/customers-get" }}
    />
  );
}
