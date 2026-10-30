"use client";

import React from "react";
import { EndpointDocPage } from "@/components/devhub";

export default function MessagesSendDoc() {
  return (
    <EndpointDocPage
      endpointId="messages-send"
      prevPage={{ title: "All Endpoints Overview", href: "/docs/endpoints" }}
      nextPage={{ title: "GET /messages/{id}", href: "/docs/endpoints/messages-get" }}
    />
  );
}
