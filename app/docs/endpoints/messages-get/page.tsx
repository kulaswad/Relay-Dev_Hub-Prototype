"use client";

import React from "react";
import { EndpointDocPage } from "@/components/devhub";

export default function MessagesGetDoc() {
  return (
    <EndpointDocPage
      endpointId="messages-get"
      prevPage={{ title: "POST /messages", href: "/docs/endpoints/messages-send" }}
      nextPage={{ title: "GET /messages (List)", href: "/docs/endpoints/messages-list" }}
    />
  );
}
