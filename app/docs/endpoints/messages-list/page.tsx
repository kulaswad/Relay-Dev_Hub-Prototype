"use client";

import React from "react";
import { EndpointDocPage } from "@/components/devhub";

export default function MessagesListDoc() {
  return (
    <EndpointDocPage
      endpointId="messages-list"
      prevPage={{ title: "GET /messages/{id}", href: "/docs/endpoints/messages-get" }}
      nextPage={{ title: "POST /events", href: "/docs/endpoints/events-ingest" }}
    />
  );
}
